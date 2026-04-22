import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

# Путь, который ты нашел (используем f-строку для подстановки имени пользователя)
USER_NAME = os.getlogin()
OLLAMA_PATH = rf"C:\Users\{USER_NAME}\AppData\Local\Programs\Ollama\ollama.exe"

# Структура из твоего notes.md
DB_SCHEMA = """
Таблица: orders
Колонки: 
- city_id, order_id, status_order (finished, cancelled)
- order_timestamp (datetime), distance_in_meters, duration_in_seconds
- price_order_local (цена/выручка)
"""

class SQLGenerator:
    def __init__(self, model_name="qwen2.5-coder:7b"):
        self.model_name = model_name

    def _get_system_prompt(self):
        # Подтягиваем контекст из твоего semantic.py
        semantic_info = get_semantic_context()
        return f"""Ты аналитик Drivee. Пиши ТОЛЬКО SQL запрос для SQLite. 
СХЕМА: {DB_SCHEMA}
МЕТРИКИ: {semantic_info}
ПРАВИЛО: Только SELECT. Только чистый код без кавычек. По умолчанию status_order='finished'."""

    def generate(self, user_query: str) -> dict:
        # 1. Применяем семантическое обогащение
        enriched_query = enrich_question(user_query)
        
        # 2. Формируем команду для запуска
        # Мы передаем промпт как аргумент. Если промпт слишком длинный, 
        # лучше использовать ввод через stdin, но для SQL этого хватит.
        full_prompt = f"{self._get_system_prompt()}\nВопрос: {enriched_query}"
        
        command = [OLLAMA_PATH, "run", self.model_name, full_prompt]

        try:
            # Запускаем процесс
            result = subprocess.run(
                command, 
                capture_output=True, 
                text=True, 
                encoding='utf-8',
                errors='ignore'
            )
            
            if result.returncode != 0:
                return {"status": "error", "error": f"Ollama error: {result.stderr}"}

            # 3. Очистка ответа (модели иногда добавляют пояснения)
            raw_output = result.stdout.strip()
            # Убираем блоки кода Markdown
            clean_sql = re.sub(r'```sql|```', '', raw_output).strip()
            # Берем только первую часть до точки с запятой, если модель начала болтать
            clean_sql = clean_sql.split(';')[0] + ';' if ';' in clean_sql else clean_sql

            # 4. Проверка безопасности через твой sql_validator.py
            validation = validate_sql(clean_sql)

            if not validation["safe"]:
                return {
                    "status": "error", 
                    "error": f"Безопасность: {validation['reason']}", 
                    "sql": clean_sql
                }

            return {
                "status": "success",
                "sql": validation["sql"],
                "explanation": f"Запрос сформирован локальной моделью {self.model_name}."
            }

        except Exception as e:
            return {"status": "error", "error": f"Ошибка вызова Ollama: {str(e)}"}

# Мини-тест
if __name__ == "__main__":
    generator = SQLGenerator()
    # Перед запуском убедись, что сделал: ollama run qwen2.5-coder:7b
    print(generator.generate("Какая средняя выручка в Якутске?"))