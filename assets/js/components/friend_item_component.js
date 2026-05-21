/**
 *  КОМПОНЕНТ: FriendItem — Строка списка друзей / запросов 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<div class="friend-item">` с аватаром, именем, handle и набором
 *   кнопок действий, зависящих от статуса связи между пользователями:
 *     - 'friend'   — «Сообщение», «Удалить из друзей»
 *     - 'incoming' — «Принять», «Отклонить»
 *     - 'outgoing' — «Отменить запрос»
 *     - 'pending'  — лейбл «Ожидание» без кнопок
 */

function renderFriendItem(props) {
    const p = props || {};
    const user = p.user || {};
    const status = p.status || 'friend';

    const item = document.createElement('div');
    item.className = 'friend-item';
    if (user.user_id) item.dataset.userId = user.user_id;

    // --- Аватар ---
    item.appendChild(buildFriendAvatarLink(user));

    // --- Информация: имя и handle ---
    const info = document.createElement('div');
    info.className = 'friend-info';

    const identity = document.createElement('div');
    identity.className = 'friend-identity';

    const nameEl = buildFriendProfileLink(user, 'friend-name friend-profile-link');
    nameEl.textContent = composeFriendDisplayName(user);
    identity.appendChild(nameEl);

    const handleEl = document.createElement('span');
    handleEl.className = 'friend-handle';
    handleEl.textContent = '@' + Utils.safeText(user.user_profile_identifier, 'user');
    identity.appendChild(handleEl);

    info.appendChild(identity);

    const meta = document.createElement('div');
    meta.className = 'user-meta friend-meta';
    appendFriendMetaItem(meta, 'book-copy', user.books_count, 'книг');
    appendFriendMetaItem(meta, 'users', user.friends_count, 'друзей');
    appendFriendMetaItem(meta, 'message-square', user.publications_count, 'публикаций');
    if (meta.childElementCount > 0) info.appendChild(meta);

    item.appendChild(info);

    // --- Действия ---
    const actions = document.createElement('div');
    actions.className = 'friend-actions';

    if (status === 'friend') {
        if (p.onMessage) {
            actions.appendChild(makeFriendButton({
                label: 'Сообщение',
                icon: 'message-circle',
                modifier: 'btn-primary',
                onClick: p.onMessage,
            }));
        }
        if (p.onRemove) {
            actions.appendChild(makeFriendButton({
                label: 'Удалить',
                icon: 'user-minus',
                modifier: 'btn-danger-ghost',
                onClick: p.onRemove,
            }));
        }
    } else if (status === 'incoming') {
        if (p.onAccept) {
            actions.appendChild(makeFriendButton({
                label: 'Принять',
                icon: 'check',
                modifier: 'btn-primary',
                onClick: p.onAccept,
            }));
        }
        if (p.onDecline) {
            actions.appendChild(makeFriendButton({
                label: 'Отклонить',
                icon: 'x',
                modifier: 'btn-danger-ghost',
                onClick: p.onDecline,
            }));
        }
    } else if (status === 'outgoing') {
        if (p.onCancel) {
            actions.appendChild(makeFriendButton({
                label: 'Отменить',
                icon: 'x',
                modifier: 'btn-danger-ghost',
                onClick: p.onCancel,
            }));
        }
    } else if (status === 'pending') {
        const pending = document.createElement('span');
        pending.className = 'tag tag-secondary';
        pending.textContent = 'Ожидание';
        actions.appendChild(pending);
    }

    item.appendChild(actions);
    return item;
}

function composeFriendDisplayName(user) {
    return Utils.composeUserName(user, 'Без имени');
}

function buildFriendAvatar(user) {
    const wrap = document.createElement('span');
    wrap.className = 'user-avatar';

    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(user && user.user_avatar_path);
    img.alt = composeFriendDisplayName(user || {});
    wrap.appendChild(img);

    return wrap;
}

function buildFriendAvatarLink(user) {
    const href = getFriendProfileUrl(user);
    if (!href) {
        return buildFriendAvatar(user);
    }

    const link = document.createElement('a');
    link.className = 'user-avatar friend-avatar-link';
    link.href = href;
    link.setAttribute('aria-label', 'Открыть профиль ' + composeFriendDisplayName(user));

    const avatar = buildFriendAvatar(user);
    while (avatar.firstChild) {
        link.appendChild(avatar.firstChild);
    }

    return link;
}

function buildFriendProfileLink(user, className) {
    const href = getFriendProfileUrl(user);
    const element = document.createElement(href ? 'a' : 'div');
    element.className = className;
    if (href) element.href = href;
    return element;
}

function getFriendProfileUrl(user) {
    return Utils.getUserProfileUrl(user);
}

function appendFriendMetaItem(container, icon, value, word) {
    if (value === null || value === undefined) return;

    const item = document.createElement('span');
    item.className = 'user-meta-item';

    const iconElement = document.createElement('i');
    iconElement.setAttribute('data-lucide', icon);
    item.appendChild(iconElement);

    const text = document.createElement('span');
    text.textContent = String(value) + ' ' + word;
    item.appendChild(text);

    container.appendChild(item);
}

function makeFriendButton(cfg) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm ' + (cfg.modifier || 'btn-ghost');
    if (cfg.icon) {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', cfg.icon);
        btn.appendChild(icon);
    }
    const span = document.createElement('span');
    span.textContent = cfg.label;
    btn.appendChild(span);
    if (cfg.onClick) {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            cfg.onClick();
        });
    }
    return btn;
}

window.renderFriendItem = renderFriendItem;
