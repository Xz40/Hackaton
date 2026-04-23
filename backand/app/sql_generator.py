import subprocess
import re
import os
from sql_validator import validate_sql
from semantic import get_semantic_context, enrich_question

# Определяем путь к Ollama
try:
    USER_NAME = os.getlogin()
except:
    USER_NAME = "User"

OLLAMA_PATH = rf"C:\Users\{USER_NAME}\AppData\Local\Programs\Ollama\ollama.exe"

class SQLGenerator:
    def __init__(self, model_name="qwen2.5-coder:7b"):
        self.model_name = model_name

    def _get_system_prompt(self):
        # Подтягиваем контекст из твоего аналитического слоя
        semantic_info = get_semantic_context()
        
        return f"""Ты — эксперт по PostgreSQL. Твоя задача — переводить вопросы в SQL-запросы к таблице 'orders'.

### СТРУКТУРА ТАБЛИЦЫ 'orders':
- city_id (int), order_id (int), status_order (text)
- order_timestamp (timestamp), distance_in_meters (float)
- price_order_local (float) - это выручка/цена заказа.

### ПРАВИЛА ПО СТАТУСАМ:
- Завершенный заказ/Продажа ВСЕГДА: status_order = 'done' (ЗАБУДЬ про 'finished')
- Отмененный заказ: status_order = 'cancel'

### ТЕХНИЧЕСКИЕ ПРАВИЛА:
1. Пиши ТОЛЬКО чистый SQL-код для PostgreSQL. Без пояснений.
2. Цена за метр: price_order_local / NULLIF(distance_in_meters, 0).
3. ЗАПРЕЩЕНО использовать ANSI escape-коды (\u001b) или форматирование терминала.
4. Всегда добавляй LIMIT 1000.

МЕТРИКИ: {semantic_info}"""

    def generate(self, user_query: str) -> dict:
        # Улучшаем вопрос через семантику
        enriched_query = enrich_question(user_query)
        
        system_prompt = self._get_system_prompt()
        full_prompt = f"{system_prompt}\n\nВопрос пользователя: {enriched_query}\nSQL:"

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

            # --- МНОГОУРОВНЕВАЯ ОЧИСТКА ---
            raw_sql = result.stdout.strip()
            
            # 1. Удаляем ANSI-мусор (управляющие символы терминала)
            sql = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', raw_output if 'raw_output' in locals() else raw_sql)
            
            # 2. Удаляем Markdown кавычки ```sql
            sql = re.sub(r'```sql|```', '', sql).strip()

            # 3. ХИРУРГИЯ: Отрезаем всё, что идет ДО слова SELECT (убирает болтовню модели)
            match = re.search(r'SELECT', sql, re.IGNORECASE)
            if match:
                sql = sql[match.start():]
            else:
                return {"status": "error", "error": "Модель не сгенерировала SELECT запрос", "raw": sql}

            # 4. ФИКС ЗАИКАНИЯ: Убираем повторы слов (например, "NULLIF(dist dist")
            sql = re.sub(r'\b(\w+)(?:\s+\1\b)+', r'\1', sql)
            
            # 5. ФИКС СКЛЕЕК: Удаляем обрывки слов перед ключевыми командами (mete NULLIF -> NULLIF)
            sql = re.sub(r'\w{2,}\s+(NULLIF|SELECT|FROM|WHERE|GROUP|ORDER|AVG|SUM|COUNT|AS)', r' \1', sql)

            # 6. Принудительная замена 'finished' на 'done' (наша страховка)
            sql = sql.replace("'finished'", "'done'")
            
            # 7. Финальная сборка в одну чистую строку
            sql = ' '.join(sql.split())
            if ';' in sql:
                sql = sql.split(';')[0] + ';'

            # 8. Проверка безопасности
            validation = validate_sql(sql)
            if not validation["safe"]:
                return {
                    "status": "error", 
                    "error": f"Безопасность: {validation['reason']}", 
                    "sql": sql
                }

            return {
                "status": "success",
                "sql": sql,
                "explanation": "Запрос очищен и готов к выполнению в PostgreSQL."
            }

        except Exception as e:
            return {"status": "error", "error": f"Ошибка: {str(e)}"}

# Тест-драйв
if __name__ == "__main__":
    gen = SQLGenerator()
    print(gen.generate("средняя цена за метр в городе 67"))