// 1. Проверка авторизации и динамика
document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('drivee_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userNameDisplay').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();
});

// 2. Функция заполнения текста из подсказок
function useText(element) {
    const text = element.querySelector('span').innerText;
    document.getElementById('queryInput').value = text;
}

// 3. Главная функция: запрос к твоему ML Бэкенду
async function askML() {
    const input = document.getElementById('queryInput');
    const btn = document.getElementById('sendBtn');
    const query = input.value.trim();

    if (!query) return alert('Сначала напиши вопрос!');

    // Твой статический IP из прошлых сообщений
    const API_URL = "http://78.36.198.54:8080/query";

    // Визуальный фидбек
    btn.disabled = true;
    btn.style.opacity = '0.5';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: query,
                user: localStorage.getItem('drivee_user')
            })
        });

        const data = await response.json();
        
        // Тут можно вывести ответ в консоль или алертом для теста
        alert("ML ответ: " + (data.result || data.answer || "Готово!"));
        
    } catch (error) {
        console.error("Ошибка связи с сервером:", error);
        alert("Бэкенд не ответил. Проверь, запущен ли uvicorn!");
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}