document.addEventListener('DOMContentLoaded', () => {
    // Берем реального юзера
    const user = localStorage.getItem('drivee_user') || 'admin123';
    document.getElementById('userNameDisplay').innerText = user;
    document.getElementById('userAvatar').innerText = user[0].toUpperCase();
    
    lucide.createIcons();
    clearChat();
});

function clearChat() {
    const user = localStorage.getItem('drivee_user') || 'admin123';
    const chat = document.getElementById('chatMessages');
    chat.innerHTML = `
        <div class="bot-msg msg">
            👋 Привет, ${user}! Я готов анализировать данные Drivee. С чего начнем?
        </div>
    `;
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();

    if (!text) return;

    chat.innerHTML += `<div class="user-msg msg">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const res = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: localStorage.getItem('drivee_user') })
        });
        const data = await res.json();
        
        chat.innerHTML += `
            <div class="bot-msg msg">
                <p>${data.message}</p>
                <div style="font-size:10px; opacity:0.3; margin-top:10px; font-family:monospace">SQL: ${data.sql}</div>
            </div>`;
    } catch (e) {
        chat.innerHTML += `<div class="bot-msg msg" style="color:red">Ошибка соединения.</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}