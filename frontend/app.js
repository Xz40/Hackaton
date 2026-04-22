document.addEventListener('DOMContentLoaded', () => {
    const currentUser = localStorage.getItem('drivee_user');
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

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
    const title = document.getElementById('screen-title');
    if (!main) return;

    main.innerHTML = "";

    if (type === 'main') {
        title.innerText = "Аналитический ассистент";
        main.innerHTML = `
            <div class="flex-1 flex flex-col overflow-y-auto p-10 no-scrollbar chat-container" id="chatMessages">
                <div class="bot-message message shadow-sm">
                    👋 Добро пожаловать! Я интеллектуальный помощник Drivee.<br><br>
                    Я могу проанализировать ваши заказы по городам, посчитать выручку или вывести статистику. 
                    Просто напишите ваш вопрос в поле ниже.
                </div>
            </div>
            <div class="p-10 bg-gradient-to-t from-[#FBFBFB] via-[#FBFBFB] to-transparent">
                <div class="max-w-4xl mx-auto relative group">
                    <input id="queryInput" type="text" 
                           placeholder="Например: какая общая выручка в Якутске?" 
                           class="w-full bg-white p-6 pr-32 rounded-[2.5rem] shadow-2xl outline-none ring-[#A5F52C] focus:ring-2 border border-gray-100 text-lg transition-all">
                    <button onclick="sendQuery()" 
                            class="absolute right-3 top-3 bottom-3 px-10 bg-black text-[#A5F52C] rounded-[2rem] font-bold hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 shadow-lg">
                        <span>Спросить</span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                </div>
                <p class="text-center text-[10px] text-gray-400 mt-4 font-medium uppercase tracking-widest">SQL AI Engine v1.2 | Drivee Hackathon</p>
            </div>
        `;
        setupChatListeners();
    } else if (type === 'history') {
        title.innerText = "Архив аналитики";
        renderHistory(main);
    } else if (type === 'database') {
        title.innerText = "Реестр всех заказов";
        renderDatabase(main);
    } else if (type === 'dashboards') {
        title.innerText = "Визуализация показателей";
        renderDashboards(main);
    }
    
    lucide.createIcons();
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    const user = localStorage.getItem('drivee_user');

    if (!text || !chat) return;

    chat.innerHTML += `<div class="user-message message shadow-sm">${text}</div>`;
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`http://${window.location.hostname}:8080/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text, user_id: user })
        });

        const data = await response.json();
        
        chat.innerHTML += `
            <div class="bot-message message shadow-sm">
                <div class="text-[9px] text-gray-300 font-mono border-b border-gray-50 pb-2 mb-3 uppercase tracking-tighter">Generated SQL: ${data.sql}</div>
                <div class="text-gray-800 font-medium text-base">${data.message}</div>
                <div class="mt-4 flex items-center gap-2">
                    <span class="px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-bold border border-gray-100 italic">Найдено строк: ${data.row_count}</span>
                </div>
            </div>`;
    } catch (e) {
        chat.innerHTML += `<div class="bot-message message border-red-100 text-red-500">⚠️ Ошибка: Сервер не отвечает. Проверьте соединение.</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
    lucide.createIcons();
}

async function renderHistory(container) {
    container.innerHTML = '<div class="p-20 text-center text-gray-300 font-bold uppercase tracking-widest animate-pulse">Синхронизация...</div>';
    const user = localStorage.getItem('drivee_user');

    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_history?user_id=${user}`);
        const history = await res.json();
        
        const html = history.map(h => {
            const question = h.question || h[0];
            const date = h.query_date || h[1];
            const status = h.status || h[2];
            const count = h.row_count || h[3] || 0;

            return `
                <div class="bg-white border border-gray-100 p-6 mb-4 rounded-[1.5rem] flex justify-between items-center shadow-sm hover:shadow-md hover:border-[#A5F52C] transition-all cursor-default">
                    <div>
                        <p class="font-bold text-gray-800 text-base mb-1">${question}</p>
                        <div class="flex gap-4 items-center">
                            <p class="text-[11px] text-gray-400 font-medium">${new Date(date).toLocaleString()}</p>
                            <span class="text-[10px] bg-gray-50 px-3 py-0.5 rounded-full text-gray-400 font-black uppercase border border-gray-100">Rows: ${count}</span>
                        </div>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}">
                            ${status}
                        </span>
                    </div>
                </div>`;
        }).join('');
        
        container.innerHTML = `<div class="p-10 h-full overflow-y-auto no-scrollbar">${html || '<p class="text-center py-20 text-gray-300">История запросов пуста</p>'}</div>`;
    } catch (e) { 
        container.innerHTML = '<div class="p-20 text-red-400 text-center font-bold">ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ</div>'; 
    }
    lucide.createIcons();
}

async function renderDatabase(container) {
    container.innerHTML = '<div class="p-20 text-center text-gray-300 font-bold animate-pulse">ЗАГРУЗКА ДАННЫХ...</div>';
    try {
        const res = await fetch(`http://${window.location.hostname}:8080/get_data`);
        const data = await res.json();
        
        let rows = data.map(r => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td class="p-5 text-gray-300 text-[10px] font-mono">#${r.id || r[0]}</td>
                <td class="p-5 text-sm font-bold text-gray-700">${r.city || r[1]}</td>
                <td class="p-5 text-sm font-black text-gray-900">${parseFloat(r.amount || r[2]).toLocaleString()} ₽</td>
                <td class="p-5"><span class="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[9px] font-black uppercase">${r.status || r[3]}</span></td>
            </tr>
        `).join('');
        
        container.innerHTML = `
            <div class="p-10 h-full overflow-y-auto no-scrollbar">
                <table class="w-full bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm">
                    <thead class="bg-gray-50 text-left text-[11px] uppercase text-gray-400 font-black tracking-widest">
                        <tr><th class="p-5">ID</th><th class="p-5">Локация</th><th class="p-5">Сумма</th><th class="p-5">Статус</th></tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">${rows}</tbody>
                </table>
            </div>`;
    } catch (e) { 
        container.innerHTML = '<div class="p-20 text-red-500 text-center font-bold">ОШИБКА ЧТЕНИЯ ТАБЛИЦЫ</div>'; 
    }
}

function renderDashboards(container) {
    container.innerHTML = `
        <div class="p-10 h-full overflow-y-auto no-scrollbar grid grid-cols-1 gap-8">
            <div class="bg-white border border-gray-100 p-10 rounded-[2.5rem] shadow-sm">
                <div class="flex justify-between items-center mb-10">
                    <h4 class="font-black text-gray-400 text-[11px] uppercase tracking-[0.3em]">Выручка по регионам (Якутия / РФ)</h4>
                    <span class="px-4 py-1 bg-[#A5F52C] text-black rounded-full text-[10px] font-bold">LIVE DATA</span>
                </div>
                <canvas id="barChart" style="max-height: 350px;"></canvas>
            </div>
        </div>
    `;
    setTimeout(() => {
        const ctx = document.getElementById('barChart');
        if (ctx) {
            new Chart(ctx, { 
                type: 'bar', 
                data: { 
                    labels: ['Якутск', 'Москва', 'Иркутск', 'Мирный', 'Казань'], 
                    datasets: [{ 
                        data: [15400, 28000, 9200, 4100, 12500], 
                        backgroundColor: '#A5F52C', 
                        borderRadius: 20,
                        barThickness: 50
                    }] 
                },
                options: { 
                    plugins: { legend: { display: false } },
                    scales: { 
                        y: { beginAtZero: true, grid: { color: '#F9FAFB' }, border: { display: false } },
                        x: { grid: { display: false }, border: { display: false } }
                    }
                }
            });
        }
    }, 100);
}

function setupChatListeners() {
    const input = document.getElementById('queryInput');
    if(input) {
        input.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendQuery(); });
    }
}