from .semantic import enrich_question

def generate_sql(question: str) -> str:
    """
    Пока простые шаблоны. Потом заменим на LLM или fine-tuned модель.
    """
    q = question.lower()
    
    if "отмены" in q and "город" in q:
        return "SELECT city, COUNT(*) as cancellations FROM orders WHERE status = 'cancelled' GROUP BY city ORDER BY cancellations DESC"
    
    if "продажи" in q and "город" in q:
        return "SELECT city, SUM(amount) as revenue, COUNT(*) as orders FROM orders GROUP BY city ORDER BY revenue DESC"
    
    if "месяц" in q or "динамика" in q:
        return "SELECT DATE_TRUNC('month', order_date) as month, SUM(amount) as revenue FROM orders GROUP BY month ORDER BY month DESC"
    
    return "SELECT * FROM orders LIMIT 100"