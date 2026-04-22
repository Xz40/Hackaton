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
    const container = document.getElementById('main-content');
    
    // Сбрасываем контейнер перед отрисовкой
    container.innerHTML = "";

    if (type === 'main') {
        container.innerHTML = renderMainScreen();
        setupChatListeners();
    } else if (type === 'history') {
        renderHistoryScreen(container);
    } else if (type === 'dashboards') {
        renderDashboardsScreen(container);
    } else if (type === 'database') {
        renderDatabaseScreen(container);
    } else {
        container.innerHTML = '<div class="p-10">Экран в разработке</div>';
    }
    lucide.createIcons();
}

// 1. ГЛАВНАЯ + ЧАТ
function renderMainScreen() {
    return `
        <div class="flex-1 flex flex-col p-8 overflow-hidden max-w-5xl mx-auto w-full">
            <h1 class="text-3xl font-bold mb-6 text-black">Быстрые действия</h1>
            
            <div class="grid grid-cols-2 gap-4 mb-8">
                <div class="card action-card p-4 cursor-pointer flex items-center gap-4" onclick="showScreen('dashboards')">
                    <div class="p-3 bg-green-50 text-green-600 rounded-xl"><i data-lucide="bar-chart-3" class="w-5 h-5"></i></div>
                    <h3 class="font-bold text-sm">Дашборды</h3>
                </div>
                <div class="card action-card p-4 cursor-pointer flex items-center gap-4" onclick="document.getElementById('fileInput').click()">
                    <div class="p-3 bg-blue-50 text-blue-600 rounded-xl"><i data-lucide="file-up" class="w-5 h-5"></i></div>
                    <h3 class="font-bold text-sm">Загрузить данные</h3>
                </div>
            </div>

            <div id="chatMessages" class="flex-1 chat-container mb-4 pr-2">
                <div class="bot-message message shadow-sm">Привет! Я помогу проанализировать данные Drivee. Какой отчет подготовить?</div>
            </div>

            <div class="card p-4 bg-white mb-4">
                <div class="flex gap-4">
                    <input id="queryInput" type="text" placeholder="Спросите о продажах, отменах или городах..." 
                           class="flex-1 bg-gray-50 border-none p-4 rounded-2xl outline-none focus:ring-2 ring-[#A5F52C]">
                    <button onclick="sendQuery()" class="bg-[#A5F52C] px-8 rounded-2xl font-bold hover:scale-105 transition-transform">
                        <i data-lucide="send" class="w-5 h-5 text-black"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 2. ИСТОРИЯ
async function renderHistoryScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка истории...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_history`);
        const history = await res.json();
        const html = history.map(h => `
            <div class="card p-5 mb-3 flex justify-between items-center hover:border-gray-300 transition-colors">
                <div class="flex items-center gap-4">
                    <div class="p-2 bg-gray-50 rounded-lg text-gray-400"><i data-lucide="clock" class="w-4 h-4"></i></div>
                    <div>
                        <p class="font-semibold text-gray-800">${h.question}</p>
                        <p class="text-[11px] text-gray-400">${new Date(h.query_date).toLocaleString()}</p>
                    </div>
                </div>
                <span class="text-[10px] font-bold uppercase px-3 py-1 rounded-full ${h.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}">${h.status}</span>
            </div>
        `).join('');
        
        container.innerHTML = `
            <div class="p-8 max-w-4xl mx-auto overflow-y-auto h-full">
                <h1 class="text-2xl font-bold mb-8">История запросов</h1>
                ${html || '<div class="text-gray-400 text-center py-20">История пока пуста</div>'}
            </div>
        `;
    } catch (e) { container.innerHTML = '<div class="p-10 text-center text-red-500">Ошибка бэкенда</div>'; }
    lucide.createIcons();
}

// 3. ДАШБОРДЫ
function renderDashboardsScreen(container) {
    container.innerHTML = `
        <div class="p-8 overflow-y-auto h-full max-w-6xl mx-auto">
            <h1 class="text-2xl font-bold mb-8">Визуализация данных</h1>
            <div class="grid grid-cols-2 gap-6">
                <div class="card p-6">
                    <h3 class="font-bold text-gray-600 mb-6 uppercase text-xs tracking-wider">Выручка по городам</h3>
                    <canvas id="chart1" height="250"></canvas>
                </div>
                <div class="card p-6">
                    <h3 class="font-bold text-gray-600 mb-6 uppercase text-xs tracking-wider">Объем заказов (7дн)</h3>
                    <canvas id="chart2" height="250"></canvas>
                </div>
            </div>
        </div>
    `;
    const ctx1 = document.getElementById('chart1').getContext('2d');
    new Chart(ctx1, {
        type: 'bar',
        data: { labels: ['Якутск', 'Иркутск', 'Москва', 'Казань'], datasets: [{ data: [120, 90, 200, 150], backgroundColor: '#A5F52C', borderRadius: 8 }] },
        options: { plugins: { legend: { display: false } } }
    });
    const ctx2 = document.getElementById('chart2').getContext('2d');
    new Chart(ctx2, {
        type: 'line',
        data: { labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], datasets: [{ data: [40, 35, 55, 45, 70, 85, 80], borderColor: '#A5F52C', tension: 0.4, fill: false }] },
        options: { plugins: { legend: { display: false } } }
    });
}

// 4. ТАБЛИЦА (БАЗА ДАННЫХ)
async function renderDatabaseScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Связь с PostgreSQL...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await res.json();
        let rows = data.map(r => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td class="p-4 text-sm font-medium">#${r.id || r[0]}</td>
                <td class="p-4 text-sm">${r.city || r[1]}</td>
                <td class="p-4 text-sm font-bold text-gray-800">${r.amount || r[2]}₽</td>
                <td class="p-4"><span class="px-2 py-1 bg-green-50 text-green-600 rounded text-[10px] font-bold">COMPLETED</span></td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h1 class="text-2xl font-bold">Таблица заказов</h1>
                    <span class="text-xs text-gray-400">Live данные из DB</span>
                </div>
                <div class="card overflow-hidden shadow-sm">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 text-gray-400 text-[10px] uppercase font-bold tracking-widest">
                            <tr><th class="p-4">ID</th><th class="p-4">Город</th><th class="p-4">Сумма</th><th class="p-4">Статус</th></tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) { container.innerHTML = '<div class="p-10 text-red-500">Ошибка базы данных</div>'; }
}

// ЛОГИКА ЧАТА
function setupChatListeners() {
    const input = document.getElementById('queryInput');
    if(input) {
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendQuery(); });
    }
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    if (!text || !chat) return;

    chat.innerHTML += `<div class="user-message message shadow-sm">${text}</div>`;
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: 'admin' })
        });
        const data = await response.json();
        
        chat.innerHTML += `
            <div class="bot-message message shadow-sm">
                <div class="text-[11px] text-gray-400 mb-2 font-mono">${data.sql}</div>
                <div class="font-medium">${data.message}</div>
                <div class="mt-2 text-xs text-blue-600 font-bold">Найдено строк: ${data.row_count}</div>
            </div>`;
    } catch (e) {
        chat.innerHTML += `<div class="bot-message message text-red-500">Ошибка: Бэкенд не отвечает</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
    lucide.createIcons();
}

function handleFileUpload(input) {
    if(input.files[0]) alert('Файл ' + input.files[0].name + ' готов к обработке');
}