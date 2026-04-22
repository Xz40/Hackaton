from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import database # Твой существующий файл database.py

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/get_data")
async def get_data():
    try:
        conn = database.get_db_connection()
        with conn.cursor() as cur:
            # Используем твою таблицу из database.py
            cur.execute("SELECT id, city, amount FROM orders LIMIT 20")
            results = cur.fetchall()
        conn.close()
        return results
    except Exception as e:
        # Заглушка, если база пустая/недоступна
        return [{"id": 1, "city": "Якутск", "amount": 500}, {"id": 2, "city": "Иркутск", "amount": 350}]

# Твои остальные эндпоинты (/ask и т.д.) продолжаются ниже...