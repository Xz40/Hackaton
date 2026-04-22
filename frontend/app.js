document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Получаем данные пользователя
    const user = localStorage.getItem('drivee_user') || 'Admin';
    document.getElementById('userName').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();
    
    clearChat();
});

function clearChat() {
    const chat = document.getElementById('chatContainer');
    chat.innerHTML = `
        <div class="msg bot">
            👋 Привет! Я ваш аналитический ассистент Drivee. Задайте любой вопрос по базе данных.
        </div>
    `;
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatContainer');
    const text = input.value.trim();

    if (!text) return;

    // Сообщение пользователя
    chat.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: localStorage.getItem('drivee_user') || 'default' 
            })
        });
        
        const data = await response.json();
        
        chat.innerHTML += `
            <div class="msg bot">
                ${data.message}
                <div style="font-size: 10px; opacity: 0.3; margin-top: 10px; font-family: monospace;">SQL: ${data.sql}</div>
            </div>
        `;
    } catch (err) {
        chat.innerHTML += `<div class="msg bot" style="color: red;">Ошибка: не удалось связаться с сервером.</div>`;
    }
    
    chat.scrollTop = chat.scrollHeight;
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}