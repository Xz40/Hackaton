import sqlite3
import psycopg2 # Для Postgres
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from pydantic import BaseModel
from sql_generator import SQLGenerator

# Инициализируем генератор
sql_gen = SQLGenerator(model_name="qwen2.5-coder:7b")

# --- 1. СИСТЕМНАЯ БД (SQLite) ---
SYSTEM_DB_URL = "sqlite:///./system.db"
system_engine = create_engine(SYSTEM_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=system_engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    requests_count = Column(Integer, default=0)

class QueryHistory(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String)
    question = Column(Text)
    sql_query = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=system_engine)

# --- 2. КОНФИГ POSTGRES (Аналитическая БД) ---
POSTGRES_CONFIG = {
    "dbname": "drivee_analytics",
    "user": "postgres",
    "password": "your_password",
    "host": "localhost",
    "port": "5432"
}

# --- МОДЕЛИ И API ---
class QuestionRequest(BaseModel):
    user_id: str
    question: str

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/ask")
async def ask_question(request: QuestionRequest, db: Session = Depends(get_db)):
    # 1. Генерируем SQL
    gen_result = sql_gen.generate(request.question)
    if gen_result["status"] == "error":
        return {"message": f"Ошибка: {gen_result['error']}", "sql": None}

    sql = gen_result["sql"]
    
    # 2. ИДЕМ В POSTGRES (а не в sqlite3!)
    try:
        conn = psycopg2.connect(
            dbname="drivee_analytics",
            user="postgres",
            password="postgres",
            host="localhost",
            port="5432"
        )
        cursor = conn.cursor()
        cursor.execute(sql)
        db_results = cursor.fetchall()
        
        if not db_results:
            msg = "Данные по вашему запросу не найдены."
        else:
            msg = f"Найдено строк: {len(db_results)}"
            
        cursor.close()
        conn.close()
    except Exception as e:
        msg = f"Ошибка выполнения в Postgres: {str(e)}"
        db_results = []

    # 3. ЛОГИРУЕМ В СИСТЕМНУЮ БД (SQLite остается для этого)
    new_log = QueryHistory(user_id=request.user_id, question=request.question, sql_query=sql)
    db.add(new_log)
    db.commit()

    return {"message": msg, "sql": sql, "data": db_results}
@app.get("/history")
async def get_history(user_id: str = None, db: Session = Depends(get_system_db)):
    query = db.query(QueryHistory)
    if user_id:
        query = query.filter(QueryHistory.user_id == user_id)
    return query.order_by(QueryHistory.id.desc()).limit(20).all()

@app.get("/stats")
async def get_stats(user_id: str, db: Session = Depends(get_system_db)):
    user = db.query(User).filter(User.username == user_id).first()
    return {"requests_today": user.requests_count if user else 0}

@app.get("/databases")
async def get_dbs():
    # Показываем статус нашей основной Postgres базы
    return [{
        "name": "Drivee_Production_Postgres",
        "db_type": "PostgreSQL",
        "status": "Online"
    }]