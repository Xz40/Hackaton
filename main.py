# main.py - FastAPI сервер для Drivee
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn
import os

# ========== ИНИЦИАЛИЗАЦИЯ ==========
app = FastAPI(
    title="Drivee SQL Assistant",
    description="Превращает вопросы на русском в SQL и данные",
    version="1.0.0"
)

# Разрешаем запросы с любых источников (для демки)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========== МОДЕЛИ ДАННЫХ ==========
class QueryRequest(BaseModel):
    question: str
    user_id: str


class QueryResponse(BaseModel):
    question: str
    sql: str
    data: List[Dict[str, Any]]
    row_count: int
    message: str


# ========== ВРЕМЕННАЯ ЗАГЛУШКА (пока нет БД и LLM) ==========
# Позже заменим на реальные: PostgreSQL + Ollama

MOCK_DATA = [
    {"city": "Москва", "orders": 150, "revenue": 4500000},
    {"city": "СПб", "orders": 89, "revenue": 2670000},
    {"city": "Казань", "orders": 45, "revenue": 1350000},
    {"city": "Новосибирск", "orders": 38, "revenue": 1140000},
]


def mock_generate_sql(question: str) -> str:
    """Заглушка для генерации SQL"""
    if "отмены" in question.lower():
        return "SELECT city, COUNT(*) as cancellations FROM orders WHERE status = 'cancelled' GROUP BY city"
    if "продажи" in question.lower() or "выручка" in question.lower():
        return "SELECT city, SUM(amount) as revenue, COUNT(*) as orders FROM orders GROUP BY city ORDER BY revenue DESC"
    return "SELECT city, COUNT(*) as orders, SUM(amount) as revenue FROM orders GROUP BY city"


def mock_execute_sql(sql: str) -> List[Dict[str, Any]]:
    """Заглушка для выполнения SQL"""
    return MOCK_DATA


# ========== ЭНДПОИНТЫ API ==========
@app.get("/")
def root():
    return {
        "status": "online",
        "product": "Drivee SQL Assistant",
        "version": "1.0.0",
        "endpoints": {
            "POST /query": "Отправить вопрос на русском",
            "GET /health": "Проверка состояния",
            "GET /status": "Статус сервера"
        }
    }


@app.get("/health")
def health():
    return {"status": "alive", "database": "mock", "llm": "mock"}

@app.get("/status")
def status():
    return {
        "server": "running!!!!",
        "mode": "development (mock data)",
        "ready_for": "PostgreSQL + Ollama"
    }


@app.post("/query", response_model=QueryResponse)
async def process_query(req: QueryRequest):
    """
    Основной эндпоинт: принимает вопрос на русском,
    возвращает SQL и данные
    """
    if not req.question or len(req.question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Вопрос слишком короткий")

    # Генерация SQL (пока заглушка)
    sql = mock_generate_sql(req.question)

    # Выполнение (пока заглушка)
    data = mock_execute_sql(sql)

    return QueryResponse(
        question=req.question,
        sql=sql,
        data=data,
        row_count=len(data),
        message=f"Найдено {len(data)} записей"
    )


# ========== ЗАПУСК ==========
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True  # Авто-перезагрузка при изменении кода
    )