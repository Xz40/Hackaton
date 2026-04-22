// Определяем базу API один раз
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

    // Скрываем всё
    ['mainView', 'historyView', 'dataView'].forEach(id => document.getElementById(id).classList.add('hidden'));

    // Показываем нужное
    if (mode === 'Главная') document.getElementById('mainView').classList.remove('hidden');
    if (mode === 'История') { document.getElementById('historyView').classList.remove('hidden'); loadHistory(); }
    if (mode === 'Данные') { document.getElementById('dataView').classList.remove('hidden'); loadDatabases(); }
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    if (!text) return;

    // Сообщение юзера
    chat.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: localStorage.getItem('drivee_user') || 'Admin' })
        });
        const data = await response.json();
        // Ответ бота
        chat.innerHTML += `<div class="msg bot">${data.message}</div>`;
        updateStats();
    } catch (e) {
        chat.innerHTML += `<div class="msg bot" style="color:red">Ошибка соединения с сервером</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

async function loadHistory() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const res = await fetch(`${API_BASE_URL}/history?user_id=${user}`);
        const data = await res.json();
        document.getElementById('historyList').innerHTML = data.map(h => `
            <div class="item-box">
                <div>
                    <strong>${h.question}</strong><br>
                    <small style="color:#AAA">${new Date(h.timestamp).toLocaleString()}</small>
                </div>
                <i data-lucide="chevron-right" style="color:#EEE"></i>
            </div>
        `).join('');
        lucide.createIcons();
    } catch(e) {}
}

async function loadDatabases() {
    try {
        const res = await fetch(`${API_BASE_URL}/databases`);
        const data = await res.json();
        document.getElementById('dbList').innerHTML = data.map(db => `
            <div class="item-box">
                <div><strong>${db.name}</strong><br><small style="color:#AAA">${db.db_type}</small></div>
                <div class="status-dot" style="background:${db.status === 'Online' ? '#A5F52C' : '#FF4D4D'}"></div>
            </div>
        `).join('');
    } catch(e) {}
}

async function updateStats() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const res = await fetch(`${API_BASE_URL}/stats?user_id=${user}`);
        const data = await res.json();
        document.getElementById('statRequests').innerText = `Запросов: ${data.requests_today}`;
    } catch(e) {}
}

function clearChat() {
    document.getElementById('chatMessages').innerHTML = '<div class="msg bot">Привет! Я готов анализировать данные Drivee. Какой отчет подготовить?</div>';
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}