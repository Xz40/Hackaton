// Автоматическое определение адреса API (текущий домен + порт 8080)
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080`;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Admin';
    document.getElementById('userName').innerText = user;
    updateStats();
    clearChat();
});

function showView(mode) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(i => {
        i.classList.remove('active');
        if(i.innerText.includes(mode)) i.classList.add('active');
    });

    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('historyView').classList.add('hidden');
    document.getElementById('dataView').classList.add('hidden');

    if (mode === 'Главная') document.getElementById('mainView').classList.remove('hidden');
    if (mode === 'История') { document.getElementById('historyView').classList.remove('hidden'); loadHistory(); }
    if (mode === 'Данные') { document.getElementById('dataView').classList.remove('hidden'); loadDatabases(); }
}

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080`;

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Admin';
    document.getElementById('userName').innerText = user;
    updateStats();
    clearChat();
});

function showView(mode) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(i => {
        i.classList.remove('active');
        if(i.innerText.includes(mode)) i.classList.add('active');
    });

    document.getElementById('mainView').classList.add('hidden');
    document.getElementById('historyView').classList.add('hidden');
    document.getElementById('dataView').classList.add('hidden');

    if (mode === 'Главная') document.getElementById('mainView').classList.remove('hidden');
    if (mode === 'История') { document.getElementById('historyView').classList.remove('hidden'); loadHistory(); }
    if (mode === 'Данные') { document.getElementById('dataView').classList.remove('hidden'); loadDatabases(); }
}

async function loadHistory() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const res = await fetch(`${API_BASE_URL}/history?user_id=${user}`);
        const data = await res.json();
        document.getElementById('historyList').innerHTML = data.map(h => `
            <div class="data-box">
                <div>
                    <strong>${h.question}</strong><br>
                    <small style="color: #888;">${new Date(h.timestamp).toLocaleString()}</small>
                </div>
                <i data-lucide="chevron-right" style="color: #DDD;"></i>
            </div>
        `).join('');
        lucide.createIcons();
    } catch(e) { console.error("History fail", e); }
}

async function loadDatabases() {
    try {
        const res = await fetch(`${API_BASE_URL}/databases`);
        const data = await res.json();
        document.getElementById('dbList').innerHTML = data.map(db => `
            <div class="data-box">
                <div>
                    <strong>${db.name}</strong><br>
                    <small style="color: #888;">${db.db_type}</small>
                </div>
                <div class="dot" style="background:${db.status === 'Online' ? '#A5F52C' : '#FF4D4D'}"></div>
            </div>
        `).join('');
    } catch(e) { console.error("DB fail", e); }
}

async function loadDatabases() {
    try {
        const res = await fetch(`${API_BASE_URL}/databases`);
        const data = await res.json();
        document.getElementById('dbList').innerHTML = data.map(db => `
            <div class="item-card">
                <div><strong>${db.name}</strong><small>${db.db_type}</small></div>
                <div class="dot" style="background:${db.status === 'Online' ? '#A5F52C' : '#FF4D4D'}"></div>
            </div>
        `).join('');
    } catch(e) { console.error("DB load error", e); }
}

async function updateStats() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const res = await fetch(`${API_BASE_URL}/stats?user_id=${user}`);
        const data = await res.json();
        document.getElementById('statRequests').innerText = `Запросов сегодня: ${data.requests_today}`;
    } catch(e) {}
}

function clearChat() {
    document.getElementById('chatMessages').innerHTML = '<div class="msg bot" style="align-self: flex-start; background: #fff; border: 1px solid #EEE; padding: 15px; border-radius: 15px;">Привет! Я AI-аналитик Drivee. Какую статистику подготовить?</div>';
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}