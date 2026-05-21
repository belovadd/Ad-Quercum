/**
 *  СТРАНИЦА: Сообщения (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 *   Двухпанельный личный чат: список бесед слева, переписка справа. Использует
 *   `conversation_row_component` для строк диалогов, `chat_bubble_component` —
 *   для пузырей сообщений, `empty_state_component` — для пустых состояний.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const pageState = {
    currentUser: null,
    conversations: [],
    selectedPartnerId: null,
    isMobileChatOpen: false,
    messages: [],
    messagesPage: 1,
    messagesTotalPages: 1,
    pollTimer: null,
    urlPartnerId: null,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initMessagesPage() {
    try {
        const user = await AuthGuard.requireAuth();
        if (!user) return;

        pageState.currentUser = user;

        if (typeof initNavigation === 'function') {
            initNavigation(user);
        }

        const urlPartnerId = Utils.getUrlParam('user_id');
        if (urlPartnerId) {
            pageState.urlPartnerId = parseInt(urlPartnerId, 10);
        }

        await loadConversations();
        bindEvents();
        startPolling();
    } catch (error) {
        Notification.error('Ошибка загрузки страницы');
    }
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadConversations() {
    try {
        const data = await SocialService.getConversations();
        pageState.conversations = Array.isArray(data) ? data : (data.items || []);

        renderConversations();

        if (!pageState.selectedPartnerId) {
            const initialPartnerId = pageState.urlPartnerId || (isMobileMessagesLayout() ? null : getFirstConversationPartnerId());
            if (initialPartnerId) {
                await handleSelectConversation(initialPartnerId);
            }
            pageState.urlPartnerId = null;
        }

        syncMobileMessagesLayout();
    } catch (error) {
        Notification.error('Не удалось загрузить беседы');
    }
}

async function loadMessages(partnerId) {
    try {
        pageState.messagesPage = 1;
        const data = await SocialService.getMessages(partnerId, pageState.messagesPage);

        pageState.messages = data.items || [];
        pageState.messagesTotalPages = data.total_pages || 1;

        if (clearConversationUnreadCount(partnerId)) {
            renderConversations();
        }

        renderMessages();
        scrollToBottom();
        refreshNavbarUnreadBadge();
    } catch (error) {
        Notification.error('Не удалось загрузить сообщения');
    }
}

async function loadMoreMessages() {
    if (pageState.messagesPage >= pageState.messagesTotalPages) return;

    try {
        pageState.messagesPage += 1;
        const data = await SocialService.getMessages(pageState.selectedPartnerId, pageState.messagesPage);

        pageState.messages = (data.items || []).concat(pageState.messages);
        pageState.messagesTotalPages = data.total_pages || 1;

        renderMessages();
    } catch (error) {
        Notification.error('Не удалось загрузить историю');
    }
}

//  4. РЕНДЕРИНГ: БЕСЕДЫ  //

function renderConversations() {
    const container = Utils.getElement('conversations-list');
    if (!container) return;

    Utils.clearChildren(container);

    if (pageState.conversations.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Нет бесед',
            iconName: 'message-circle',
            subtitle: 'Начните диалог из профиля друга',
        }));
        return;
    }

    pageState.conversations.forEach(function (conv) {
        const partnerId = getConversationPartnerId(conv);
        const peer = getConversationPeer(conv);

        const adapted = {
            conversation_id: conv.conversation_id,
            peer_user: peer,
            last_message_text: conv.last_message_text,
            last_message_time: conv.last_message_time,
            unread_count: conv.unread_count,
        };

        const row = renderConversationRow({
            conversation: adapted,
            isActive: partnerId === pageState.selectedPartnerId,
            onSelect: function () {
                handleSelectConversation(partnerId);
            },
        });

        container.appendChild(row);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  5. РЕНДЕРИНГ: СООБЩЕНИЯ  //

function renderMessages() {
    const container = Utils.getElement('messages-list');
    if (!container) return;

    Utils.clearChildren(container);

    if (!pageState.selectedPartnerId) {
        container.appendChild(renderEmptyState({
            message: 'Выберите беседу',
            iconName: 'message-square',
            subtitle: 'Чтобы начать переписку, выберите чат слева',
        }));
        return;
    }

    if (pageState.messages.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Сообщений пока нет',
            iconName: 'message-square',
            subtitle: 'Напишите первое сообщение собеседнику',
        }));
        return;
    }

    if (pageState.messagesPage < pageState.messagesTotalPages) {
        const loadMoreButton = document.createElement('button');
        loadMoreButton.type = 'button';
        loadMoreButton.className = 'btn btn-ghost messages-load-more';
        loadMoreButton.textContent = 'Загрузить ещё';
        loadMoreButton.addEventListener('click', loadMoreMessages);
        container.appendChild(loadMoreButton);
    }

    const currentUserId = parseInt(pageState.currentUser.id, 10);

    pageState.messages.forEach(function (message) {
        const bubble = renderChatBubble(message, currentUserId);
        container.appendChild(bubble);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function updateChatHeader() {
    const headerElement = Utils.getElement('chat-header-name');
    const statusElement = document.querySelector('.chat-header-status');
    const avatarElement = Utils.getElement('chat-header-avatar');
    if (!headerElement) return;

    if (!pageState.selectedPartnerId) {
        headerElement.textContent = 'Сообщения';
        headerElement.classList.remove('has-peer');
        if (statusElement) statusElement.textContent = 'Выберите беседу слева';
        if (statusElement) statusElement.classList.remove('has-peer-meta');
        if (avatarElement) {
            Utils.clearChildren(avatarElement);
            avatarElement.removeAttribute('href');
            avatarElement.removeAttribute('aria-label');
            Utils.hideElement(avatarElement);
        }
        return;
    }

    const conv = pageState.conversations.find(function (c) {
        return getConversationPartnerId(c) === pageState.selectedPartnerId;
    });

    if (conv) {
        const peer = getConversationPeer(conv);
        const displayName = getPeerDisplayName(peer);
        renderChatHeaderIdentity(headerElement, peer, displayName);
        if (statusElement) {
            renderChatHeaderMeta(statusElement, peer);
        }
        renderChatHeaderAvatar(peer, displayName);
    } else {
        headerElement.textContent = 'Чат';
        headerElement.classList.remove('has-peer');
        if (statusElement) statusElement.textContent = 'Личная беседа';
        if (statusElement) statusElement.classList.remove('has-peer-meta');
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function getConversationPartnerId(conversation) {
    const conv = conversation || {};
    const peer = conv.peer_user || {};
    return parseInt(conv.partner_id || peer.user_id || peer.id, 10);
}

function getFirstConversationPartnerId() {
    if (pageState.conversations.length === 0) return null;
    const partnerId = getConversationPartnerId(pageState.conversations[0]);
    return Number.isFinite(partnerId) ? partnerId : null;
}

function getConversationPeer(conversation) {
    const conv = conversation || {};
    const partnerId = getConversationPartnerId(conv);
    return conv.peer_user || {
        user_id: partnerId,
        user_name_first: conv.user_name_first,
        user_name_last: conv.user_name_last,
        user_email: conv.user_email,
        user_avatar_path: conv.user_avatar_path,
        user_profile_identifier: conv.user_profile_identifier,
        books_count: conv.books_count,
        friends_count: conv.friends_count,
        publications_count: conv.publications_count,
    };
}

function getPeerDisplayName(peer) {
    return Utils.composeUserName(peer, 'Пользователь', { useIdentifier: false, useEmail: true });
}

function renderChatHeaderIdentity(headerElement, peer, displayName) {
    const handle = Utils.safeText(peer.user_profile_identifier, '');
    const profileUrl = getPeerProfileUrl(peer);

    Utils.clearChildren(headerElement);
    headerElement.classList.add('has-peer');

    const nameElement = document.createElement(profileUrl ? 'a' : 'span');
    nameElement.className = 'user-name friend-profile-link';
    if (profileUrl) nameElement.href = profileUrl;
    nameElement.textContent = displayName;
    headerElement.appendChild(nameElement);

    if (handle) {
        const handleElement = document.createElement('span');
        handleElement.className = 'user-handle';
        handleElement.textContent = '@' + handle;
        headerElement.appendChild(handleElement);
    }
}

function getPeerProfileUrl(peer) {
    return Utils.getUserProfileUrl(peer);
}

function renderChatHeaderMeta(statusElement, peer) {
    Utils.clearChildren(statusElement);
    statusElement.classList.add('has-peer-meta');

    appendPeerMetaItem(statusElement, 'book-copy', peer.books_count, 'книг');
    appendPeerMetaItem(statusElement, 'users', peer.friends_count, 'друзей');
    appendPeerMetaItem(statusElement, 'message-square', peer.publications_count, 'публикаций');

    if (statusElement.childElementCount === 0) {
        statusElement.classList.remove('has-peer-meta');
        statusElement.textContent = 'Личная беседа';
    }
}

function appendPeerMetaItem(container, iconName, value, word) {
    if (value === null || value === undefined) return;

    const item = document.createElement('span');
    item.className = 'user-meta-item';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    item.appendChild(icon);

    const text = document.createElement('span');
    text.textContent = String(value) + ' ' + word;
    item.appendChild(text);

    container.appendChild(item);
}

function renderChatHeaderAvatar(peer, displayName) {
    const avatarElement = Utils.getElement('chat-header-avatar');
    if (!avatarElement) return;
    const profileUrl = getPeerProfileUrl(peer);

    Utils.clearChildren(avatarElement);
    Utils.showElement(avatarElement);
    if (profileUrl) {
        avatarElement.href = profileUrl;
        avatarElement.setAttribute('aria-label', 'Открыть профиль ' + displayName);
    } else {
        avatarElement.removeAttribute('href');
        avatarElement.removeAttribute('aria-label');
    }

    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(peer.user_avatar_path);
    img.alt = displayName;
    avatarElement.appendChild(img);
}

function scrollToBottom() {
    const container = Utils.getElement('messages-list');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

function isMobileMessagesLayout() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function syncMobileMessagesLayout() {
    const layout = document.querySelector('.chat-layout');
    if (!layout) return;

    layout.classList.remove('is-contacts-open', 'is-chat-open');

    if (!isMobileMessagesLayout()) {
        return;
    }

    layout.classList.add(pageState.isMobileChatOpen ? 'is-chat-open' : 'is-contacts-open');
}

function clearConversationUnreadCount(partnerId) {
    const normalizedPartnerId = parseInt(partnerId, 10);
    if (!Number.isFinite(normalizedPartnerId)) return false;

    let hasChanges = false;

    pageState.conversations.forEach(function (conversation) {
        if (getConversationPartnerId(conversation) !== normalizedPartnerId) return;
        if ((Number(conversation.unread_count) || 0) === 0) return;

        conversation.unread_count = 0;
        hasChanges = true;
    });

    return hasChanges;
}

//  6. ОБРАБОТЧИКИ  //

async function handleSelectConversation(partnerId) {
    pageState.selectedPartnerId = partnerId;
    pageState.isMobileChatOpen = true;
    updateChatHeader();
    renderConversations();
    syncMobileMessagesLayout();

    await loadMessages(partnerId);

    const formElement = Utils.getElement('message-form');
    if (formElement) {
        Utils.showElement(formElement);
    }
}

function handleBackToConversations() {
    pageState.isMobileChatOpen = false;
    syncMobileMessagesLayout();
}

async function handleSendMessage() {
    if (!pageState.selectedPartnerId) return;

    const textInput = Utils.getElement('message-input');
    if (!textInput) return;

    const text = textInput.value.trim();
    if (text === '') return;

    if (text.length > MAX_MESSAGE_TEXT_LENGTH) {
        Notification.error('Сообщение слишком длинное (максимум ' + MAX_MESSAGE_TEXT_LENGTH + ' символов)');
        return;
    }

    try {
        await SocialService.sendMessage(pageState.selectedPartnerId, text);
        textInput.value = '';

        await loadMessages(pageState.selectedPartnerId);
        await loadConversations();
    } catch (error) {
        Notification.error(error.message || 'Не удалось отправить сообщение');
    }
}

async function handlePoll() {
    try {
        const data = await SocialService.getConversations();
        pageState.conversations = Array.isArray(data) ? data : (data.items || []);
        renderConversations();
        refreshNavbarUnreadBadge();

        if (pageState.selectedPartnerId) {
            const messagesData = await SocialService.getMessages(pageState.selectedPartnerId, 1);
            if (clearConversationUnreadCount(pageState.selectedPartnerId)) {
                renderConversations();
                refreshNavbarUnreadBadge();
            }

            const oldCount = pageState.messages.length;
            const newTotalOnFirstPage = (messagesData.items || []).length;

            if (pageState.messagesPage === 1 && newTotalOnFirstPage !== oldCount) {
                pageState.messages = messagesData.items || [];
                pageState.messagesTotalPages = messagesData.total_pages || 1;
                renderMessages();
                scrollToBottom();
                refreshNavbarUnreadBadge();
            }
        }
    } catch (error) {
    }
}

function startPolling() {
    if (pageState.pollTimer) clearInterval(pageState.pollTimer);
    pageState.pollTimer = setInterval(handlePoll, CHAT_POLL_INTERVAL_MS);
}

function refreshNavbarUnreadBadge() {
    if (typeof refreshNavigationUnreadCount === 'function') {
        refreshNavigationUnreadCount();
    }
}

//  7. ПРИВЯЗКА СОБЫТИЙ  //

function bindEvents() {
    const sendButton = Utils.getElement('send-button');
    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }

    const backButton = Utils.getElement('chat-back-button');
    if (backButton) {
        backButton.addEventListener('click', handleBackToConversations);
    }

    const textInput = Utils.getElement('message-input');
    if (textInput) {
        textInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
            }
        });
    }

    window.addEventListener('resize', syncMobileMessagesLayout);
}

//  8. ЗАПУСК  //

function destroy() {
    if (pageState.pollTimer) {
        clearInterval(pageState.pollTimer);
        pageState.pollTimer = null;
    }

    window.removeEventListener('resize', syncMobileMessagesLayout);
}

PageRegistry.register('messages', {
    init: initMessagesPage,
    destroy: destroy,
});
})();
