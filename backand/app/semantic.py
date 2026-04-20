# Словарь бизнес-терминов
METRICS = {
    "отмены": "COUNT(CASE WHEN status = 'cancelled' THEN 1 END)",
    "выручка": "SUM(amount)",
    "продажи": "SUM(amount)",
    "количество заказов": "COUNT(*)",
    "средний чек": "AVG(amount)",
}

FILTERS = {
    "прошлая неделя": "order_date >= CURRENT_DATE - INTERVAL '7 days'",
    "прошлый месяц": "order_date >= CURRENT_DATE - INTERVAL '30 days'",
}

def enrich_question(question: str) -> str:
    enriched = question
    for term in METRICS:
        if term in question.lower():
            enriched += f" (подсказка: {term} = {METRICS[term]})"
    return enriched