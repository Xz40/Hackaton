document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // 1. Проверка авторизации
    const user = localStorage.getItem('drivee_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 2. Настройка профиля (имя и аватар)
    setupProfile(user);
    
    // 3. Инициализация навигации
    initNavigation();

    // 4. Первичная загрузка данных
    updateStats();
    clearChat();
});

// Настройка отображения профиля
function setupProfile(user) {
    const userNameElement = document.getElementById('userName');
    const avatarElement = document.getElementById('avatar');

    if (userNameElement) userNameElement.innerText = user;
    if (avatarElement) {
        avatarElement.innerText = user[0].toUpperCase();
        const colors = ['#A5F52C', '#00D1FF', '#FFB800', '#FF4D4D', '#9D4DFF'];
        avatarElement.style.backgroundColor = colors[user.length % colors.length];
    }
}

// Логика работы бокового меню
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            // Текст кнопки определяет экран
            const mode = this.innerText.trim();
            showView(mode);
        });
    });
}

// Переключение между Чатом, Историей и Данными
function showView(mode) {
    const chatView = document.getElementById('chatMessages');
    const footer = document.querySelector('.footer');
    const historyView = document.getElementById('historyView');
    const dataView = document.getElementById('dataView');
    const rightPanel = document.querySelector('.right-panel');

    // Скрываем все секции
    [chatView, footer, historyView, dataView, rightPanel].forEach(el => el?.classList.add('hidden'));

    if (mode.includes('Главная')) {
        chatView.classList.remove('hidden');
        footer.classList.remove('hidden');
        rightPanel.classList.remove('hidden');
    } else if (mode.includes('История')) {
        historyView.classList.remove('hidden');
        loadHistory(); // Загружаем данные с бека при переходе
    } else if (mode.includes('Данные')) {
        dataView.classList.remove('hidden');
        loadDatabases(); // Загружаем данные с бека при переходе
    }
}

// Отправка запроса в чат
async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();

    if (!text) return;

    // Добавляем сообщение пользователя
    chat.innerHTML += `<div class="msg user">${text}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch('http://78.36.198.54:8080/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: localStorage.getItem('drivee_user') || 'Admin' 
            })
        });

        const data = await response.json();

        // Добавляем ответ бота
        chat.innerHTML += `
            <div class="msg bot">
                ${data.message}
                ${data.sql ? `<div style="font-size: 10px; opacity: 0.4; margin-top: 10px; font-family: monospace; border-top: 1px solid #ddd; padding-top: 5px">SQL: ${data.sql}</div>` : ''}
            </div>
        `;
        
        // После успешного ответа обновляем статистику в правой панели
        updateStats();

    } catch (err) {
        chat.innerHTML += `<div class="msg bot" style="color: red;">Ошибка связи с сервером. Проверьте бекенд.</div>`;
    }

    chat.scrollTop = chat.scrollHeight;
}

// Загрузка реальной истории из system.db
async function loadHistory() {
    const list = document.getElementById('historyList');
    // Берем текущего юзера из локального хранилища
    const currentUser = localStorage.getItem('drivee_user') || 'Admin';

    try {
        // Передаем user_id в параметрах URL
        const response = await fetch(`http://78.36.198.54:8080/history?user_id=${currentUser}`);
        const history = await response.json();
        
        if (history.length === 0) {
            list.innerHTML = '<div class="item-card">У вас пока нет запросов</div>';
            return;
        }

        list.innerHTML = history.map(item => `
            <div class="item-card">
                <div class="card-info">
                    <h4>${item.question}</h4>
                    <p>${new Date(item.timestamp).toLocaleString()} • Личный запрос</p>
                </div>
                <i data-lucide="chevron-right" style="width:16px; color:#CCC"></i>
            </div>
        `).join('');
        
        lucide.createIcons();
    } catch (err) {
        list.innerHTML = '<div class="item-card" style="color:red">Ошибка загрузки вашей истории</div>';
    }
}

// Загрузка списка баз данных
async function loadDatabases() {
    const list = document.getElementById('dbList');
    try {
        const response = await fetch('http://78.36.198.54:8080/databases');
        const dbs = await response.json();

        list.innerHTML = dbs.map(db => `
            <div class="item-card">
                <div class="card-info">
                    <h4>${db.name}</h4>
                    <p>${db.db_type} • Статус: ${db.status}</p>
                </div>
                <div class="status-dot" style="background: ${db.status === 'Online' ? '#A5F52C' : '#FF4D4D'}"></div>
            </div>
        `).join('');
        
        lucide.createIcons();
    } catch (err) {
        list.innerHTML = '<div class="item-card" style="color:red">Ошибка загрузки баз</div>';
    }
}

// Обновление статистики в правой панели
async function updateStats() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const response = await fetch(`http://78.36.198.54:8080/stats?user_id=${user}`);
        const stats = await response.json();
        
        const statElements = document.querySelectorAll('.stat-item');
        if (statElements.length >= 2) {
            statElements[0].innerText = `Запросов сегодня: ${stats.requests_today}`;
            statElements[1].innerText = `Точность AI: ${stats.accuracy}`;
        }
    } catch (err) {
        console.error("Не удалось обновить статистику");
    }
}

function clearChat() {
    const chat = document.getElementById('chatMessages');
    if (chat) {
        chat.innerHTML = `<div class="msg bot">Привет! Я готов анализировать данные Drivee. Что ищем сегодня?</div>`;
    }
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}