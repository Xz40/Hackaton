document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('drivee_user');
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('userName').innerText = user;
    document.getElementById('avatar').innerText = user[0].toUpperCase();
    lucide.createIcons(); // Рисуем иконки
});

function useText(text) {
    document.getElementById('queryInput').value = text;
}

async function askML() {
    const input = document.getElementById('queryInput');
    const btn = document.getElementById('sendBtn');
    const query = input.value.trim();

    if (!query) return alert('Пустой запрос!');

    btn.disabled = true;
    btn.style.opacity = '0.5';

    try {
        const response = await fetch('http://78.36.198.54:8080/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt: query,
                user: localStorage.getItem('drivee_user')
            })
        });
        const data = await response.json();
        alert("Модель: " + (data.result || data.answer));
    } catch (err) {
        alert("Ошибка бэкенда. Проверь IP!");
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}