from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import database
import sql_generator
import sql_validator
from models import QueryRequest, QueryResponse
import os

app = FastAPI(title="Drivee Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Проверка и создание таблиц при старте"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            # Таблица заказов
            cur.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    city VARCHAR(100),
                    amount DECIMAL(10, 2),
                    status VARCHAR(50),
                    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Таблица истории с user_id и row_count
            cur.execute("""
                CREATE TABLE IF NOT EXISTS query_history (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    question TEXT NOT NULL,
                    sql_query TEXT,
                    status VARCHAR(50),
                    row_count INTEGER,
                    query_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        conn.commit()
        conn.close()
        print("✅ База данных готова к работе")
    except Exception as e:
        print(f"❌ Ошибка БД при старте: {e}")

@app.post("/ask", response_model=QueryResponse)
async def process_question(request: QueryRequest):
    # 1. Генерация SQL
    sql = sql_generator.generate_sql(request.question)
    
    # 2. Валидация
    validation = sql_validator.validate_sql(sql)
    
    if not validation["safe"]:
        # Логируем заблокированный запрос
        save_to_history(request.user_id, request.question, sql, "blocked", 0)
        raise HTTPException(status_code=400, detail=validation["reason"])
    
    safe_sql = validation["sql"]
    
    # 3. Выполнение запроса
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute(safe_sql)
            results = cur.fetchall()
        conn.close()
        
        # 4. Сохранение успешного запроса в историю
        save_to_history(request.user_id, request.question, safe_sql, "success", len(results))
        
        return QueryResponse(
            question=request.question,
            sql=safe_sql,
            data=results,
            row_count=len(results),
            message="Данные успешно получены"
        )
    except Exception as e:
        save_to_history(request.user_id, request.question, safe_sql, "error", 0)
        raise HTTPException(status_code=500, detail=f"Ошибка SQL: {str(e)}")

def save_to_history(user_id, question, sql, status, row_count):
    """Вспомогательная функция для записи в БД"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO query_history (user_id, question, sql_query, status, row_count) 
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, question, sql, status, row_count))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ Ошибка записи в историю: {e}")

@app.get("/get_history")
async def get_history(user_id: str):
    """Получение личной истории пользователя"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT question, query_date, status, row_count 
                FROM query_history 
                WHERE user_id = %s 
                ORDER BY query_date DESC
            """, (user_id,))
            history = cur.fetchall()
        conn.close()
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_data")
async def get_data():
    """Для вкладки просмотра базы"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, city, amount, status FROM orders ORDER BY id DESC LIMIT 20")
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)