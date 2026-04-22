document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
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
        const colors = ['#A5F52C', '#00D1FF', '#FFB800', '#FF4D4D', '#9D4DFF'];
        avatarElement.style.backgroundColor = colors[user.length % colors.length];
    }
    
    // Инициализация кликов по меню
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
            showView(this.innerText.trim());
        });
    });

    clearChat();
});

function showView(mode) {
    const sections = {
        'chat': document.getElementById('chatMessages'),
        'footer': document.querySelector('.footer'),
        'history': document.getElementById('historyView'),
        'data': document.getElementById('dataView'),
        'right': document.querySelector('.right-panel')
    };

    // Скрываем всё
    Object.values(sections).forEach(el => el?.classList.add('hidden'));

    if (mode.includes('Главная')) {
        sections.chat.classList.remove('hidden');
        sections.footer.classList.remove('hidden');
        sections.right.classList.remove('hidden');
    } else if (mode.includes('История')) {
        sections.history.classList.remove('hidden');
        loadHistory();
    } else if (mode.includes('Данные')) {
        sections.data.classList.remove('hidden');
        loadDatabases();
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

    try {
        const response = await fetch('http://78.36.198.54:8080/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: localStorage.getItem('drivee_user') })
        });
        const data = await response.json();
        
        chat.innerHTML += `
            <div class="msg bot">
                ${data.message}
                ${data.sql ? `<div style="font-size:10px; opacity:0.4; margin-top:10px; font-family:monospace; border-top:1px solid #EEE; padding-top:5px">SQL: ${data.sql}</div>` : ''}
            </div>`;
    } catch (err) {
        chat.innerHTML += `<div class="msg bot" style="color:red">Ошибка сервера</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function loadHistory() {
    document.getElementById('historyList').innerHTML = `
        <div class="item-card">
            <div class="card-info"><h4>Последний анализ заказов</h4><p>22.04.2026 • SQL выполнен</p></div>
            <i data-lucide="chevron-right"></i>
        </div>`;
    lucide.createIcons();
}

function loadDatabases() {
    document.getElementById('dbList').innerHTML = `
        <div class="item-card">
            <div class="card-info"><h4>Drivee_Production</h4><p>PostgreSQL • Online</p></div>
            <div class="status-dot"></div>
        </div>`;
    lucide.createIcons();
}

function clearChat() {
    document.getElementById('chatMessages').innerHTML = `<div class="msg bot">Привет! Что анализируем?</div>`;
}

function logout() { localStorage.removeItem('drivee_user'); window.location.href = 'login.html'; }