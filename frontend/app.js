document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('drivee_user');
    if (!user) { window.location.href = 'login.html'; return; }
    
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
    const main = document.getElementById('main-content');
    const inputZone = document.getElementById('input-zone');
    const rightPanel = document.getElementById('right-panel');
    const title = document.getElementById('screen-title');

    main.innerHTML = "";
    inputZone.style.display = (type === 'main') ? 'block' : 'none';
    
    if (type === 'main') {
        title.innerText = "Аналитический чат";
        renderRightPanel();
        appendMessage('bot', 'Привет! Я аналитический ассистент Drivee. Чем могу помочь сегодня?');
    } else if (type === 'database') {
        title.innerText = "База данных";
        renderDatabaseView();
    }
    lucide.createIcons();
}

function appendMessage(role, text) {
    const container = document.getElementById('main-content');
    const isBot = role === 'bot';
    const user = localStorage.getItem('drivee_user');

    const html = `
        <div class="message">
            <div class="message-avatar ${isBot ? 'bot-avatar' : 'user-avatar'}">
                ${isBot ? 'AI' : user[0].toUpperCase()}
            </div>
            <div class="message-body">
                <div class="message-name">${isBot ? 'Драйвиум ИИ' : 'Вы'}</div>
                <div class="message-text">${text}</div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    container.scrollTop = container.scrollHeight;
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const q = input.value.trim();
    if (!q) return;

    appendMessage('user', q);
    input.value = "";

    // Здесь будет твой fetch к бэкенду
    setTimeout(() => {
        appendMessage('bot', 'Анализирую данные по вашему запросу...');
    }, 500);
}

function renderRightPanel() {
    const panel = document.getElementById('right-panel');
    panel.innerHTML = `
        <h3 class="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-6">Быстрые действия</h3>
        <div class="space-y-4">
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p class="text-sm font-bold mb-1">Топ городов</p>
                <p class="text-xs text-gray-500 mb-3">Показать выручку по всем городам за неделю</p>
                <button class="w-full py-2 bg-white border border-gray-200 rounded-lg text-[11px] font-bold">ЗАПУСТИТЬ</button>
            </div>
        </div>
    `;
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}