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
    const content = document.getElementById('content-area');
    content.innerHTML = "";

    if (type === 'main') {
        content.innerHTML = `
            <div class="chat-bubble user">
                Покажи отмены по городам за прошлую неделю
                <span class="time">10:42 <i data-lucide="check-check" style="width:14px"></i></span>
            </div>
            
            <div class="chat-bubble bot-text">
                Вот количество отмен по городам за прошлую неделю
                <span class="time" style="float:right">10:43</span>
            </div>

            <div class="chart-container">
                <div class="chart-header" style="display:flex; justify-content:space-between; margin-bottom:20px">
                    <div>
                        <h4 style="font-weight:700">Отмены по городам</h4>
                        <p style="font-size:12px; color:#999">за прошлую неделю (13 апреля - 19 апреля 2026)</p>
                    </div>
                    <i data-lucide="maximize-2" style="color:#CCC; cursor:pointer"></i>
                </div>
                <div style="height:250px; display:flex; align-items:flex-end; gap:12px; padding-bottom:20px; border-bottom:1px solid #EEE">
                    <div style="flex:1; background:#A5F52C; height:80%; border-radius:4px"></div>
                    <div style="flex:1; background:#A5F52C; height:60%; border-radius:4px"></div>
                    <div style="flex:1; background:#A5F52C; height:40%; border-radius:4px"></div>
                    <div style="flex:1; background:#A5F52C; height:35%; border-radius:4px"></div>
                    <div style="flex:1; background:#A5F52C; height:20%; border-radius:4px"></div>
                </div>
                <p style="font-size:13px; margin-top:15px">Наибольшее количество отмен зафиксировано в Москве — 2 340.</p>
                <p style="font-size:11px; color:#BBB; margin-top:10px">Данные актуальны на 22.04.2026</p>
            </div>
        `;
    }
    // ... другие экраны (history, database) ...
    lucide.createIcons();
}

function sendQuery() {
    const input = document.getElementById('queryInput');
    if (!input.value.trim()) return;
    
    // Эмуляция отправки
    const content = document.getElementById('content-area');
    content.innerHTML += `<div class="chat-bubble user">${input.value}</div>`;
    input.value = "";
    content.scrollTop = content.scrollHeight;
}