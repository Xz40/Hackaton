const API_URL = `http://${window.location.hostname}:8000`;

document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('drivee_user');
    if (!user) { window.location.href = 'login.html'; return; }
    
    document.getElementById('userName').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();
    
    showScreen('main');
    lucide.createIcons();
});

function handleNav(el, screen) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    showScreen(screen);
}

function showScreen(type) {
    const main = document.getElementById('main-content');
    const inputZone = document.getElementById('input-zone');
    const title = document.getElementById('screen-title');
    const right = document.getElementById('right-panel');

    main.innerHTML = "";
    inputZone.style.display = (type === 'main') ? 'block' : 'none';
    right.style.display = (type === 'main') ? 'block' : 'none';
    
    if (type === 'main') {
        title.innerText = "Аналитический чат";
        appendMessage('bot', 'Привет! Я готов проанализировать данные Drivee. Что хочешь узнать?');
        renderRightPanel();
    } else if (type === 'database') {
        title.innerText = "База данных (Последние заказы)";
        fetchDatabase();
    } else if (type === 'history') {
        title.innerText = "История ваших запросов";
        fetchHistory();
    }
    lucide.createIcons();
}

function appendMessage(role, text, tableData = null) {
    const container = document.getElementById('main-content');
    const isBot = role === 'bot';
    const user = localStorage.getItem('drivee_user');

    let tableHtml = '';
    if (tableData && tableData.length > 0) {
        const headers = Object.keys(tableData[0]);
        tableHtml = `<table class="data-table">
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${tableData.map(row => `<tr>${headers.map(h => `<td>${row[h]}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`;
    }

    const html = `
        <div class="message">
            <div class="message-avatar ${isBot ? 'bot-avatar' : 'user-avatar'}">
                ${isBot ? 'AI' : user[0].toUpperCase()}
            </div>
            <div class="message-body">
                <div class="message-name">${isBot ? 'Драйвиум ИИ' : 'Вы'}</div>
                <div class="message-text">${text}</div>
                ${tableHtml}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const question = input.value.trim();
    if (!question) return;

    appendMessage('user', question);
    input.value = "";

    try {
        const res = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                question: question,
                user_id: localStorage.getItem('drivee_user')
            })
        });
        const data = await res.json();
        appendMessage('bot', data.message, data.data);
    } catch (e) {
        appendMessage('bot', 'Ошибка связи с сервером. Проверь, запущен ли бэкенд.');
    }
}

async function fetchDatabase() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="p-10 text-gray-400">Загрузка данных...</div>';
    try {
        const res = await fetch(`${API_URL}/get_data`);
        const data = await res.json();
        appendMessage('bot', 'Ниже представлены последние 20 записей из таблицы заказов:', data);
    } catch (e) {
        main.innerHTML = '<div class="p-10 text-red-400">Ошибка загрузки БД</div>';
    }
}

async function fetchHistory() {
    const main = document.getElementById('main-content');
    const user = localStorage.getItem('drivee_user');
    try {
        const res = await fetch(`${API_URL}/get_history?user_id=${user}`);
        const data = await res.json();
        appendMessage('bot', 'Ваша история запросов:', data);
    } catch (e) {
        appendMessage('bot', 'Не удалось загрузить историю.');
    }
}

function renderRightPanel() {
    const panel = document.getElementById('right-panel');
    panel.innerHTML = `
        <h3 class="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-6">Быстрые действия</h3>
        <div class="space-y-4">
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onclick="quickQuery('Покажи продажи по городам')">
                <p class="text-sm font-bold mb-1">Продажи по городам</p>
                <p class="text-xs text-gray-500">Общая выручка в разрезе регионов</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors" onclick="quickQuery('Покажи отмены по городам')">
                <p class="text-sm font-bold mb-1">Анализ отмен</p>
                <p class="text-xs text-gray-500">Где чаще всего отменяют заказы</p>
            </div>
        </div>
    `;
}

function quickQuery(text) {
    document.getElementById('queryInput').value = text;
    sendQuery();
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}