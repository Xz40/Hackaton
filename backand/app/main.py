import sqlite3
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from pydantic import BaseModel
from typing import List
from sql_generator import SQLGenerator

# Инициализируем генератор
sql_gen = SQLGenerator(model_name="qwen2.5-coder:7b")

# СЛУЖЕБНАЯ БД
SYSTEM_DB_URL = "sqlite:///./system.db"
engine = create_engine(SYSTEM_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# МОДЕЛИ ТАБЛИЦ
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

class ConnectedDB(Base):
    __tablename__ = "connected_dbs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    db_type = Column(String)
    status = Column(String, default="Online")

Base.metadata.create_all(bind=engine)

class QuestionRequest(BaseModel):
    user_id: str
    question: str

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    
    # 2. Выполняем SQL (в реальной БД заказов)
    try:
        # Здесь подключаемся к твоей БД заказов (orders.db)
        with sqlite3.connect("orders.db") as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            db_results = cursor.fetchall()
            
            if not db_results:
                msg = "Данные по вашему запросу не найдены."
            else:
                msg = f"Нашел данные: {db_results[0][0]}" if len(db_results) == 1 else f"Найдено строк: {len(db_results)}"
    except Exception as e:
        msg = f"Ошибка выполнения SQL: {str(e)}"
        db_results = []

    # 3. Логируем в системную БД
    new_log = QueryHistory(user_id=request.user_id, question=request.question, sql_query=sql)
    db.add(new_log)
    
    user = db.query(User).filter(User.username == request.user_id).first()
    if not user:
        user = User(username=request.user_id, requests_count=1)
        db.add(user)
    else:
        user.requests_count += 1
    
    db.commit()
    return {"message": msg, "sql": sql, "data": db_results}

@app.get("/history")
async def get_history(user_id: str = None, db: Session = Depends(get_db)):
    query = db.query(QueryHistory)
    if user_id:
        query = query.filter(QueryHistory.user_id == user_id)
    return query.order_by(QueryHistory.id.desc()).limit(20).all()

@app.get("/databases")
async def get_dbs(db: Session = Depends(get_db)):
    dbs = db.query(ConnectedDB).all()
    if not dbs:
        return [{"name": "Drivee_Orders_SQLite", "db_type": "SQLite", "status": "Online"}]
    return dbs

@app.get("/stats")
async def get_stats(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_id).first()
    return {"requests_today": user.requests_count if user else 0}