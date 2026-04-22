from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import database
import sql_generator
import sql_validator
from models import QueryRequest, QueryResponse

app = FastAPI(title="Drivee Analytics API")

# Настраиваем CORS, чтобы фронтенд мог достучаться с любого устройства в сети
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Проверка подключения и создание таблицы, если её нет"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    city VARCHAR(100),
                    amount INT,
                    status VARCHAR(50),
                    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Проверим, пустая ли база, и добавим пару строк если надо
            cur.execute("SELECT COUNT(*) FROM orders")
            if cur.fetchone()['count'] == 0:
                cur.execute("INSERT INTO orders (city, amount, status) VALUES ('Якутск', 450, 'completed'), ('Москва', 1200, 'completed')")
        conn.commit()
        conn.close()
        print("✅ База данных готова к работе")
    except Exception as e:
        print(f"⚠️ Ошибка БД при старте: {e}")

@app.post("/ask", response_model=QueryResponse)
async def process_question(request: QueryRequest):
    # 1. Генерируем SQL на основе вопроса
    sql = sql_generator.generate_sql(request.question)
    
    # 2. Валидируем SQL на безопасность (убираем DROP, DELETE и т.д.)
    validation = sql_validator.validate_sql(sql)
    if not validation["safe"]:
        raise HTTPException(status_code=400, detail=validation["reason"])
    
    safe_sql = validation["sql"]
    print(f"🔍 Исполняю SQL: {safe_sql}") # Для отладки в терминале
    
    # 3. Выполняем запрос в БД
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute(safe_sql)
            results = cur.fetchall() # RealDictCursor вернет список словарей
        conn.close()
        
        return QueryResponse(
            question=request.question,
            sql=safe_sql,
            data=results,
            row_count=len(results),
            message="Аналитика успешно сформирована"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {str(e)}")

@app.get("/get_data")
async def get_data():
    """Эндпоинт для вкладки 'База данных' на фронте"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, city, amount, status FROM orders ORDER BY id DESC LIMIT 20")
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        print(f"Ошибка получения данных: {e}")
        # Заглушка для фронтенда, если PostgreSQL недоступен
        return [
            {"id": "DEMO-1", "city": "Якутск", "amount": 500, "status": "completed"},
            {"id": "DEMO-2", "city": "Иркутск", "amount": 350, "status": "completed"}
        ]

if __name__ == "__main__":
    import uvicorn
    # Запускаем на 8080 порту
    uvicorn.run(app, host="0.0.0.0", port=8080)