import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

# Путь к Ollama
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
        return f"""Ты — SQL-ассистент Drivee. Твоя задача: переводить вопросы в SQL для PostgreSQL.

### ТАБЛИЦА: 'orders'
### ПРАВИЛА:
1. Пиши ТОЛЬКО чистый SQL-код. Без пояснений.
2. Используй только таблицу 'orders'.
3. Всегда добавляй LIMIT 1000.
4. СТРОГО следуй формулам и условиям из семантического контекста ниже.
5. Если в контексте указано 'done', используй 'done'. Не выдумывай другие статусы.

### СЕМАНТИЧЕСКИЙ КОНТЕКСТ (ШПАРГАЛКА):
{semantic_info}"""

    def generate(self, user_query: str) -> dict:
        # Семантика теперь добавляет: "вопрос (Технические подсказки: выручка -> SUM(...))"
        enriched_query = enrich_question(user_query)
        
        system_prompt = self._get_system_prompt()
        full_prompt = f"{system_prompt}\n\nВопрос: {enriched_query}\nSQL:"

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
            
            # --- ЧИСТКА ---
            # 1. Убираем ANSI мусор терминала
            sql = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', sql)
            
            # 2. Убираем Markdown
            sql = re.sub(r'```sql|```', '', sql).strip()

            # 3. Находим SELECT (отрезаем болтовню модели в начале)
            match = re.search(r'SELECT', sql, re.IGNORECASE)
            if match:
                sql = sql[match.start():]
            else:
                # Если SELECT потерян, но есть AVG/SUM/COUNT — восстанавливаем
                if any(x in sql.upper() for x in ["AVG", "SUM", "COUNT", "ORDER_ID"]):
                    sql = "SELECT " + sql

            # 4. ФИКС ЗАИКАНИЙ (NULLIF NULLIF -> NULLIF)
            sql = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', sql)
            
            # 5. Склеивание строк и точка с запятой
            sql = ' '.join(sql.split())
            if ';' in sql:
                sql = sql.split(';')[0] + ';'
            else:
                sql += ';'

            # 6. Валидация
            validation = validate_sql(sql)
            if not validation["safe"]:
                return {"status": "error", "error": f"Security: {validation['reason']}", "sql": sql}

            return {
                "status": "success",
                "sql": sql,
                "explanation": "Запрос построен на основе обновленной семантики."
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    gen = SQLGenerator()
    # Тестируем тот самый сложный запрос
    print(gen.generate("Какая средняя дистанция и цена за метр в городе 67?"))