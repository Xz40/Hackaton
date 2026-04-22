document.addEventListener('DOMContentLoaded', () => {
    // 1. Проверка авторизации
    const currentUser = localStorage.getItem('drivee_user');
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Отображение данных юзера
    document.getElementById('userName').innerText = currentUser;
    document.getElementById('avatar').innerText = currentUser[0].toUpperCase();

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

    main.innerHTML = "";
    right.innerHTML = "";

    if (type === 'main') {
        title.innerText = "Аналитический чат";
        main.innerHTML = `
            <div class="chat-container" id="chatMessages">
                <div class="bot-message message shadow-sm">Привет, ${localStorage.getItem('drivee_user')}! Что сегодня проанализируем?</div>
            </div>
            <div class="p-6 bg-white border-t">
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
                <p class="text-xs text-gray-500 mt-1">Мгновенный срез по всем регионам присутствия</p>
            </div>
            <div class="border p-5 rounded-2xl hover:border-[#A5F52C] cursor-pointer transition-all bg-white shadow-sm" onclick="alert('Экспорт запущен')">
                <div class="bg-blue-50 text-blue-600 w-10 h-10 rounded-lg flex items-center justify-center mb-3"><i data-lucide="file-spreadsheet" class="w-5 h-5"></i></div>
                <div class="font-bold text-sm text-gray-900">Выгрузить в Excel</div>
                <p class="text-xs text-gray-500 mt-1">Получить текущий срез данных в формате .xlsx</p>
            </div>
        </div>
    `;
}

// ЧАТ И ИСТОРИЯ
async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    const user = localStorage.getItem('drivee_user'); // Берем реального юзера!

    if (!text) return;

    chat.innerHTML += `<div class="user-message message shadow-sm">${text}</div>`;
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: user // Передаем на бэк для записи в историю
            })
        });
        const data = await response.json();
        
        chat.innerHTML += `
            <div class="bot-message message shadow-sm bg-white">
                <div class="text-[10px] text-gray-400 font-mono border-b pb-2 mb-2">${data.sql}</div>
                <div class="text-gray-800">${data.message}</div>
                <div class="mt-3 inline-block px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500">
                    Строк: ${data.row_count}
                </div>
            </div>`;
    } catch (e) {
        chat.innerHTML += `<div class="bot-message message text-red-500 bg-red-50 border-red-100">Ошибка: Сервер аналитики не отвечает</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
    lucide.createIcons();
}

async function renderHistory(container) {
    container.innerHTML = '<div class="p-10 text-center animate-pulse">Загрузка вашей истории...</div>';
    
    // Берем логин того, кто сейчас залогинен
    const user = localStorage.getItem('drivee_user'); 

    try {
        // Передаем user_id в URL как параметр
        const res = await fetch(`http://${window.location.hostname}:8080/get_history?user_id=${user}`);
        const history = await res.json();
        
        const html = history.map(h => `
            <div class="bg-white border p-5 mb-3 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                    <p class="font-semibold text-gray-800">${h.question}</p>
                    <p class="text-[10px] text-gray-400 mt-1">${new Date(h.query_date).toLocaleString()}</p>
                </div>
                <span class="text-[9px] font-bold uppercase px-3 py-1 rounded-full ${h.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}">
                    ${h.status}
                </span>
            </div>
        `).join('');
        
        container.innerHTML = `<div class="p-8 h-full overflow-y-auto">${html || '<p class="text-center text-gray-400 py-20">У вас пока нет запросов</p>'}</div>`;
    } catch (e) { 
        container.innerHTML = '<div class="p-10 text-red-500 text-center">Ошибка загрузки личной истории</div>'; 
    }
}

function setupChatListeners() {
    const input = document.getElementById('queryInput');
    if(input) input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendQuery(); });
}

// Дашборды с защитой от пустых контейнеров
function renderDashboards(container) {
    container.innerHTML = `
        <div class="p-8 grid grid-cols-1 gap-6 overflow-y-auto h-full">
            <div class="bg-white border p-6 rounded-3xl shadow-sm"><h4 class="font-bold mb-4 text-gray-700 text-sm uppercase tracking-wide">Распределение выручки</h4><canvas id="barChart"></canvas></div>
            <div class="bg-white border p-6 rounded-3xl shadow-sm"><h4 class="font-bold mb-4 text-gray-700 text-sm uppercase tracking-wide">Тренд заказов</h4><canvas id="lineChart"></canvas></div>
        </div>
    `;
    setTimeout(() => {
        const c1 = document.getElementById('barChart');
        const c2 = document.getElementById('lineChart');
        if (c1 && c2) {
            new Chart(c1, { type: 'bar', data: { labels: ['Якутск', 'Иркутск', 'Москва', 'Казань'], datasets: [{ label: 'Выручка ₽', data: [45000, 32000, 95000, 51000], backgroundColor: '#A5F52C', borderRadius: 6 }] } });
            new Chart(c2, { type: 'line', data: { labels: ['01.04', '02.04', '03.04', '04.04', '05.04'], datasets: [{ label: 'Заказы', data: [150, 180, 165, 210, 240], borderColor: '#A5F52C', tension: 0.3, fill: false }] } });
        }
    }, 150);
}

async function renderDatabase(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка последних транзакций...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await res.json();
        let rows = data.map(r => `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-4 text-gray-500 text-sm">#${r.id}</td>
                <td class="p-4 text-sm font-medium">${r.city}</td>
                <td class="p-4 text-sm font-bold text-gray-900">${r.amount}₽</td>
                <td class="p-4"><span class="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-bold">COMPLETED</span></td>
            </tr>
        `).join('');
        container.innerHTML = `
            <div class="p-8 h-full overflow-y-auto">
                <table class="w-full bg-white border rounded-2xl overflow-hidden shadow-sm">
                    <thead class="bg-gray-50 text-left text-[10px] uppercase text-gray-400 font-bold tracking-widest">
                        <tr><th class="p-4">ID</th><th class="p-4">Локация</th><th class="p-4">Сумма</th><th class="p-4">Статус</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    } catch (e) { container.innerHTML = '<div class="p-10 text-red-500">Ошибка подключения к БД</div>'; }
}