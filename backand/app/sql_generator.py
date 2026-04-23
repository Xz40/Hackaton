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
        semantic_info = get_semantic_context()
        return f"""Ты — эксперт по PostgreSQL. Пиши ТОЛЬКО чистый SQL.
        
СХЕМА: Таблица 'orders' (city_id, status_order, price_order_local, distance_in_meters, duration_in_seconds).
СТАТУСЫ: Успешный заказ = 'done'.

ПРАВИЛА:
1. Никаких пояснений. Только SELECT запрос.
2. Не повторяй слова. Не используй ANSI символы.
3. Если считаешь цену за метр: price_order_local / NULLIF(distance_in_meters, 0).
4. Всегда добавляй LIMIT 1000.
5. СТРОГО: статус всегда 'done', если не просят иное.

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

            raw_output = result.stdout.strip()
            
            # --- БЛОК ЖЕСТКОЙ ОЧИСТКИ ---
            # 1. Убираем ANSI-мусор (\u001b и прочее)
            clean_sql = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', raw_output)
            
            # 2. Убираем Markdown блоки
            clean_sql = re.sub(r'```sql|```', '', clean_sql).strip()
            
            # 3. Фикс "заикания" модели (убираем обрывки слов типа 'dis distance')
            # Ищем паттерн: пробел + короткое слово (2-3 буквы) + пробел + слово, которое начинается так же
            clean_sql = re.sub(r'\b(\w{2,3})\s+(\1\w+)', r'\2', clean_sql)
            
            # 4. Убираем лишние пробелы и переносы
            clean_sql = clean_sql.replace('\n', ' ').replace('\r', ' ')
            clean_sql = re.sub(r'\s+', ' ', clean_sql).strip()
            
            # 5. Берем только запрос до точки с запятой
            if ';' in clean_sql:
                clean_sql = clean_sql.split(';')[0] + ';'

            # Валидация
            validation = validate_sql(clean_sql)
            if not validation["safe"]:
                return {"status": "error", "error": f"Безопасность: {validation['reason']}", "sql": clean_sql}

            return {
                "status": "success",
                "sql": validation["sql"],
                "explanation": "Запрос очищен от артефактов генерации."
            }

        except Exception as e:
            return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    generator = SQLGenerator()
    print(generator.generate("Топ 5 городов по среднему чеку"))