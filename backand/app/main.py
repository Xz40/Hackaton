from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import database
import sql_generator
import sql_validator
from models import QueryRequest, QueryResponse

app = FastAPI(title="Drivee Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Инициализация таблиц в PostgreSQL при старте"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            # Таблица заказов (основная)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    city VARCHAR(100),
                    amount INT,
                    status VARCHAR(50),
                    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Таблица истории (для нового экрана History)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS query_history (
                    id SERIAL PRIMARY KEY,
                    question TEXT,
                    sql_query TEXT,
                    status VARCHAR(20),
                    query_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Проверка на пустую базу (синтаксис Postgres с RealDictCursor)
            cur.execute("SELECT COUNT(*) FROM orders")
            count_result = cur.fetchone()
            if count_result['count'] == 0:
                cur.execute("""
                    INSERT INTO orders (city, amount, status) 
                    VALUES (%s, %s, %s), (%s, %s, %s)
                """, ('Якутск', 450, 'completed', 'Москва', 1200, 'completed'))
                
        conn.commit()
        conn.close()
        print("✅ PostgreSQL: Таблицы проверены и готовы")
    except Exception as e:
        print(f"❌ Ошибка БД при старте: {e}")

@app.post("/ask", response_model=QueryResponse)
async def process_question(request: QueryRequest):
    # 1. Генерация
    sql = sql_generator.generate_sql(request.question)
    
    # 2. Валидация
    validation = sql_validator.validate_sql(sql)
    
    # 3. Логируем в историю (даже если запрос не безопасен)
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO query_history (question, sql_query, status) 
                VALUES (%s, %s, %s)
            """, (request.question, sql, "success" if validation["safe"] else "blocked"))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Ошибка сохранения истории: {e}")

    if not validation["safe"]:
        raise HTTPException(status_code=400, detail=validation["reason"])
    
    safe_sql = validation["sql"]
    
    # 4. Выполнение
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute(safe_sql)
            results = cur.fetchall()
        conn.close()
        
        return QueryResponse(
            question=request.question,
            sql=safe_sql,
            data=results,
            row_count=len(results),
            message="Данные получены"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка SQL: {str(e)}")

@app.get("/get_data")
async def get_data():
    """Для вкладки 'База данных'"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, city, amount, status FROM orders ORDER BY id DESC LIMIT 20")
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        return [{"id": "ERR", "city": "Ошибка БД", "amount": 0, "status": "error"}]

@app.get("/get_history")
async def get_history():
    """Для нового экрана 'History'"""
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, question, status, query_date FROM query_history ORDER BY query_date DESC LIMIT 50")
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)