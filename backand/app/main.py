import sqlite3
import psycopg2 
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from pydantic import BaseModel
from sql_generator import SQLGenerator
import re

# Инициализируем генератор
sql_gen = SQLGenerator(model_name="qwen2.5-coder:7b")

# --- 1. СИСТЕМНАЯ БД (SQLite для истории) ---
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

class QuestionRequest(BaseModel):
    user_id: str
    question: str

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def get_system_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def extract_sql_from_garbage(text):
    """Вырезает только SQL из болтовни модели"""
    if not text: return ""
    # Убираем ANSI коды (цвета терминала)
    text = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', text)
    # Ищем блок SELECT ... ; (флаг IGNORECASE важен)
    match = re.search(r"(SELECT[\s\S]+?;?)", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text.strip()

@app.post("/ask")
async def ask_question(request: QuestionRequest, db: Session = Depends(get_system_db)):
    # 1. Генерируем ответ (может быть с мусором)
    gen_result = sql_gen.generate(request.question)
    
    if gen_result.get("status") == "error":
        return {"message": f"Ошибка LLM: {gen_result.get('error')}", "sql": None, "data": []}

    # 2. Вытаскиваем SQL
    raw_response = gen_result.get("sql", "")
    sql = extract_sql_from_garbage(raw_response)
    
    # 3. Исполнение в Postgres (Drivee Analytics)
    db_results = []
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
        
        msg = f"Найдено строк: {len(db_results)}" if db_results else "Данные по запросу отсутствуют."
        cursor.close()
        conn.close()
    except Exception as e:
        msg = f"Ошибка базы: {str(e)}"

    # 4. Сохраняем в историю
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
    return [{"name": "Drivee_Postgres_Main", "db_type": "PostgreSQL", "status": "Online"}]