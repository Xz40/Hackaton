# create_data_db.py
import sqlite3

def create_target_db():
    conn = sqlite3.connect('drivee_data.db')
    cursor = conn.cursor()
    
    # Таблица заказов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            city TEXT,
            price INTEGER,
            status TEXT,
            date TEXT
        )
    ''')
    
    # Заполним данными
    sample_orders = [
        (1, 'Якутск', 500, 'completed', '2026-04-22'),
        (2, 'Москва', 1200, 'completed', '2026-04-22'),
        (3, 'Якутск', 450, 'cancelled', '2026-04-21')
    ]
    cursor.executemany('INSERT INTO orders VALUES (?,?,?,?,?)', sample_orders)
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    create_target_db()