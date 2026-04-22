document.addEventListener('DOMContentLoaded', () => {
    // 1. Проверка логина
    const user = localStorage.getItem('drivee_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Ставим имя и первую букву в аватар
    document.getElementById('userName').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();

    // 3. Инициализируем иконки Lucide
    lucide.createIcons();
});

// Клик по подсказкам
function useText(text) {
    document.getElementById('queryInput').value = text;
}

// Запрос к бэкенду
async function askML() {
    const input = document.getElementById('queryInput');
    const btn = document.getElementById('sendBtn');
    const query = input.value.trim();

    if (!query) {
        alert('Поле пустое, бро. Напиши что-нибудь.');
        return;
    }

    // Твой Ростелеком статик айпи
    const API_URL = "http://78.36.198.54:8080/query";

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
        alert("ML ответ: " + (data.result || data.answer || "Запрос ушел, проверь логи бэка"));
        
    } catch (err) {
        console.error(err);
        alert("Бэкенд не отвечает. Проверь: запущен ли сервер, открыт ли порт 8080.");
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}