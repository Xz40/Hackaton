function showScreen(type) {
    const main = document.getElementById('main-content');
    const title = document.getElementById('screen-title');
    if (!main) return;

    main.innerHTML = "";

    if (type === 'main') {
        title.innerText = "Аналитический чат";
        main.innerHTML = `
            <div class="flex-1 flex flex-col overflow-hidden p-8 chat-container" id="chatMessages">
                <div class="bot-message message">
                    👋 Привет! Я твой AI-ассистент Drivee. Могу посчитать выручку, найти заказы или проанализировать города. Что хочешь узнать?
                </div>
            </div>
            <div class="p-8 bg-gradient-to-t from-[#FBFBFB] via-[#FBFBFB] to-transparent">
                <div class="max-w-4xl mx-auto relative group">
                    <input id="queryInput" type="text" 
                           placeholder="Напишите ваш запрос здесь..." 
                           class="w-full bg-white p-6 pr-20 rounded-[2rem] shadow-xl outline-none ring-[#A5F52C] focus:ring-2 border border-gray-100 text-lg transition-all">
                    <button onclick="sendQuery()" 
                            class="absolute right-3 top-3 bottom-3 px-8 bg-black text-white rounded-[1.5rem] font-bold hover:bg-[#A5F52C] hover:text-black transition-all flex items-center gap-2">
                        <span>Спросить</span>
                        <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
        setupChatListeners();
    } else if (type === 'history') {
        title.innerText = "История запросов";
        renderHistory(main);
    } else if (type === 'database') {
        title.innerText = "Реестр заказов";
        renderDatabase(main);
    }
    
    lucide.createIcons();
}