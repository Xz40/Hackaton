# sql_validator.py
import re

# Команды, которые категорически запрещены
DANGEROUS_KEYWORDS = [
    'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 
    'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'REPLACE'
]

# Список разрешенных таблиц (только те, что есть в Drivee контексте)
ALLOWED_TABLES = ['orders']

def validate_sql(sql: str) -> dict:
    """
    Проверяет SQL на безопасность и корректность.
    """
    sql_clean = sql.strip()
    sql_upper = sql_clean.upper()
    
    # 1. Проверка на опасные ключевые слова
    for word in DANGEROUS_KEYWORDS:
        # Используем регулярку, чтобы не затриггерить на словах внутри других слов
        if re.search(rf"\b{word}\b", sql_upper):
            return {
                "safe": False, 
                "reason": f"В запросе обнаружена запрещенная команда: {word}",
                "sql": None
            }
    
    # 2. Только SELECT запросы
    if not sql_upper.startswith('SELECT'):
        return {
            "safe": False, 
            "reason": "Разрешены только запросы на чтение данных (SELECT)",
            "sql": None
        }

    # 3. Наличие LIMIT (защита от выгрузки миллионов строк)
    if 'LIMIT' not in sql_upper:
        # Добавляем LIMIT, если его нет
        sql_clean = sql_clean.rstrip(';') + " LIMIT 1000"
    else:
        # Проверяем, чтобы LIMIT не был слишком огромным
        limit_match = re.search(r'LIMIT\s+(\d+)', sql_upper)
        if limit_match and int(limit_match.group(1)) > 5000:
            sql_clean = re.sub(r'LIMIT\s+\d+', 'LIMIT 5000', sql_clean, flags=re.IGNORECASE)

    return {
        "safe": True, 
        "reason": "Запрос прошел проверку безопасности",
        "sql": sql_clean
    }