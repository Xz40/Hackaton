const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:8080`;

(function checkAuth() {
    const user = localStorage.getItem('drivee_user');
    if (!user && !window.location.pathname.includes('login.html')) {
        window.location.href = 'login.html';
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    const user = localStorage.getItem('drivee_user') || 'Admin';
    document.getElementById('userName').innerText = user;
    loadLlmConfig();
    updateStats();
    clearChat();
});

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderDataTable(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return '';

    const columns = Array.from(
        rows.reduce((set, row) => {
            Object.keys(row || {}).forEach((k) => set.add(k));
            return set;
        }, new Set())
    );
    if (columns.length === 0) return '';

    const thead = `<thead><tr>${columns.map((c) => `<th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.15);">${escapeHtml(c)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map((row) => `<tr>${columns.map((c) => `<td style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.08);vertical-align:top;">${escapeHtml(row?.[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<div style="margin-top:10px;overflow:auto;max-height:280px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                    ${thead}
                    ${tbody}
                </table>
            </div>`;
}

function updateEngineTag(provider, model) {
    const tag = document.getElementById('engineTag');
    if (!tag) return;
    const label = provider === 'grok' ? `GROQ · ${model}` : `OLLAMA · ${model}`;
    tag.innerHTML = `<i data-lucide="zap"></i> ${escapeHtml(label)}`;
    lucide.createIcons();
}

async function loadLlmConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/llm/config`);
        const data = await res.json();
        const select = document.getElementById('llmProvider');
        if (select && data.provider) {
            select.value = data.provider;
        }
        updateEngineTag(data.provider, data.model || '');
    } catch (e) {}
}

async function setLlmProvider() {
    const select = document.getElementById('llmProvider');
    if (!select) return;
    const provider = select.value;
    try {
        const res = await fetch(`${API_BASE_URL}/llm/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider })
        });
        const data = await res.json();
        if (data.status === 'error') {
            alert(data.message || 'Не удалось сменить модель');
            return;
        }
        updateEngineTag(data.provider, data.model || '');
        const chat = document.getElementById('chatMessages');
        chat.innerHTML += `<div class="msg bot">Модель переключена: ${escapeHtml(data.provider)} (${escapeHtml(data.model || '')})</div>`;
        chat.scrollTop = chat.scrollHeight;
    } catch (e) {
        alert('Ошибка при переключении модели');
    }
}

async function sendQuery() {
    const input = document.getElementById('queryInput');
    const chat = document.getElementById('chatMessages');
    const text = input.value.trim();
    if (!text) return;

    // Сообщение пользователя
    chat.innerHTML += `<div class="msg user">${escapeHtml(text)}</div>`;
    input.value = "";
    chat.scrollTop = chat.scrollHeight;

    try {
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: text, 
                user_id: localStorage.getItem('drivee_user') || 'Admin' 
            })
        });
        
        const data = await response.json();

        // Формируем ответ бота
        let botHtml = `<div class="msg bot">`;
        
        // Показываем SQL, если он есть (полезно для отладки)
        if (data.sql) {
            botHtml += `<div style="font-family:monospace; font-size:10px; background:rgba(0,0,0,0.3); padding:8px; margin-bottom:10px; border-left:3px solid #A5F52C; color:#eee; overflow-x:auto;">
                            ${escapeHtml(data.sql)}
                        </div>`;
        }
        
        botHtml += `<div>${escapeHtml(data.message || '')}</div>`;
        if (Array.isArray(data.data) && data.data.length > 0) {
            botHtml += renderDataTable(data.data);
        }
        botHtml += `</div>`;
        
        chat.innerHTML += botHtml;
        updateStats();
    } catch (e) {
        chat.innerHTML += `<div class="msg bot" style="color:#FF4D4D">Ошибка связи с сервером</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}

async function loadHistory() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const res = await fetch(`${API_BASE_URL}/history?user_id=${user}`);
        const data = await res.json();
        document.getElementById('historyList').innerHTML = data.map(h => `
            <div class="item-box">
                <div>
                    <strong>${h.question}</strong><br>
                    <small style="color:#AAA">${new Date(h.timestamp).toLocaleString()}</small>
                </div>
                <i data-lucide="chevron-right"></i>
            </div>
        `).join('');
        lucide.createIcons();
    } catch(e) {}
}

async function loadDatabases() {
    try {
        const res = await fetch(`${API_BASE_URL}/databases`);
        const data = await res.json();
        document.getElementById('dbList').innerHTML = data.map(db => `
            <div class="item-box">
                <div><strong>${db.name}</strong><br><small style="color:#AAA">${db.db_type}</small></div>
                <div class="status-dot" style="background:${db.status === 'Online' ? '#A5F52C' : '#FF4D4D'}"></div>
            </div>
        `).join('');
    } catch(e) {}
}

async function updateStats() {
    const user = localStorage.getItem('drivee_user') || 'Admin';
    try {
        const res = await fetch(`${API_BASE_URL}/stats?user_id=${user}`);
        const data = await res.json();
        document.getElementById('statRequests').innerText = `Запросов: ${data.requests_today}`;
    } catch(e) {}
}

function clearChat() {
    document.getElementById('chatMessages').innerHTML = '<div class="msg bot">Привет! Я аналитик Drivee. Какой отчет сформировать?</div>';
}

function showView(mode) {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(i => {
        i.classList.remove('active');
        if(i.innerText.includes(mode)) i.classList.add('active');
    });
    ['mainView', 'historyView', 'dataView'].forEach(id => document.getElementById(id).classList.add('hidden'));
    if (mode === 'Главная') document.getElementById('mainView').classList.remove('hidden');
    if (mode === 'История') { document.getElementById('historyView').classList.remove('hidden'); loadHistory(); }
    if (mode === 'Данные') { document.getElementById('dataView').classList.remove('hidden'); loadDatabases(); }
}

function logout() {
    localStorage.removeItem('drivee_user');
    window.location.href = 'login.html';
}