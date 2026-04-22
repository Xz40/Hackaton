from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import database
import sql_generator
import sql_validator
from models import QueryRequest, QueryResponse

app = FastAPI(title="Drivee Analytics API")

# Настраиваем CORS, чтобы фронтенд мог достучаться
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # В продакшене замени на конкретный адрес
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/ask", response_model=QueryResponse)
async def process_question(request: QueryRequest):
    # 1. Генерируем SQL (пока по твоим шаблонам)
    sql = sql_generator.generate_sql(request.question)
    
    # 2. Валидируем SQL на безопасность
    validation = sql_validator.validate_sql(sql)
    if not validation["safe"]:
        raise HTTPException(status_code=400, detail=validation["reason"])
    
    safe_sql = validation["sql"]
    
    # 3. Выполняем запрос в БД
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
            message="Данные успешно получены"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка выполнения SQL: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)