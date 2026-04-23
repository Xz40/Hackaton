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

# --- 1. СИСТЕМНАЯ БД (SQLite) ---
SYSTEM_DB_URL = "sqlite:///./system.db"
system_engine = create_engine(SYSTEM_DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=system_engine)
Base = declarative_base()

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

def extract_clean_sql(raw_text):
    """Вытаскивает только SQL, игнорируя болтовню модели"""
    # Убираем ANSI-коды (цвета терминала), если они есть
    clean_text = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', raw_text)
    # Ищем блок SELECT ... ;
    sql_match = re.search(r"(SELECT[\s\S]+?;?)", clean_text, re.IGNORECASE)
    if sql_match:
        return sql_match.group(1).strip()
    return clean_text.strip()

@app.post("/ask")
async def ask_question(request: QuestionRequest, db: Session = Depends(get_system_db)):
    # 1. Получаем сырой ответ от модели
    gen_result = sql_gen.generate(request.question)
    
    if gen_result.get("status") == "error":
        return {"message": "Ошибка генерации", "sql": None, "data": []}

    # 2. Очищаем SQL от "хвастовства"
    raw_sql = gen_result.get("sql", "")
    sql = extract_clean_sql(raw_sql)
    
    # 3. Исполнение в Postgres
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
        msg = f"Найдено строк: {len(db_results)}"
        cursor.close()
        conn.close()
    except Exception as e:
        msg = f"Ошибка выполнения: {str(e)}"

    # 4. Логирование
    new_log = QueryHistory(user_id=request.user_id, question=request.question, sql_query=sql)
    db.add(new_log)
    db.commit()

    return {"message": msg, "sql": sql, "data": db_results}

# Остальные эндпоинты (history, stats, databases) оставляем как были


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