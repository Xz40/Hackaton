import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

DEFAULT_OLLAMA_PATH = os.path.expandvars(r"%LOCALAPPDATA%\Programs\Ollama\ollama.exe")
OLLAMA_PATH = os.getenv("OLLAMA_PATH", DEFAULT_OLLAMA_PATH)

class SQLGenerator:
    def __init__(self, model_name="qwen2.5-coder:1.5b"):
        self.model_name = model_name

    def _get_system_prompt(self):
        semantic_info = get_semantic_context()
        # Максимально короткий промпт экономит ресурсы ИИ
        return f"""Task: Convert question to PostgreSQL. 
Table: 'orders'. 
Rules:
- Output ONLY SQL. 
- NO explanations. 
- Use LIMIT 1000.
- 'done' for successful orders.
- Formulas: {semantic_info}"""

    def _build_fallback_sql(self, user_query: str) -> str:
        """
        Детерминированный SQL на случай невалидного ответа модели.
        """
        query_text = (user_query or "").lower()
        limit = 10
        limit_match = re.search(r"\b(\d{1,4})\b", query_text)
        if limit_match:
            try:
                candidate = int(limit_match.group(1))
                if candidate > 0:
                    limit = min(candidate, 1000)
            except ValueError:
                pass
        return f"SELECT * FROM orders LIMIT {limit};"

    def generate(self, user_query: str) -> dict:
        enriched_query = enrich_question(user_query)
        
        # Просим писать в одну строку — это сильно снижает риск заикания
        full_prompt = (
            f"{self._get_system_prompt()}\n"
            f"Question: {enriched_query}\n"
            "Write SQL in ONE LINE.\n"
            "IMPORTANT: Always use FROM orders.\n"
            "Example: SELECT * FROM orders LIMIT 10;\n"
            "SQL:"
        )

        command = [OLLAMA_PATH, "run", self.model_name, full_prompt]

        try:
            # Снижаем нагрузку: читаем вывод как поток или ставим таймаут
            result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='ignore')
            sql = result.stdout.strip()
            
            # --- БРОНЕБОЙНАЯ ОЧИСТКА ---
            # Убираем всё до первого SELECT и всё после точки с запятой
            sql = re.sub(r'^(.*?)SELECT', 'SELECT', sql, flags=re.DOTALL | re.IGNORECASE)
            
            # Убираем ЛЮБЫЕ повторяющиеся слова, даже если они разные по длине, но стоят рядом
            # (фикс для "avg_price_per avg_price_per_meter")
            sql = re.sub(r'\b(\w+)\s+\1\w*', r'\1', sql) 
            
            # Если после AS идет мусор из двух слов, оставляем последнее
            sql = re.sub(r'AS\s+\w+\s+(\w+)', r'AS \1', sql)

            # Чистим ANSI и переносы
            sql = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', sql)
            sql = ' '.join(sql.split()).replace('```sql', '').replace('```', '').strip()
            
            if ';' in sql:
                sql = sql.split(';')[0] + ';'
            else:
                sql += ';'

            # Лечим частый деградирующий ответ модели: "SELECT LIMIT 1000;"
            if re.match(r'^\s*SELECT\s+LIMIT\s+\d+\s*;?\s*$', sql, flags=re.IGNORECASE):
                limit_match = re.search(r'LIMIT\s+(\d+)', sql, flags=re.IGNORECASE)
                limit_value = limit_match.group(1) if limit_match else "1000"
                sql = f"SELECT * FROM orders LIMIT {limit_value};"

            validation = validate_sql(sql)
            if not validation["safe"]:
                fallback_sql = self._build_fallback_sql(user_query)
                fallback_validation = validate_sql(fallback_sql)
                if fallback_validation["safe"]:
                    return {
                        "status": "success",
                        "sql": fallback_validation["sql"],
                        "fallback_used": True,
                        "fallback_reason": validation["reason"],
                    }
                return {"status": "error", "error": f"Security: {validation['reason']}", "sql": sql}

            # Возвращаем уже нормализованный SQL (например, с добавленным LIMIT).
            return {"status": "success", "sql": validation["sql"]}

        except Exception as e:
            return {"status": "error", "error": str(e)}
