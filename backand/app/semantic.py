# semantic.py

# Словарь метрик на основе колонок из notes.md
METRICS = {
    "выручка": "SUM(price_order_local)",
    "доход": "SUM(price_order_local)",
    "количество заказов": "COUNT(order_id)",
    "число поездок": "COUNT(order_id)",
    "средний чек": "AVG(price_order_local)",
    "среднее расстояние": "AVG(distance_in_meters)",
    "отмены": "COUNT(CASE WHEN status_order = 'cancel' THEN 1 END)", # Исправлено на 'cancel'
    "длительность": "SUM(duration_in_seconds) / 60", # перевод в минуты
    "средняя цена за метр": "AVG(price_order_local / NULLIF(distance_in_meters, 0))" # Добавил для удобства
}

# Словарь стандартных фильтров (Синхронизировано с notes.md)
FILTERS = {
    "успешные": "status_order = 'done'",    # Было 'finished', стало 'done'
    "завершенные": "status_order = 'done'", # Было 'finished', стало 'done'
    "отмененные": "status_order = 'cancel'", # Конкретный статус из notes.md
    "якутск": "city_id = 67", # Поставил 67, раз он у тебя в логах светится
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
    
    # Проверка на наличие метрик
    for term in METRICS:
        if term in q:
            hints.append(f"{term} -> {METRICS[term]}")
    
    # Проверка на наличие фильтров (чтобы модель не писала 'finished')
    for term in FILTERS:
        if term in q:
            hints.append(f"для '{term}' используй {FILTERS[term]}")
    
    if hints:
        return f"{question} (Технические подсказки: {', '.join(hints)})"
    return question