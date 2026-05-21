/**
 *  КОМПОНЕНТ: UserItem — Строка пользователя в каталоге / поиске 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<li class="user-item">` для страниц «Поиск пользователей»
 *   (`users.html`) и аналогичных списков. Внутри: аватар, имя, handle, мета (книги/
 *   друзья/публикации) и кнопки «Профиль» + «Добавить в друзья».
 */

function renderUserItem(props) {
    const p = props || {};
    const user = p.user || {};

    const item = document.createElement('li');
    item.className = 'user-item';
    if (user.user_id) item.dataset.userId = user.user_id;

    // --- Аватар ---
    item.appendChild(buildUserItemAvatarLink(user));

    // --- Информация ---
    const info = document.createElement('div');
    info.className = 'user-info';

    const identity = document.createElement('div');
    identity.className = 'user-identity';

    const nameEl = buildUserItemProfileLink(user, 'user-name user-profile-link');
    nameEl.textContent = composeUserItemName(user);
    identity.appendChild(nameEl);

    const handleEl = document.createElement('span');
    handleEl.className = 'user-handle';
    handleEl.textContent = '@' + Utils.safeText(user.user_profile_identifier, 'user');
    identity.appendChild(handleEl);

    info.appendChild(identity);

    // --- Мета: счётчики ---
    const meta = document.createElement('div');
    meta.className = 'user-meta';
    appendUserItemMetaItem(meta, 'book-copy', user.books_count, 'книг');
    appendUserItemMetaItem(meta, 'users', user.friends_count, 'друзей');
    appendUserItemMetaItem(meta, 'message-square', user.publications_count, 'публикаций');
    if (meta.childElementCount > 0) info.appendChild(meta);

    item.appendChild(info);

    // --- Правая группа: статус дружбы + действия ---
    const friendship = getUserItemFriendship(props, user);
    const side = document.createElement('div');
    side.className = 'user-side';

    const statusTag = buildUserItemStatusTag(friendship.status);
    if (statusTag) {
        const statusWrap = document.createElement('div');
        statusWrap.className = 'user-status';
        statusWrap.appendChild(statusTag);
        side.appendChild(statusWrap);
    }

    const actions = document.createElement('div');
    actions.className = 'user-actions';

    fillUserItemActions(actions, p, user, friendship);

    side.appendChild(actions);
    item.appendChild(side);
    return item;
}

function getUserItemFriendship(props, user) {
    const friendship = props.friendship || user.friendship || {};
    const status = props.friendshipStatus || user.friendship_status || friendship.status || null;
    const requestId = props.friendshipRequestId || user.friendship_request_id || friendship.request_id || null;

    return {
        status: status,
        requestId: requestId,
    };
}

function buildUserItemStatusTag(status) {
    const labels = {
        self: ['tag-muted', 'Это вы'],
        friends: ['tag-primary', 'Друг'],
        request_sent: ['tag-warning', 'Запрос отправлен'],
        request_received: ['tag-secondary', 'Входящий запрос'],
    };

    if (!status || !labels[status]) {
        return null;
    }

    const tag = document.createElement('span');
    tag.className = 'tag ' + labels[status][0];
    tag.textContent = labels[status][1];

    return tag;
}

function fillUserItemActions(actions, props, user, friendship) {
    const status = friendship.status;

    if (status === 'none') {
        if (props.onSendRequest) {
            appendUserItemAction(actions, 'btn btn-primary btn-sm', 'user-plus', 'Добавить', function () {
                props.onSendRequest(user);
            });
        } else {
            appendUserItemProfileAction(actions, props, user);
        }
        return;
    }

    if (status === 'request_sent') {
        appendUserItemAction(actions, 'btn btn-danger-ghost btn-sm', 'x', 'Отменить', function () {
            if (props.onCancelRequest) props.onCancelRequest(user, friendship.requestId);
        });
        return;
    }

    if (status === 'request_received') {
        appendUserItemAction(actions, 'btn btn-primary btn-sm', 'check', 'Принять', function () {
            if (props.onAcceptRequest) props.onAcceptRequest(user, friendship.requestId);
        });
        appendUserItemAction(actions, 'btn btn-danger-ghost btn-sm', 'x', 'Отклонить', function () {
            if (props.onRejectRequest) props.onRejectRequest(user, friendship.requestId);
        });
        return;
    }

    if (status === 'friends' && (props.onMessage || props.onRemove)) {
        if (props.showProfileAction) {
            appendUserItemProfileAction(actions, props, user);
        }
        if (props.onMessage) {
            appendUserItemAction(actions, 'btn btn-primary btn-sm', 'message-circle', 'Сообщение', function () {
                props.onMessage(user);
            });
        }
        if (props.onRemove) {
            appendUserItemAction(actions, 'btn btn-danger-ghost btn-sm', 'user-minus', 'Удалить', function () {
                props.onRemove(user);
            });
        }
        return;
    }

    appendUserItemProfileAction(actions, props, user);

    if (!status && props.onSendRequest) {
        appendUserItemAction(actions, 'btn btn-primary btn-sm', 'user-plus', 'В друзья', function () {
            props.onSendRequest(user);
        });
    }
}

function appendUserItemProfileAction(actions, props, user) {
    appendUserItemAction(actions, 'btn btn-ghost btn-sm', 'user', 'Профиль', function () {
        if (props.onOpenProfile) {
            props.onOpenProfile(user);
        } else if (user.user_id && typeof PAGE_URL !== 'undefined') {
            PageRouter.open(PAGE_URL.PROFILE + '?user_id=' + user.user_id);
        }
    });
}

function appendUserItemAction(actions, className, iconName, label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    button.appendChild(icon);

    if (label) {
        const span = document.createElement('span');
        span.textContent = label;
        button.appendChild(span);
    }

    button.addEventListener('click', (event) => {
        event.preventDefault();
        handler();
    });

    actions.appendChild(button);
}

function buildUserItemAvatar(user) {
    const wrap = document.createElement('span');
    wrap.className = 'user-avatar';

    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(user && user.user_avatar_path);
    img.alt = composeUserItemName(user || {});
    wrap.appendChild(img);

    return wrap;
}

function buildUserItemAvatarLink(user) {
    const href = getUserItemProfileUrl(user);
    if (!href) {
        return buildUserItemAvatar(user);
    }

    const link = document.createElement('a');
    link.className = 'user-avatar user-avatar-link';
    link.href = href;
    link.setAttribute('aria-label', 'Открыть профиль ' + composeUserItemName(user));

    const avatar = buildUserItemAvatar(user);
    while (avatar.firstChild) {
        link.appendChild(avatar.firstChild);
    }

    return link;
}

function buildUserItemProfileLink(user, className) {
    const href = getUserItemProfileUrl(user);
    const element = document.createElement(href ? 'a' : 'div');
    element.className = className;
    if (href) element.href = href;
    return element;
}

function getUserItemProfileUrl(user) {
    return Utils.getUserProfileUrl(user);
}

function composeUserItemName(user) {
    return Utils.composeUserName(user, 'Без имени');
}

function appendUserItemMetaItem(container, icon, value, word) {
    if (value === null || value === undefined) return;
    const item = document.createElement('span');
    item.className = 'user-meta-item';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', icon);
    item.appendChild(i);
    const text = document.createElement('span');
    text.textContent = String(value) + ' ' + word;
    item.appendChild(text);
    container.appendChild(item);
}

window.renderUserItem = renderUserItem;
