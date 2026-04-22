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

    chat.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    const response = await fetch('http://78.36.198.54:8080/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        question: text, 
        user_id: localStorage.getItem('drivee_user') || 'Admin' 
    })
});
}