/**
 *  КОМПОНЕНТ: ChatBubble — Пузырёк сообщения в чате (Modern Botanical)
 *
 * НАЗНАЧЕНИЕ:
 * Рендеринг одного сообщения в чате. Структура DOM соответствует шаблону
 * Modern Botanical (см. `!etc/design/modern-botanical/components.html` § 11
 * CHAT / MESSAGES):
 */

//  1. РЕНДЕРИНГ ПУЗЫРЯ СООБЩЕНИЯ  //

function renderChatBubble(options, currentUserId) {
    const data = normalizeChatBubbleInput(options, currentUserId);

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.classList.add(data.isMine ? 'chat-bubble-mine' : 'chat-bubble-theirs');

    // Текст — первым потомком, БЕЗ отдельной обёртки (как в шаблоне).
    bubble.appendChild(document.createTextNode(Utils.safeText(data.text, '')));

    const timeElement = document.createElement('div');
    timeElement.className = 'chat-bubble-time';
    timeElement.textContent = formatChatBubbleTime(data.time);
    bubble.appendChild(timeElement);

    return bubble;
}

function normalizeChatBubbleInput(options, currentUserId) {
    const opt = options || {};

    // Низкоуровневая форма: { text, time, isMine }
    if (typeof opt.isMine === 'boolean' || 'text' in opt && !('user_id_sender' in opt)) {
        return {
            text:   opt.text || '',
            time:   opt.time || '',
            isMine: !!opt.isMine,
        };
    }

    // API-форма: объект сообщения + currentUserId.
    return {
        text:   opt.message_text || '',
        time:   opt.time_created || '',
        isMine: parseInt(opt.user_id_sender, 10) === currentUserId,
    };
}

//  2. ФОРМАТИРОВАНИЕ ВРЕМЕНИ  //

function formatChatBubbleTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const time = hours + ':' + minutes;

    const isToday = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();

    if (isToday) return time;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return day + '.' + month + '.' + year + ' ' + time;
}
