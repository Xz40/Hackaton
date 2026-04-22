# semantic.py

# Словарь метрик на основе колонок из notes.md
METRICS = {
    "выручка": "SUM(price_order_local)",
    "доход": "SUM(price_order_local)",
    "количество заказов": "COUNT(order_id)",
    "число поездок": "COUNT(order_id)",
    "средний чек": "AVG(price_order_local)",
    "среднее расстояние": "AVG(distance_in_meters)",
    "отмены": "COUNT(CASE WHEN status_order != 'finished' THEN 1 END)",
    "длительность": "SUM(duration_in_seconds) / 60", # перевод в минуты
}

# Словарь стандартных фильтров
FILTERS = {
    "успешные": "status_order = 'finished'",
    "завершенные": "status_order = 'finished'",
    "отмененные": "status_order != 'finished'",
    "якутск": "city_id = 1", # пример, если Якутск имеет ID 1
}

def get_semantic_context():
    """Возвращает текстовое описание для промпта LLM"""
    context = "Правила расчета метрик:\n"
    for name, formula in METRICS.items():
        context += f"- {name} рассчитывается как {formula}\n"
    
    context += "\nСтандартные фильтры:\n"
    for name, condition in FILTERS.items():
        context += f"- Для '{name}' используй условие {condition}\n"
    return context

def enrich_question(question: str) -> str:
    """Добавляет подсказки к вопросу перед отправкой в модель"""
    q = question.lower()
    hints = []
    for term in METRICS:
        if term in q:
            hints.append(f"{term} -> {METRICS[term]}")
    
    if hints:
        return f"{question} (Технические подсказки: {', '.join(hints)})"
    return question