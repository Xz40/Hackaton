from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from sql_generator import SQLGenerator
from database import get_db_connection
import re
import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=ENV_PATH)
ANALYTICS_TABLE = os.getenv("ANALYTICS_TABLE", "orders").strip() or "orders"
current_provider = "ollama"

def _model_for_provider(provider: str) -> str:
    # Игнорируем всё, возвращаем только тяжелую модель
    return "sqlcoder:7b-q8_0"

current_provider = os.getenv("SQL_PROVIDER", "ollama").strip().lower()
if current_provider != "ollama":
    current_provider = "ollama"

# Инициализируем генератор
sql_gen = SQLGenerator(
    model_name="sqlcoder:7b-q8_0",
    provider="ollama"
)

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

class LlmConfigRequest(BaseModel):
    provider: str
    model: Optional[str] = None

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

def get_system_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sanitize_raw_ollama_sql(text: str) -> str:
    """Минимальная очистка сырого вывода Ollama без SQL-фильтров."""
    cleaned = text or ""
    cleaned = re.sub(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])', '', cleaned)
    cleaned = cleaned.replace("<s>", "").replace("</s>", "")
    return cleaned.strip()

def remap_orders_table(sql: str) -> str:
    """
    Подменяет таблицу orders на фактическую таблицу из env (ANALYTICS_TABLE).
    """
    return re.sub(r"\borders\b", ANALYTICS_TABLE, sql, flags=re.IGNORECASE)

def normalize_query_rows(rows):
    """Приводит строки psycopg2 к JSON-совместимому list[dict]."""
    normalized = []
    for row in rows or []:
        if hasattr(row, "items"):
            normalized.append({str(k): v for k, v in row.items()})
        else:
            normalized.append({"value": row})
    return normalized

@app.post("/ask")
async def ask_question(request: QuestionRequest, db: Session = Depends(get_system_db)):
    # 1. Генерируем ответ (может быть с мусором)
    gen_result = sql_gen.generate(request.question)
    
    if gen_result.get("status") == "error":
        return {"message": f"Ошибка LLM: {gen_result.get('error')}", "sql": None, "data": []}
    fallback_used = bool(gen_result.get("fallback_used"))
    fallback_reason = gen_result.get("fallback_reason")

    # 2. Вытаскиваем SQL
    raw_response = gen_result.get("sql", "")
    sql = sanitize_raw_ollama_sql(raw_response)

    sql = remap_orders_table(sql)
    
    # 3. Исполнение в Postgres (Drivee Analytics)
    db_results = []
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        db_results = cursor.fetchall()
        
        msg = f"Найдено строк: {len(db_results)}" if db_results else "Данные по запросу отсутствуют."
        if fallback_used:
            msg = f"{msg} (использован безопасный fallback из-за ошибки LLM: {fallback_reason})"
    except Exception as e:
        msg = f"Ошибка базы: {str(e)}"
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass

    # 4. Обновляем статистику пользователя
    user = db.query(User).filter(User.username == request.user_id).first()
    if not user:
        user = User(username=request.user_id, requests_count=0)
        db.add(user)
        db.flush()
    user.requests_count += 1

    # 5. Сохраняем в историю
    new_log = QueryHistory(user_id=request.user_id, question=request.question, sql_query=sql)
    db.add(new_log)
    db.commit()

    return {"message": msg, "sql": sql, "data": normalize_query_rows(db_results)}

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

@app.post("/llm/config")
async def set_llm_config(request: LlmConfigRequest):
    global current_provider, sql_gen
    # Игнорируем то, что прислал юзер, ставим свое
    current_provider = "ollama"
    model_name = "sqlcoder:7b-q8_0"
    sql_gen.configure(provider=current_provider, model_name=model_name)
    return {"status": "ok", "provider": "ollama", "model": "sqlcoder:7b-q8_0"}

@app.get("/llm/config")
async def get_llm_config():
    # Всегда отдаем хардкод
    return {"provider": "ollama", "model": "sqlcoder:7b-q8_0"}

@app.get("/llm/health")
async def llm_health(provider: str = None, model: str = None):
    target_model = (model or _model_for_provider("ollama")).strip()
    return sql_gen.health_check(provider="ollama", model_name=target_model)