# run_server.py — надежный запуск с автоперезапуском
import subprocess
import time
import sys

while True:
    print("Запуск FastAPI сервера...")
    process = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "0.0.0.0", "--port", "8080", "--reload"
    ])

    try:
        process.wait()
    except KeyboardInterrupt:
        print("\nОстановка по Ctrl+C...")
        process.terminate()
        break

    print("Сервер упал, перезапуск через 3 секунды...")
    time.sleep(3)