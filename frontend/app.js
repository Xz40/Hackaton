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
    if (type === 'main') {
        container.innerHTML = renderMainScreen();
        setupChatListeners(); // Важно: вешаем обработчик на Enter
    } else if (type === 'database') {
        renderDatabaseScreen(container);
    } else if (type === 'history') {
        renderHistoryScreen(container);
    } else if (type === 'dashboards') {
        renderDashboardsScreen(container);
    }
    lucide.createIcons();
}

// ГЛАВНЫЙ ЭКРАН С ЧАТОМ
function renderMainScreen() {
    return `
        <div class="flex-1 flex flex-col p-8 overflow-hidden">
            <div class="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                <h1 class="text-3xl font-bold mb-6">Аналитика Drivee</h1>
                
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <div class="card action-card p-4 cursor-pointer flex items-center gap-4" onclick="showScreen('dashboards')">
                        <div class="p-3 bg-green-50 text-green-600 rounded-xl"><i data-lucide="bar-chart-3"></i></div>
                        <div><h3 class="font-bold text-sm">Дашборды</h3></div>
                    </div>
                    <div class="card action-card p-4 cursor-pointer flex items-center gap-4" onclick="document.getElementById('fileInput').click()">
                        <div class="p-3 bg-blue-50 text-blue-600 rounded-xl"><i data-lucide="file-up"></i></div>
                        <div><h3 class="font-bold text-sm">Загрузить данные</h3></div>
                    </div>
                </div>

                <div id="chatMessages" class="flex-1 chat-container mb-4 flex flex-col pr-2">
                    <div class="bot-message message">Привет! Я помогу проанализировать данные Drivee. Спроси меня о выручке или заказах.</div>
                </div>

                <div class="card p-4 bg-white sticky bottom-0">
                    <div class="flex gap-4">
                        <input id="queryInput" type="text" placeholder="Введите ваш запрос..." 
                               class="flex-1 bg-gray-50 border-none p-4 rounded-2xl outline-none focus:ring-2 ring-[#A5F52C]">
                        <button onclick="sendQuery()" class="bg-[#A5F52C] px-6 rounded-2xl font-bold hover:brightness-105">
                            <i data-lucide="send" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ИСТОРИЯ
async function renderHistoryScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка истории...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_history`);
        const history = await res.json();
        const html = history.map(h => `
            <div class="card p-4 mb-3 flex justify-between items-center">
                <div>
                    <p class="font-semibold">${h.question}</p>
                    <p class="text-xs text-gray-400">${new Date(h.query_date).toLocaleString()}</p>
                </div>
                <span class="text-[10px] font-bold uppercase px-2 py-1 rounded bg-gray-100">${h.status}</span>
            </div>
        `).join('');
        container.innerHTML = `<div class="p-8 max-w-4xl mx-auto">
            <h1 class="text-2xl font-bold mb-6">История</h1>
            ${html || 'История пуста'}
        </div>`;
    } catch (e) { container.innerHTML = 'Ошибка загрузки истории'; }
}

// ЛОГИКА ЧАТА
function setupChatListeners() {
    const input = document.getElementById('queryInput');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendQuery();
    });
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    if (!text) return;

    // Добавляем сообщение пользователя
    chat.innerHTML += `<div class="user-message message">${text}</div>`;
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: 'admin' })
        });
        const data = await response.json();
        
        // Ответ бота
        chat.innerHTML += `<div class="bot-message message">
            <b>SQL:</b> <code class="text-xs bg-gray-100 p-1">${data.sql}</code><br><br>
            ${data.message}. Найдено строк: ${data.row_count}
        </div>`;
    } catch (e) {
        chat.innerHTML += `<div class="bot-message message text-red-500">Ошибка связи с бэкендом</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
    lucide.createIcons();
}

// Остальные функции (database, dashboards) остаются как были...