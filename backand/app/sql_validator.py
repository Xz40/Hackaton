import re

DANGEROUS_KEYWORDS = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'CREATE']

def validate_sql(sql: str, user_role: str = "analyst") -> dict:
    sql_upper = sql.upper()
    
    for word in DANGEROUS_KEYWORDS:
        if word in sql_upper:
            return {"safe": False, "reason": f"Опасная команда: {word}"}
    
    if user_role != "admin" and not sql_upper.strip().startswith('SELECT'):
        return {"safe": False, "reason": "Разрешены только SELECT запросы"}
    
    if 'LIMIT' not in sql_upper:
        sql += " LIMIT 1000"
    
    limit_match = re.search(r'LIMIT\s+(\d+)', sql_upper)
    if limit_match and int(limit_match.group(1)) > 10000:
        return {"safe": False, "reason": "Слишком большой LIMIT (макс 10000)"}
    
    return {"safe": True, "sql": sql}