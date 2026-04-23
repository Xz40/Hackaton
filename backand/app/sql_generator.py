import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

USER_NAME = os.getlogin()
OLLAMA_PATH = rf"C:\Users\{USER_NAME}\AppData\Local\Programs\Ollama\ollama.exe"

class SQLGenerator:
    def __init__(self, model_name="qwen2.5-coder:7b"):
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

    def generate(self, user_query: str) -> dict:
        enriched_query = enrich_question(user_query)
        
        # Просим писать в одну строку — это сильно снижает риск заикания
        full_prompt = f"{self._get_system_prompt()}\nQuestion: {enriched_query}\nWrite SQL in ONE LINE:\nSQL:"

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
            
            if ';' in sql: sql = sql.split(';')[0] + ';'
            else: sql += ';'

            validation = validate_sql(sql)
            if not validation["safe"]:
                return {"status": "error", "error": f"Security: {validation['reason']}", "sql": sql}

            return {"status": "success", "sql": sql}

        except Exception as e:
            return {"status": "error", "error": str(e)}