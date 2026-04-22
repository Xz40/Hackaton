document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Admin';
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
    const container = document.getElementById('main-content');
    if (type === 'main') {
        container.innerHTML = renderMainScreen();
    } else if (type === 'database') {
        renderDatabaseScreen(container);
    } else if (type === 'dashboards') {
        renderDashboardsScreen(container);
    } else {
        container.innerHTML = `<div class="p-10 text-gray-400 text-center">Экран "${type}" в разработке...</div>`;
    }
    lucide.createIcons();
}

function renderMainScreen() {
    return `
        <div class="flex-1 overflow-y-auto p-8">
            <div class="max-w-4xl mx-auto">
                <h1 class="text-3xl font-bold mb-8">Быстрые действия</h1>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                    <div class="card action-card p-6 cursor-pointer" onclick="showScreen('dashboards')">
                        <div class="flex items-center gap-5">
                            <div class="p-4 bg-green-50 text-green-600 rounded-2xl"><i data-lucide="bar-chart-3"></i></div>
                            <div>
                                <h3 class="font-bold text-lg">Создать дашборд</h3>
                                <p class="text-sm text-gray-500">Визуализируйте аналитику поездок</p>
                            </div>
                        </div>
                    </div>
                    <div class="card action-card p-6 cursor-pointer" onclick="document.getElementById('fileInput').click()">
                        <div class="flex items-center gap-5">
                            <div class="p-4 bg-blue-50 text-blue-600 rounded-2xl"><i data-lucide="file-up"></i></div>
                            <div>
                                <h3 class="font-bold text-lg">Подключить данные</h3>
                                <p class="text-sm text-gray-500">Загрузить CSV/JSON базу данных</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card p-6 bg-white shadow-sm border border-gray-100">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-2 h-2 bg-[#A5F52C] rounded-full animate-pulse"></div>
                        <span class="text-sm font-semibold text-gray-600">AI Помощник готов</span>
                    </div>
                    <div class="flex gap-4">
                        <input id="queryInput" type="text" placeholder="Спросите что-нибудь о данных Drivee..." 
                               class="flex-1 bg-gray-50 border-none p-4 rounded-2xl focus:ring-2 ring-[#A5F52C] outline-none transition-all">
                        <button onclick="sendQuery()" class="bg-[#A5F52C] px-8 rounded-2xl font-bold hover:brightness-105 transition-all">
                            Отправить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function renderDatabaseScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка данных из PostgreSQL...</div>';
    try {
        const response = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await response.json();
        let rows = data.map(r => `<tr class="border-b text-sm"><td class="p-4 font-medium">#${r.id || r[0]}</td><td class="p-4">${r.city || r[1] || '—'}</td><td class="p-4 font-bold">${r.amount || r[2] || 0}₽</td></tr>`).join('');
        container.innerHTML = `<div class="p-8 overflow-y-auto"><h1 class="text-2xl font-bold mb-6">База данных заказов</h1><div class="card overflow-hidden"><table class="w-full text-left"><thead class="bg-gray-50 text-gray-500 text-xs uppercase"><tr><th class="p-4">ID</th><th class="p-4">Город</th><th class="p-4">Сумма</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    } catch (e) {
        container.innerHTML = '<div class="p-10 text-red-500 text-center">Ошибка связи с БД. Проверь main.py</div>';
    }
}

function renderDashboardsScreen(container) {
    container.innerHTML = `
        <div class="p-8 overflow-y-auto">
            <h1 class="text-2xl font-bold mb-8">Аналитика Drivee</h1>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="card p-6"><h3 class="font-bold mb-4">Выручка по городам</h3><canvas id="chart1"></canvas></div>
                <div class="card p-6"><h3 class="font-bold mb-4">Статистика заказов</h3><canvas id="chart2"></canvas></div>
            </div>
        </div>
    `;
    const commonOptions = { responsive: true, plugins: { legend: { display: false } } };
    new Chart(document.getElementById('chart1'), {
        type: 'bar',
        data: { labels: ['Якутск', 'Иркутск', 'Москва', 'Казань'], datasets: [{ data: [450, 320, 890, 560], backgroundColor: '#A5F52C' }] },
        options: commonOptions
    });
    new Chart(document.getElementById('chart2'), {
        type: 'line',
        data: { labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], datasets: [{ data: [65, 59, 80, 81, 95, 120, 110], borderColor: '#A5F52C', tension: 0.4 }] },
        options: commonOptions
    });
}

function sendQuery() {
    const q = document.getElementById('queryInput').value;
    if(q) alert('Запрос ушел на бэк: ' + q);
}

function handleFileUpload(input) {
    if(input.files[0]) alert('Файл ' + input.files[0].name + ' готов к загрузке на бэк');
}

// Добавь в app.js

async function renderHistoryScreen(container) {
    container.innerHTML = '<div class="p-10 text-center">Загрузка истории...</div>';
    
    try {
        const response = await fetch(`http://${window.location.hostname}:8080/get_history`);
        const history = await response.json();
        
        let historyHtml = history.map(item => `
            <div class="card p-5 mb-4 flex items-center justify-between hover:border-[#A5F52C] transition-all cursor-pointer">
                <div class="flex items-center gap-4">
                    <div class="p-3 bg-gray-50 rounded-xl text-gray-400">
                        <i data-lucide="message-square" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800">${item.question}</h4>
                        <p class="text-xs text-gray-400">${new Date(item.query_date).toLocaleString('ru-RU')}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="px-3 py-1 ${item.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} rounded-full text-[11px] font-bold uppercase">
                        ${item.status}
                    </span>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300"></i>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="p-8 max-w-4xl mx-auto overflow-y-auto h-full">
                <div class="flex justify-between items-center mb-8">
                    <h1 class="text-2xl font-bold">История запросов</h1>
                    <button class="text-sm text-gray-400 hover:text-red-500 transition-colors">Очистить всё</button>
                </div>
                ${historyHtml || '<p class="text-center text-gray-400 mt-20">История пока пуста</p>'}
            </div>
        `;
        lucide.createIcons();
    } catch (e) {
        container.innerHTML = '<div class="p-10 text-red-500 text-center">Не удалось загрузить историю</div>';
    }
}


function showScreen(type) {
    const container = document.getElementById('main-content');
    if (type === 'main') {
        container.innerHTML = renderMainScreen();
    } else if (type === 'database') {
        renderDatabaseScreen(container);
    } else if (type === 'dashboards') {
        renderDashboardsScreen(container);
    } else if (type === 'history') {
        renderHistoryScreen(container); // Теперь вызываем новую функцию
    }
    lucide.createIcons();
}