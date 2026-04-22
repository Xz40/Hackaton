document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Жанна'; // Дефолт из Фигмы
    document.getElementById('userName').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();
    showScreen('main');
});

function handleNav(el, screen) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    showScreen(screen);
}

function showScreen(type) {
    const mainContainer = document.getElementById('chat-content-area');
    const rightContainer = document.getElementById('right-panel-area');
    
    // Очищаем оба контейнера
    mainContainer.innerHTML = "";
    rightContainer.innerHTML = "";

    if (type === 'main') {
        // Чат в центре
        mainContainer.innerHTML = renderChatSubScreen();
        setupChatListeners();
        // Действия и Баннер справа
        rightContainer.innerHTML = renderRightPanelActions();
    } else if (type === 'history') {
        renderHistoryScreen(mainContainer);
        // Справа можно оставить баннер или очистить
        rightContainer.innerHTML = renderRightPanelActions(false); // Без кнопок, только баннер
    } else if (type === 'dashboards') {
        renderDashboardsScreen(mainContainer);
        rightContainer.innerHTML = renderRightPanelActions(false);
    } else if (type === 'database') {
        renderDatabaseScreen(mainContainer);
        rightContainer.innerHTML = renderRightPanelActions(false);
    } else {
        mainContainer.innerHTML = '<div class="p-10 text-gray-500">Экран в разработке</div>';
    }
    lucide.createIcons();
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ОТРИСОВКИ ---

// 1. Центральная часть Главной (только Чат)
function renderChatSubScreen() {
    return `
        <div class="flex-1 flex flex-col p-8 overflow-hidden">
            <div id="chatMessages" class="flex-1 chat-container mb-6 pr-3">
                <div class="bot-message message">Привет! Я готов проанализировать данные Drivee. Какой отчет подготовить?</div>
            </div>

            <div class="card p-4 bg-white shadow-lg border border-gray-100 rounded-2xl sticky bottom-0">
                <div class="flex gap-4 items-center">
                    <input id="queryInput" type="text" placeholder="Спросите о продажах, отменах или городах..." 
                           class="flex-1 bg-gray-50 border-none p-4 rounded-xl outline-none focus:ring-1 ring-[#A5F52C] text-sm placeholder:text-gray-400">
                    <button onclick="sendQuery()" class="bg-[#A5F52C] w-12 h-12 rounded-xl flex items-center justify-center hover:scale-105 transition-transform">
                        <i data-lucide="send" class="w-5 h-5 text-black"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 2. Правая панель (Действия + Промо-баннер)
function renderRightPanelActions(showActions = true) {
    let actionsHtml = '';
    if (showActions) {
        actionsHtml = `
            <div class="mb-10">
                <h3 class="text-sm font-semibold text-gray-900 mb-5">Быстрые действия</h3>
                <div class="space-y-3">
                    <div class="card action-card p-4 flex items-center gap-4" onclick="showScreen('dashboards')">
                        <div class="p-3 bg-green-50 text-green-600 rounded-xl"><i data-lucide="bar-chart-3" class="w-5 h-5"></i></div>
                        <div>
                            <h4 class="font-semibold text-sm text-gray-950">Создать дашборд</h4>
                            <p class="text-xs text-gray-500">Визуализируйте метрики</p>
                        </div>
                    </div>
                    <div class="card action-card p-4 flex items-center gap-4" onclick="document.getElementById('fileInput').click()">
                        <div class="p-3 bg-blue-50 text-blue-600 rounded-xl"><i data-lucide="file-up" class="w-5 h-5"></i></div>
                        <div>
                            <h4 class="font-semibold text-sm text-gray-950">Подключить данные</h4>
                            <p class="text-xs text-gray-500">Добавить базу данных</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ПРОМО-БАННЕР ВНИЗУ СПРАВА
    const bannerHtml = `
        <div class="mt-auto pt-8">
            <img src="analitycs_for_all.png" alt="Аналитика доступна каждому" class="w-full h-auto rounded-2xl shadow-sm">
        </div>
    `;

    return actionsHtml + bannerHtml;
}

// --- ЛОГИКА ЧАТА И ОСТАЛЬНЫХ ЭКРАНОВ ---

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
        
        chat.innerHTML += `
            <div class="bot-message message">
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

async function renderHistoryScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка истории...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_history`);
        const history = await res.json();
        const html = history.map(h => `
            <div class="card p-5 mb-3 flex justify-between items-center bg-white hover:border-gray-300">
                <p class="font-medium text-sm text-gray-800">${h.question}</p>
                <span class="text-[10px] font-bold uppercase px-3 py-1 rounded-full ${h.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}">${h.status}</span>
            </div>
        `).join('');
        container.innerHTML = `<div class="p-8 overflow-y-auto h-full"><h1 class="text-xl font-bold mb-6">История</h1>${html || 'История пуста'}</div>`;
    } catch (e) { container.innerHTML = '<div class="p-10 text-red-500">Ошибка бэкенда</div>'; }
}

function renderDashboardsScreen(container) {
    container.innerHTML = `<div class="p-8 overflow-y-auto h-full"><h1 class="text-xl font-bold mb-6">Дашборды</h1><p class="text-gray-500">Графики Chart.js...</p></div>`;
}

async function renderDatabaseScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка БД...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await res.json();
        let rows = data.map(r => `<tr class="border-b"><td class="p-3 text-sm">#${r.id}</td><td class="p-3 text-sm">${r.city}</td><td class="p-3 text-sm font-bold">${r.amount}₽</td></tr>`).join('');
        container.innerHTML = `<div class="p-8 overflow-y-auto h-full"><h1 class="text-xl font-bold mb-6">База данных</h1><table class="w-full text-left card"><thead><tr class="bg-gray-50"><th class="p-3">ID</th><th class="p-3">Город</th><th class="p-3">Сумма</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } catch (e) { container.innerHTML = '<div class="p-10 text-red-500">Ошибка базы</div>'; }
}

function handleFileUpload(input) { if(input.files[0]) alert('Файл ' + input.files[0].name + ' готов'); }