document.addEventListener('DOMContentLoaded', () => {
    // Убираем хардкод Жанны - берем имя из сессии
    const user = localStorage.getItem('drivee_user') || 'Гость';
    document.getElementById('userNameDisplay').innerText = user;
    document.getElementById('userAvatar').innerText = user[0].toUpperCase();
    
    lucide.createIcons();
    clearChat(); // Начинаем с чистого листа
});

function clearChat() {
    const chat = document.getElementById('chatMessages');
    chat.innerHTML = `
        <div class="bot-msg msg">
            👋 Привет, ${document.getElementById('userNameDisplay').innerText}! Я готов анализировать данные Drivee. С чего начнем?
        </div>
    `;
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();

    if (!text) return;

    // Отрисовка сообщения юзера
    chat.innerHTML += `<div class="user-msg msg">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const res = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: localStorage.getItem('drivee_user') 
            })
        });
        const data = await res.json();
        
        chat.innerHTML += `
            <div class="bot-msg msg">
                <p>${data.message}</p>
                <div style="font-size:10px; opacity:0.4; margin-top:10px; font-family:monospace">SQL: ${data.sql}</div>
            </div>
        `;
    } catch (e) {
        chat.innerHTML += `<div class="bot-msg msg" style="color:red">Ошибка связи с сервером.</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function handleNav(el, screen) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    // Тут можно добавить логику переключения на таблицы/историю
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}