document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Admin';
    document.getElementById('userName').innerText = user;
    
    // Инициализация навигации
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            showView(item.textContent.trim());
        });
    });

    updateStats();
    clearChat();
});

function showView(mode) {
    const views = {
        'Главная': ['mainView', 'rightPanel'], // Добавь ID right-panel если нужно скрывать
        'История': ['historyView'],
        'Данные': ['dataView']
    };

    // Скрываем всё
    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('historyView').classList.add('hidden');
    document.getElementById('dataView').classList.add('hidden');
    document.querySelector('.right-panel').classList.add('hidden');

    if (mode === 'Главная') {
        document.getElementById('mainView').classList.remove('hidden');
        document.querySelector('.right-panel').classList.remove('hidden');
    } else if (mode === 'История') {
        document.getElementById('historyView').classList.remove('hidden');
        loadHistory();
    } else if (mode === 'Данные') {
        document.getElementById('dataView').classList.remove('hidden');
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

    try {
        const response = await fetch('http://78.36.198.54:8080/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: localStorage.getItem('drivee_user') })
        });
        const data = await response.json();
        chat.innerHTML += `<div class="msg bot">${data.message}</div>`;
        updateStats();
    } catch (e) {
        chat.innerHTML += `<div class="msg bot" style="color:red">Ошибка бэкенда</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

async function loadHistory() {
    const user = localStorage.getItem('drivee_user');
    const res = await fetch(`http://78.36.198.54:8080/history?user_id=${user}`);
    const data = await res.json();
    document.getElementById('historyList').innerHTML = data.map(h => `
        <div class="item-card">
            <div><strong>${h.question}</strong><br><small>${new Date(h.timestamp).toLocaleString()}</small></div>
        </div>
    `).join('');
}

async function loadDatabases() {
    const res = await fetch('http://78.36.198.54:8080/databases');
    const data = await res.json();
    document.getElementById('dbList').innerHTML = data.map(db => `
        <div class="item-card">
            <div><strong>${db.name}</strong><br><small>${db.db_type}</small></div>
            <div class="status-dot" style="background:${db.status === 'Online' ? '#A5F52C' : 'red'}"></div>
        </div>
    `).join('');
}

async function updateStats() {
    const user = localStorage.getItem('drivee_user');
    const res = await fetch(`http://78.36.198.54:8080/stats?user_id=${user}`);
    const data = await res.json();
    document.getElementById('statRequests').innerText = `Запросов сегодня: ${data.requests_today}`;
}

function clearChat() {
    document.getElementById('chatMessages').innerHTML = '<div class="msg bot">Привет! Я AI-аналитик Drivee. Чем помочь?</div>';
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}