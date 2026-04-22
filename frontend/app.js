document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    showScreen('main');
});

function handleNav(el, screen) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    showScreen(screen);
}

function showScreen(type) {
    const main = document.getElementById('main-content');
    const right = document.getElementById('right-panel');
    const title = document.getElementById('screen-title');

    main.innerHTML = "";
    right.innerHTML = "";

    if (type === 'main') {
        title.innerText = "Аналитический чат";
        main.innerHTML = `
            <div class="chat-container" id="chatMessages">
                <div class="bot-message message">Привет! Я помогу с аналитикой. Какой отчет подготовить сегодня?</div>
            </div>
            <div class="p-6 bg-white border-t">
                <div class="flex gap-4 max-w-4xl mx-auto">
                    <input id="queryInput" type="text" placeholder="Задайте вопрос по данным..." class="flex-1 bg-gray-50 p-4 rounded-xl outline-none ring-[#A5F52C] focus:ring-2">
                    <button onclick="sendQuery()" class="bg-[#A5F52C] px-6 rounded-xl font-bold hover:scale-105 transition-transform"><i data-lucide="send"></i></button>
                </div>
            </div>
        `;
        right.innerHTML = renderQuickActions();
        setupChatListeners();
    } 
    else if (type === 'dashboards') {
        title.innerText = "Дашборды";
        renderDashboards(main);
    } 
    else if (type === 'history') {
        title.innerText = "История";
        renderHistory(main);
    }
    else if (type === 'database') {
        title.innerText = "База заказов";
        renderDatabase(main);
    }
    lucide.createIcons();
}

function renderQuickActions() {
    return `
        <h3 class="text-sm font-bold uppercase text-gray-400 mb-6 tracking-widest">Быстрые действия</h3>
        <div class="space-y-4">
            <div class="border p-4 rounded-2xl hover:border-[#A5F52C] cursor-pointer transition-all" onclick="showScreen('dashboards')">
                <div class="bg-green-50 text-green-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3"><i data-lucide="pie-chart"></i></div>
                <div class="font-bold text-sm">Сформировать отчет</div>
                <p class="text-xs text-gray-400">Автоматический PDF отчет за неделю</p>
            </div>
            <div class="border p-4 rounded-2xl hover:border-[#A5F52C] cursor-pointer transition-all" onclick="alert('Загрузка...')">
                <div class="bg-blue-50 text-blue-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3"><i data-lucide="file-text"></i></div>
                <div class="font-bold text-sm">Экспорт в Excel</div>
                <p class="text-xs text-gray-500">Выгрузить текущую таблицу</p>
            </div>
        </div>
    `;
}

// ИСПРАВЛЕННЫЕ ДАШБОРДЫ
function renderDashboards(container) {
    container.innerHTML = `
        <div class="p-8 grid grid-cols-1 gap-8 overflow-y-auto h-full">
            <div class="bg-white border p-6 rounded-3xl">
                <h4 class="font-bold mb-4">Выручка по городам</h4>
                <canvas id="barChart"></canvas>
            </div>
            <div class="bg-white border p-6 rounded-3xl">
                <h4 class="font-bold mb-4">Динамика заказов</h4>
                <canvas id="lineChart"></canvas>
            </div>
        </div>
    `;
    
    // Таймаут, чтобы дождаться отрисовки canvas в DOM
    setTimeout(() => {
        const ctx1 = document.getElementById('barChart');
        const ctx2 = document.getElementById('lineChart');
        if (ctx1 && ctx2) {
            new Chart(ctx1, { type: 'bar', data: { labels: ['Якутск', 'Иркутск', 'Москва'], datasets: [{ label: 'Выручка', data: [50000, 35000, 80000], backgroundColor: '#A5F52C' }] } });
            new Chart(ctx2, { type: 'line', data: { labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'], datasets: [{ label: 'Заказы', data: [12, 19, 15, 25, 22], borderColor: '#A5F52C', tension: 0.3 }] } });
        }
    }, 100);
}

// ЧАТ ЛОГИКА
async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    if (!text) return;

    chat.innerHTML += `<div class="user-message message shadow-sm">${text}</div>`;
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: 'Жанна' })
        });
        const data = await response.json();
        chat.innerHTML += `<div class="bot-message message shadow-sm"><b>Результат:</b><br>${data.message}<br><span class="text-[10px] text-gray-400">SQL: ${data.sql}</span></div>`;
    } catch (e) {
        chat.innerHTML += `<div class="bot-message message text-red-500">Ошибка бэкенда</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

function setupChatListeners() {
    const input = document.getElementById('queryInput');
    if(input) input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendQuery(); });
}

async function renderDatabase(container) {
    container.innerHTML = '<div class="p-10">Загрузка данных из PostgreSQL...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await res.json();
        let rows = data.map(r => `<tr class="border-b"><td class="p-4">${r.id}</td><td class="p-4">${r.city}</td><td class="p-4 font-bold">${r.amount}₽</td></tr>`).join('');
        container.innerHTML = `<div class="p-8 h-full overflow-y-auto"><table class="w-full bg-white border rounded-2xl overflow-hidden"><thead><tr class="bg-gray-50 text-left"><th class="p-4">ID</th><th class="p-4">Город</th><th class="p-4">Сумма</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } catch (e) { container.innerHTML = '<div class="p-10 text-red-500">Ошибка базы данных</div>'; }
}