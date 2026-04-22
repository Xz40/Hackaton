// Автоматическое определение URL бэкенда
const API_URL = `${window.location.protocol}//${window.location.hostname}:8000`;

document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('drivee_user');
    if (!user) { window.location.href = 'login.html'; return; }
    
    const nameElem = document.getElementById('userName');
    const avElem = document.getElementById('avatar');
    if(nameElem) nameElem.innerText = user;
    if(avElem) avElem.innerText = user[0].toUpperCase();
    
    showScreen('main');
});

function handleNav(el, screen) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    showScreen(screen);
}

function showScreen(type) {
    const main = document.getElementById('main-content');
    const inputZone = document.getElementById('input-zone');
    const right = document.getElementById('right-panel');
    const title = document.getElementById('screen-title');

    main.innerHTML = "";
    // Показываем поле ввода и правую панель только на главном экране
    if (inputZone) inputZone.style.display = (type === 'main') ? 'block' : 'none';
    if (right) right.style.display = (type === 'main') ? 'block' : 'none';
    
    if (type === 'main') {
        title.innerText = "Аналитический чат";
        appendMessage('bot', 'Привет! Я аналитическая система Drivee. Я подключен к базе заказов и готов отвечать на вопросы.');
        renderRightPanel();
    } else if (type === 'database') {
        title.innerText = "Просмотр базы заказов";
        fetchDatabase();
    } else if (type === 'history') {
        title.innerText = "История запросов";
        fetchHistory();
    }
    lucide.createIcons();
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const question = input.value.trim();
    if (!question) return;

    appendMessage('user', question);
    input.value = "";

    try {
        const response = await fetch(`${API_URL}/query`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                question: question,
                user_id: localStorage.getItem('drivee_user') || "guest"
            })
        });
        const data = await response.json();
        // В main.py QueryResponse возвращает message и data
        appendMessage('bot', data.message || "Результаты запроса:", data.data);
    } catch (e) {
        appendMessage('bot', `Ошибка: Не удалось связаться с бэкендом по адресу ${API_URL}. Проверь, проброшен ли порт 8000.`);
    }
}

async function fetchDatabase() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="p-10 text-gray-400">Загрузка данных из БД...</div>';
    try {
        const res = await fetch(`${API_URL}/get_data`);
        const data = await res.json();
        appendMessage('bot', 'Последние 20 заказов из системы:', data);
    } catch (e) {
        main.innerHTML = `<div class="p-10 text-red-400">Ошибка подключения к ${API_URL}/get_data</div>`;
    }
}

async function fetchHistory() {
    const user = localStorage.getItem('drivee_user');
    try {
        const res = await fetch(`${API_URL}/get_history?user_id=${user}`);
        const data = await res.json();
        appendMessage('bot', 'Ваша история аналитических запросов:', data);
    } catch (e) {
        appendMessage('bot', 'Не удалось загрузить историю.');
    }
}

function appendMessage(role, text, tableData = null) {
    const container = document.getElementById('main-content');
    const isBot = role === 'bot';
    const user = localStorage.getItem('drivee_user') || "U";

    let tableHtml = '';
    if (tableData && Array.isArray(tableData) && tableData.length > 0) {
        const headers = Object.keys(tableData[0]);
        tableHtml = `
            <div class="mt-4 border border-gray-100 rounded-xl overflow-x-auto bg-white shadow-sm">
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="bg-gray-50 text-gray-500 uppercase font-bold">
                        <tr>${headers.map(h => `<th class="p-3 border-b">${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${tableData.map(row => `
                            <tr class="hover:bg-gray-50">
                                ${headers.map(h => `<td class="p-3 border-b text-gray-700">${row[h]}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;
    }

    const html = `
        <div class="flex gap-4 py-6 border-b border-gray-50 max-w-[850px] mx-auto w-full">
            <div class="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center font-bold ${isBot ? 'bg-gray-100 text-gray-500' : 'bg-[#A5F52C] text-black'}">
                ${isBot ? 'AI' : user[0].toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">${isBot ? 'Драйвиум ИИ' : 'Вы'}</div>
                <div class="text-[15px] leading-relaxed text-gray-800">${text}</div>
                ${tableHtml}
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
}

function renderRightPanel() {
    const panel = document.getElementById('right-panel');
    if(!panel) return;
    panel.innerHTML = `
        <h3 class="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-6">Быстрые шаблоны</h3>
        <div class="space-y-3">
            <div onclick="quickQuery('Покажи продажи по городам')" class="p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-green-200 hover:bg-green-50 cursor-pointer transition-all">
                <p class="text-sm font-bold text-gray-800">Выручка по городам</p>
                <p class="text-[11px] text-gray-500 mt-1">Сравнение дохода по регионам</p>
            </div>
            <div onclick="quickQuery('Покажи отмены по городам')" class="p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-green-200 hover:bg-green-50 cursor-pointer transition-all">
                <p class="text-sm font-bold text-gray-800">Анализ отмен</p>
                <p class="text-[11px] text-gray-500 mt-1">Где заказы срываются чаще всего</p>
            </div>
        </div>
    `;
}

function quickQuery(text) {
    const input = document.getElementById('queryInput');
    if(input) {
        input.value = text;
        sendQuery();
    }
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}