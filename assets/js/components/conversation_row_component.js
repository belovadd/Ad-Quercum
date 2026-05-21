/**
 *  КОМПОНЕНТ: ConversationRow — Строка диалога в списке чатов 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<div class="chat-conversation">` для левой колонки `messages.html`.
 *   Внутри: аватар собеседника, имя, превью последнего сообщения, время и счётчик
 *   непрочитанных. Класс `.is-active` — для текущего открытого чата.
 */

function renderConversationRow(props) {
    const p = props || {};
    const conv = p.conversation || {};
    const peer = conv.peer_user || {};

    const row = document.createElement('div');
    row.className = 'chat-conversation';
    if (p.isActive) row.classList.add('is-active');
    if (conv.conversation_id) row.dataset.conversationId = conv.conversation_id;
    if (peer.user_id) row.dataset.peerId = peer.user_id;

    // --- Аватар ---
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'chat-conv-avatar user-avatar';
    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(peer.user_avatar_path);
    img.alt = composeConversationPeerName(peer);
    avatarWrap.appendChild(img);
    row.appendChild(avatarWrap);

    // --- Информация: имя и превью ---
    const info = document.createElement('div');
    info.className = 'chat-conv-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'chat-conv-name';
    nameEl.textContent = composeConversationPeerName(peer);
    info.appendChild(nameEl);

    const preview = document.createElement('div');
    preview.className = 'chat-conv-last';
    Utils.setSafeText(preview, conv.last_message_text, { fallback: 'Нет сообщений' });
    info.appendChild(preview);

    row.appendChild(info);

    // --- Мета: время и непрочитанные ---
    const meta = document.createElement('div');
    meta.className = 'chat-conv-meta';

    if (conv.last_message_time) {
        const time = document.createElement('div');
        time.className = 'chat-conv-time';
        time.textContent = formatConversationTime(conv.last_message_time);
        meta.appendChild(time);
    }

    const unread = Number(conv.unread_count) || 0;
    if (unread > 0) {
        const badge = document.createElement('div');
        badge.className = 'chat-conv-badge';
        badge.textContent = unread > 99 ? '99+' : String(unread);
        meta.appendChild(badge);
    }

    if (meta.childElementCount > 0) row.appendChild(meta);

    // --- Клик ---
    row.classList.add('is-clickable');
    row.addEventListener('click', (event) => {
        event.preventDefault();
        if (p.onSelect) p.onSelect(conv);
    });

    return row;
}

function composeConversationPeerName(peer) {
    return Utils.composeUserName(peer, 'Собеседник');
}

function formatConversationTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const sameDay = date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();

    const pad = (n) => String(n).padStart(2, '0');

    if (sameDay) {
        return pad(date.getHours()) + ':' + pad(date.getMinutes());
    }
    return pad(date.getDate()) + '.' + pad(date.getMonth() + 1);
}

window.renderConversationRow = renderConversationRow;
