from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .database import get_db_connection
from .models import QueryRequest, QueryResponse
from .sql_generator import generate_sql
from .sql_validator import validate_sql
from fastapi.responses import StreamingResponse
import plotly.express as px
import pandas as pd
import io
import json
from pathlib import Path

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

@app.post("/query_with_chart")
async def query_with_chart(req: QueryRequest):
    sql = generate_sql(req.question)
    conn = get_db_connection()
    df = pd.read_sql(sql, conn)
    conn.close()
    
    # График
    fig = px.bar(df.head(20), title=req.question)
    chart_html = fig.to_html(full_html=False)
    
    # Excel
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)
    buffer.seek(0)
    
    return {
        "question": req.question,
        "sql": sql,
        "data": df.to_dict(orient="records"),
        "chart": chart_html,
        "excel": StreamingResponse(buffer, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": "attachment; filename=report.xlsx"})
    }

REPORTS_DIR = Path("./reports")
REPORTS_DIR.mkdir(exist_ok=True)

@app.post("/save_report")
async def save_report(req: QueryRequest, sql: str, data: list):
    report_id = str(uuid.uuid4())
    report = {
        "id": report_id,
        "question": req.question,
        "sql": sql,
        "data": data,
        "created_at": datetime.now().isoformat()
    }
    with open(REPORTS_DIR / f"{report_id}.json", "w") as f:
        json.dump(report, f)
    return {"report_id": report_id}