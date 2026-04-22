document.addEventListener('DOMContentLoaded', () => {
    // 1. Проверка авторизации
    const currentUser = localStorage.getItem('drivee_user');
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Отображение данных юзера
    const userNameElem = document.getElementById('userName');
    const avatarElem = document.getElementById('avatar');
    
    if (userNameElem) userNameElem.innerText = currentUser;
    if (avatarElem) avatarElem.innerText = currentUser[0].toUpperCase();

    lucide.createIcons();
    showScreen('main');
});

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}

function handleNav(el, screen) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    showScreen(screen);
}

function showScreen(type) {
    const main = document.getElementById('main-content');
    const right = document.getElementById('right-panel');
    const title = document.getElementById('screen-title');

    if (!main || !right) return;

    main.innerHTML = "";
    right.innerHTML = "";

    if (type === 'main') {
        title.innerText = "Аналитический чат";
        main.innerHTML = `
            <div class="px-6 pt-6">
                <img src="analitycs_for_all.png" alt="Analytics for all" class="w-full h-48 object-cover rounded-3xl shadow-sm border border-gray-100">
            </div>

            <div class="chat-container" id="chatMessages">
                <div class="bot-message message shadow-sm">Привет, ${localStorage.getItem('drivee_user')}! Что сегодня проанализируем?</div>
            </div>
            <div class="p-6 bg-white border-t mt-auto">
                <div class="flex gap-4 max-w-4xl mx-auto">
                    <input id="queryInput" type="text" placeholder="Задайте вопрос по данным..." 
                           class="flex-1 bg-gray-50 p-4 rounded-xl outline-none ring-[#A5F52C] focus:ring-2 border border-gray-100 transition-all">
                    <button onclick="sendQuery()" class="bg-[#A5F52C] w-14 h-14 rounded-xl flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all">
                        <i data-lucide="send" class="text-black"></i>
                    </button>
                </div>
            </div>
        `;
        right.innerHTML = renderQuickActions();
        setupChatListeners();
    } 
    else if (type === 'history') {
        title.innerText = "История запросов";
        renderHistory(main);
        right.innerHTML = renderQuickActions();
    }
    else if (type === 'dashboards') {
        title.innerText = "Визуализация";
        renderDashboards(main);
        right.innerHTML = renderQuickActions();
    }
    else if (type === 'database') {
        title.innerText = "Просмотр базы данных";
        renderDatabase(main);
        right.innerHTML = renderQuickActions();
    }
    lucide.createIcons();
}

function renderQuickActions() {
    return `
        <h3 class="text-xs font-bold uppercase text-gray-400 mb-6 tracking-widest">Быстрые действия</h3>
        <div class="space-y-4">
            <div class="border p-5 rounded-2xl hover:border-[#A5F52C] cursor-pointer transition-all bg-white shadow-sm group" onclick="showScreen('dashboards')">
                <div class="bg-green-50 text-green-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-[#A5F52C] group-hover:text-black transition-colors">
                    <i data-lucide="pie-chart" class="w-5 h-5"></i>
                </div>
                <div class="font-bold text-sm text-gray-900">Выручка по городам</div>
                <p class="text-xs text-gray-500 mt-1">Мгновенный срез по регионам</p>
            </div>
        </div>
    `;
}

// ОТПРАВКА ЗАПРОСА
async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');