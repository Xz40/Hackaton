document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Проверка авторизации
    const user = localStorage.getItem('drivee_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Настройка профиля
    const userNameElement = document.getElementById('userName');
    const avatarElement = document.getElementById('avatar');

    if (userNameElement) userNameElement.innerText = user;
    if (avatarElement) {
        avatarElement.innerText = user[0].toUpperCase();
        // Генерируем цвет на основе логина
        const colors = ['#A5F52C', '#00D1FF', '#FFB800', '#FF4D4D', '#9D4DFF'];
        const colorIndex = user.length % colors.length;
        avatarElement.style.backgroundColor = colors[colorIndex];
    }
    
    clearChat();
});

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}

function clearChat() {
    const chat = document.getElementById('chatMessages');
    if (chat) {
        chat.innerHTML = `<div class="msg bot">Привет! Я готов анализировать данные. Что ищем сегодня?</div>`;
    }
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();

    if (!text) return;

    // 1. Отображаем сообщение пользователя
    chat.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        // 2. Отправляем запрос на бекенд
        const response = await fetch('http://78.36.198.54:8080/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: localStorage.getItem('drivee_user') || 'Admin' 
            })
        });

        if (!response.ok) throw new Error('Ошибка сервера');

        // 3. ПОЛУЧАЕМ ОТВЕТ ОТ БЕКА
        const data = await response.json();

        // 4. ОТОБРАЖАЕМ ОТВЕТ В ЧАТЕ
        // Добавляем сообщение от бота и (опционально) сгенерированный SQL для красоты
        chat.innerHTML += `
            <div class="msg bot">
                ${data.message}
                ${data.sql ? `<div style="font-size: 10px; opacity: 0.4; margin-top: 10px; font-family: monospace; border-top: 1px solid #ddd; pt-1">SQL: ${data.sql}</div>` : ''}
            </div>
        `;

    } catch (err) {
        // Если бек упал или нет интернета
        chat.innerHTML += `<div class="msg bot" style="color: red;">Ошибка: не удалось получить ответ от сервера.</div>`;
        console.error('Fetch error:', err);
    }

    // Прокрутка вниз
    chat.scrollTop = chat.scrollHeight;
}