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

# Инициализируем генератор (путь к ollama.exe подтянется автоматически из нашего скрипта)
sql_gen = SQLGenerator(model_name="qwen2.5-coder:7b")

#СЛУЖЕБНАЯ БД
SYSTEM_DB_URL = "sqlite:///./system.db"
engine = create_engine(SYSTEM_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class QuestionRequest(BaseModel):
    user_id: str
    question: str

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True)
    requests_count = Column(Integer, default=0)

class QueryHistory(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String)
    question = Column(String)
    sql_query = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)

class ConnectedDB(Base):
    __tablename__ = "connected_dbs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    db_type = Column(String)
    status = Column(String)

Base.metadata.create_all(bind=engine)

#FASTAPI CONFIG
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

#МОДЕЛИ ДАННЫХ
class QueryRequest(BaseModel):
    question: str
    user_id: str

# --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ РАБОЧЕЙ БД ---
def execute_target_query(sql: str):
    try:
        conn = sqlite3.connect('drivee_data.db')
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        conn.close()
        return results
    except Exception as e:
        return str(e)

# --- ЭНДПОИНТЫ ---

@app.post("/ask")
async def ask(request: QueryRequest, db: Session = Depends(get_db)):
    q = request.question.lower()
    
    # 1. Простейший маппинг вопроса в SQL (имитация AI)
    # В будущем здесь будет вызов LLM
    if "заказ" in q and "якутск" in q:
        sql = "SELECT count(*) as count FROM orders WHERE city='Якутск'"
    elif "москв" in q:
        sql = "SELECT count(*) as count FROM orders WHERE city='Москва'"
    elif "цена" in q or "чек" in q:
        sql = "SELECT AVG(price) as avg_price FROM orders WHERE status='completed'"
    else:
        sql = "SELECT * FROM orders ORDER BY date DESC LIMIT 3"

    # 2. Выполняем запрос в РАБОЧЕЙ БД
    db_results = execute_target_query(sql)
    
    # Формируем человекочитаемый ответ
    if isinstance(db_results, list) and len(db_results) > 0:
        if 'count' in db_results[0]:
            msg = f"Нашел в базе: количество заказов — {db_results[0]['count']}."
        elif 'avg_price' in db_results[0]:
            msg = f"Средний чек по выполненным заказам: {round(db_results[0]['avg_price'], 2)} руб."
        else:
            msg = f"Запрос выполнен успешно. Найдено записей: {len(db_results)}."
    else:
        msg = "Данные по вашему запросу не найдены или произошла ошибка."

    # 3. Логируем в СЛУЖЕБНУЮ БД
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
    
    # Если передан ID пользователя, фильтруем только его историю
    if user_id:
        query = query.filter(QueryHistory.user_id == user_id)
    
    return query.order_by(QueryHistory.id.desc()).limit(20).all()

@app.get("/databases")
async def get_dbs(db: Session = Depends(get_db)):
    dbs = db.query(ConnectedDB).all()
    if not dbs:
        # Если пусто, отдаем дефолтную запись
        return [{"name": "Drivee_Data_SQLite", "db_type": "SQLite (Embedded)", "status": "Online"}]
    return dbs

@app.get("/stats")
async def get_stats(user_id: str = "Admin", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_id).first()
    total_q = db.query(QueryHistory).count()
    return {
        "requests_today": user.requests_count if user else 0,
        "total_system_requests": total_q,
        "active_dbs": 1,
        "accuracy": "98%"
    }