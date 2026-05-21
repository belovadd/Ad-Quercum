/**
 *  КОМПОНЕНТ: UserCell — Компактная ячейка пользователя для таблиц 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<div class="user-cell">` для табличных представлений
 *   (admin-users.html). Внутри: маленький кликабельный аватар + блок с
 *   кликабельным именем и email.
 */

function renderUserCell(props) {
    const p = props || {};
    const user = p.user || {};

    const cell = document.createElement('div');
    cell.className = 'user-cell';
    if (user.user_id) cell.dataset.userId = user.user_id;

    // --- Аватар ---
    cell.appendChild(buildUserCellAvatarLink(user));

    // --- Тело: имя, handle и email ---
    const body = document.createElement('div');
    body.className = 'user-cell-body';

    const identity = document.createElement('div');
    identity.className = 'user-cell-identity';

    const nameEl = buildUserCellProfileLink(user, 'user-cell-name user-profile-link');
    nameEl.textContent = composeUserCellName(user);
    identity.appendChild(nameEl);

    const handleEl = document.createElement('span');
    handleEl.className = 'user-cell-handle';
    handleEl.textContent = '@' + Utils.safeText(user.user_profile_identifier, 'user');
    identity.appendChild(handleEl);

    body.appendChild(identity);

    const emailEl = document.createElement('div');
    emailEl.className = 'user-cell-email';
    Utils.setSafeText(emailEl, user.user_email, { fallback: '—' });
    body.appendChild(emailEl);

    cell.appendChild(body);
    return cell;
}

function buildUserCellAvatar(user) {
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar user-cell-avatar';

    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(user.user_avatar_path);
    img.alt = composeUserCellName(user);
    avatar.appendChild(img);

    return avatar;
}

function buildUserCellAvatarLink(user) {
    const href = getUserCellProfileUrl(user);
    if (!href) {
        return buildUserCellAvatar(user);
    }

    const link = document.createElement('a');
    link.className = 'user-avatar user-cell-avatar user-avatar-link';
    link.href = href;
    link.setAttribute('aria-label', 'Открыть профиль ' + composeUserCellName(user));

    const avatar = buildUserCellAvatar(user);
    while (avatar.firstChild) {
        link.appendChild(avatar.firstChild);
    }

    return link;
}

function buildUserCellProfileLink(user, className) {
    const href = getUserCellProfileUrl(user);
    const element = document.createElement(href ? 'a' : 'div');
    element.className = className;
    if (href) element.href = href;
    return element;
}

function getUserCellProfileUrl(user) {
    return Utils.getUserProfileUrl(user);
}

function composeUserCellName(user) {
    return Utils.composeUserName(user, 'Без имени');
}

window.renderUserCell = renderUserCell;
