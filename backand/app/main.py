from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .database import get_db_connection
from .models import QueryRequest, QueryResponse
from .sql_generator import generate_sql
from .sql_validator import validate_sql

app = FastAPI(title="Drivee SQL Assistant", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "online", "product": "Drivee SQL Assistant"}

@app.get("/health")
def health():
    try:
        conn = get_db_connection()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}

@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    if not req.question or len(req.question.strip()) < 3:
        raise HTTPException(status_code=400, detail="Вопрос слишком короткий")
    
    sql = generate_sql(req.question)
    
    validation = validate_sql(sql)
    if not validation["safe"]:
        raise HTTPException(status_code=400, detail=validation["reason"])
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(validation["sql"])
        data = cur.fetchall()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка БД: {str(e)}")
    
    return QueryResponse(
        question=req.question,
        sql=sql,
        data=data[:100],
        row_count=len(data),
        message=f"Найдено {len(data)} записей"
    )