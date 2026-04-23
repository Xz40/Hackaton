import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

# Путь к Ollama (используем имя текущего пользователя)
try:
    USER_NAME = os.getlogin()
except:
    USER_NAME = "User" # Фолбэк, если getlogin не сработал

OLLAMA_PATH = rf"C:\Users\{USER_NAME}\AppData\Local\Programs\Ollama\ollama.exe"

class SQLGenerator:
    def __init__(self, model_name="qwen2.5-coder:7b"):
        self.model_name = model_name

    def _get_system_prompt(self):
        # Подтягиваем контекст из твоего semantic.py
        semantic_info = get_semantic_context()
        
        return f"""Ты — эксперт по PostgreSQL. Твоя задача — переводить вопросы пользователя в SQL-запросы к таблице 'orders'.

### СТРУКТУРА ТАБЛИЦЫ 'orders':
- order_id (int): уникальный ID заказа
- city_id (int): ID города
- status_order (text): статус заказа
- order_timestamp (timestamp): время заказа
- distance_in_meters (float): дистанция
- duration_in_seconds (int): время в пути
- price_order_local (float): цена заказа (выручка)

### СЛОВАРЬ СТАТУСОВ (ВАЖНО):
- Если пользователь говорит "завершенный", "успешный", "продажа", "выполнен" -> используй status_order = 'done'
- Если пользователь говорит "отмененный" -> используй status_order = 'cancel'
- Если пользователь говорит "удаленный" -> используй status_order = 'delete'
- Если пользователь говорит "принятый" -> используй status_order = 'accept'

### ПРАВИЛА:
1. Пиши ТОЛЬКО чистый SQL-код для PostgreSQL. Без пояснений, без кавычек ```sql.
2. ЗАПРЕЩЕНО использовать ANSI escape-коды (\u001b), управляющие символы или форматирование терминала.
3. По умолчанию (если не указано иное) фильтруй по status_order = 'done'.
4. Ограничивай выборку (LIMIT 1000).
5. Для расчета выручки используй SUM(price_order_local).

МЕТРИКИ ИЗ СЕМАНТИКИ: {semantic_info}"""

    def generate(self, user_query: str) -> dict:
        # Улучшаем вопрос через твой семантический слой
        enriched_query = enrich_question(user_query)
        
        system_prompt = self._get_system_prompt()
        full_prompt = f"{system_prompt}\n\nВопрос пользователя: {enriched_query}\nSQL:"

        # Запуск Ollama
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

            # 1. Получаем сырой текст
            raw_output = result.stdout.strip()
            
            # 2. Очистка от ANSI-мусора (те самые \u001b[5D)
            clean_sql = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', raw_output)
            
            # 3. Убираем блоки кода Markdown, если модель их добавила
            clean_sql = re.sub(r'```sql|```', '', clean_sql).strip()
            
            # 4. Берем только первую часть до точки с запятой
            clean_sql = clean_sql.split(';')[0] + ';' if ';' in clean_sql else clean_sql
            
            # 5. Убираем лишние переносы строк для чистоты
            clean_sql = clean_sql.replace('\n', ' ').replace('\r', ' ').strip()

            # 6. Проверка безопасности через твой sql_validator.py
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
                "explanation": f"Запрос сформирован для PostgreSQL (используется статус 'done')."
            }

        except Exception as e:
            return {"status": "error", "error": f"Ошибка вызова Ollama: {str(e)}"}

# Мини-тест для проверки в консоли
if __name__ == "__main__":
    generator = SQLGenerator()
    test_query = "покажи продажи по городам"
    print(f"Тестовый запрос: {test_query}")
    print(generator.generate(test_query))