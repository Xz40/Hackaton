document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Admin';
    document.getElementById('userName').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();
    
    // При загрузке показываем главный экран (старый дизайн)
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
        container.innerHTML = `<div class="p-10 text-gray-400">Экран "${type}" находится в разработке</div>`;
    }
    lucide.createIcons();
}

// ВНИМАНИЕ: Здесь твой ОРИГИНАЛЬНЫЙ дизайн
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

// Экран Базы Данных (отдельно от основного дизайна)
async function renderDatabaseScreen(container) {
    container.innerHTML = '<div class="p-10">Загрузка данных из PostgreSQL...</div>';
    try {
        const response = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await response.json();
        
        let rows = data.map(r => `
            <tr class="border-b text-sm">
                <td class="p-4 font-medium">#${r.id}</td>
                <td class="p-4">${r.city || 'Не указан'}</td>
                <td class="p-4 font-bold">${r.amount}₽</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div class="p-8 overflow-y-auto">
                <h1 class="text-2xl font-bold mb-6">База данных заказов</h1>
                <div class="card overflow-hidden">
                    <table class="w-full text-left">
                        <thead class="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr><th class="p-4">ID</th><th class="p-4">Город</th><th class="p-4">Сумма</th></tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        container.innerHTML = '<div class="p-10 text-red-500">Ошибка связи с БД</div>';
    }
}

// Экран Дашбордов
function renderDashboardsScreen(container) {
    container.innerHTML = `
        <div class="p-8 overflow-y-auto">
            <h1 class="text-2xl font-bold mb-8 text-black">Аналитика Drivee</h1>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="card p-6"><canvas id="chart1"></canvas></div>
                <div class="card p-6"><canvas id="chart2"></canvas></div>
            </div>
        </div>
    `;
    
    // Инициализация графиков (Chart.js)
    new Chart(document.getElementById('chart1'), {
        type: 'bar',
        data: {
            labels: ['Якутск', 'Иркутск', 'Хабаровск'],
            datasets: [{ label: 'Заказы', data: [450, 320, 210], backgroundColor: '#A5F52C' }]
        }
    });
}

function sendQuery() {
    const q = document.getElementById('queryInput').value;
    if(q) alert('Запрос ушел: ' + q);
}

function handleFileUpload(input) {
    const file = input.files[0];
    if(file) alert('Загружаем файл: ' + file.name);
}