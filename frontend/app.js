document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // 1. Проверка авторизации
    const user = localStorage.getItem('drivee_user');
    
    // Если пользователя нет в памяти — отправляем на логин
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Установка логина и аватара
    const userNameElement = document.getElementById('userName');
    const avatarElement = document.getElementById('avatar');

    if (userNameElement) userNameElement.innerText = user;
    if (avatarElement) {
        avatarElement.innerText = user[0].toUpperCase(); // Первая буква логина
        // Можно добавить рандомный цвет для аватара
        const colors = ['#A5F52C', '#FFD700', '#FF69B4', '#00BFFF', '#FFA500'];
        const charCode = user.charCodeAt(0);
        avatarElement.style.backgroundColor = colors[charCode % colors.length];
    }
    
    clearChat();
});

// Функция выхода
function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}

function clearChat() {
    const chat = document.getElementById('chatMessages');
    if (!chat) return;
    chat.innerHTML = `
        <div class="msg bot">
            👋 Привет! Я готов к работе. Какой отчет сформировать?
        </div>
    `;
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();

    if (!text) return;

    chat.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: localStorage.getItem('drivee_user')
            })
        });
        const data = await response.json();
        chat.innerHTML += `<div class="msg bot">${data.message}</div>`;
    } catch (err) {
        chat.innerHTML += `<div class="msg bot" style="color: red;">Ошибка связи с сервером.</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}