import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

try:
    USER_NAME = os.getlogin()
except:
    USER_NAME = "User"

OLLAMA_PATH = rf"C:\Users\{USER_NAME}\AppData\Local\Programs\Ollama\ollama.exe"

class SQLGenerator:
    def __init__(self, model_name="qwen2.5-coder:7b"):
        self.model_name = model_name

    def _get_system_prompt(self):
        semantic_info = get_semantic_context()
        return f"""Ты — эксперт PostgreSQL. Пиши ТОЛЬКО чистый SQL код.
        
СХЕМА: orders (city_id, status_order, price_order_local, distance_in_meters).
ВАЖНО: Успешный статус ВСЕГДА 'done'. ЗАБУДЬ про 'finished'.

ПРАВИЛА:
1. Только один SELECT запрос. Без пояснений.
2. Цена за метр: price_order_local / NULLIF(distance_in_meters, 0).
3. Используй LIMIT 1000.

КОНТЕКСТ: {semantic_info}"""

    def generate(self, user_query: str) -> dict:
        enriched_query = enrich_question(user_query)
        system_prompt = self._get_system_prompt()
        full_prompt = f"{system_prompt}\nВопрос: {enriched_query}\nSQL:"

        command = [OLLAMA_PATH, "run", self.model_name, full_prompt]

        try:
            result = subprocess.run(
                command, 
                capture_output=True, 
                text=True, 
                encoding='utf-8',
                errors='ignore'
            )
            
            if result.returncode != 0:
                return {"status": "error", "error": f"Ollama error: {result.stderr}"}

            sql = result.stdout.strip()
            
            # --- СУПЕР-ОЧИСТКА ---
            # 1. Убираем ANSI мусор
            sql = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', sql)
            
            # 2. Убираем Markdown кавычки
            sql = re.sub(r'```sql|```', '', sql).strip()
            
            # 3. ФИКС ЗАИКАНИЯ: Убираем повторы слов (например, "NULLIF(dist dist")
            # Находит повторяющиеся куски слов и оставляет только один
            sql = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', sql)
            
            # 4. СПЕЦИАЛЬНЫЙ ФИКС для склеенных слов типа "mete NULLIF"
            # Если видим обрывок слова перед нормальной функцией - удаляем обрывок
            sql = re.sub(r'\w{2,}\s+(NULLIF|SELECT|FROM|WHERE|GROUP|ORDER|AVG|SUM|COUNT)', r' \1', sql)

            # 5. Принудительная замена 'finished' на 'done' (на всякий случай)
            sql = sql.replace("'finished'", "'done'")
            
            # 6. Схлопываем пробелы и переносы
            sql = ' '.join(sql.split())
            if ';' in sql:
                sql = sql.split(';')[0] + ';'

            # Валидация
            validation = validate_sql(sql)
            if not validation["safe"]:
                return {"status": "error", "error": f"Security: {validation['reason']}", "sql": sql}

            return {
                "status": "success",
                "sql": sql,
                "explanation": "SQL успешно очищен от артефактов генерации."
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    gen = SQLGenerator()
    print(gen.generate("цена за метр в городе 67"))