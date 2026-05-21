/**
 *  КОМПОНЕНТ: ProfileCard — Карточка профиля пользователя 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<aside class="profile-card">` для страницы `profile.html`.
 *   Внутри: большой аватар, имя, handle, дата регистрации, сетка статов
 *   (книги/друзья/клубы/публикации), и кнопки действий — зависят от того,
 *   свой ли это профиль (Edit) или чужой (Add Friend / Message).
 */

function renderProfileCard(props) {
    const p = props || {};
    const user = p.user || {};
    const summary = user.summary || {};
    const isOwn = Boolean(p.isOwn);

    const card = document.createElement('aside');
    card.className = 'profile-card';
    if (user.user_id) card.dataset.userId = user.user_id;

    // --- Аватар ---
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'profile-card-avatar';
    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(user.user_avatar_path);
    img.alt = '';
    img.addEventListener('error', () => {
        img.src = Utils.getAvatarUrl(null);
    });
    avatarWrap.appendChild(img);
    card.appendChild(avatarWrap);

    // --- Имя ---
    const name = document.createElement('div');
    name.className = 'profile-card-name';
    name.textContent = composeProfileName(user);
    card.appendChild(name);

    // --- Псевдоним ---
    const handle = document.createElement('div');
    handle.className = 'profile-card-handle';
    handle.textContent = '@' + Utils.safeText(user.user_profile_identifier, 'user');
    card.appendChild(handle);

    // --- Дата регистрации ---
    if (user.time_created) {
        const joined = document.createElement('div');
        joined.className = 'profile-card-joined';
        joined.textContent = 'С нами с ' + Utils.formatDate(user.time_created);
        card.appendChild(joined);
    }

    // --- Статистика ---
    const stats = document.createElement('div');
    stats.className = 'profile-card-stats';
    appendProfileStat(stats, summary.books_count, 'Книг');
    appendProfileStat(stats, summary.friends_count, 'Друзей');
    appendProfileStat(stats, summary.clubs_count, 'Клубов');
    appendProfileStat(stats, summary.publications_count, 'Публикаций');
    if (stats.childElementCount > 0) card.appendChild(stats);

    // --- Действия ---
    const actions = document.createElement('div');
    actions.className = 'profile-card-actions';

    if (isOwn) {
        if (p.onEdit) {
            actions.appendChild(buildProfileButton({
                label: 'Редактировать',
                icon: 'pencil',
                modifier: 'btn-ghost',
                onClick: p.onEdit,
            }));
        }
    } else {
        if (p.onAddFriend) {
            actions.appendChild(buildProfileButton({
                label: 'В друзья',
                icon: 'user-plus',
                modifier: 'btn-primary',
                onClick: p.onAddFriend,
            }));
        }
        if (p.onMessage) {
            actions.appendChild(buildProfileButton({
                label: 'Сообщение',
                icon: 'message-circle',
                modifier: 'btn-ghost',
                onClick: p.onMessage,
            }));
        }
    }

    if (actions.childElementCount > 0) {
        card.appendChild(actions);
    }

    return card;
}

function composeProfileName(user) {
    return Utils.composeUserName(user, 'Пользователь');
}

function appendProfileStat(container, value, label) {
    if (value === null || value === undefined) return;
    const stat = document.createElement('div');
    stat.className = 'profile-stat';

    const valueEl = document.createElement('div');
    valueEl.className = 'profile-stat-value';
    valueEl.textContent = String(value);
    stat.appendChild(valueEl);

    const labelEl = document.createElement('div');
    labelEl.className = 'profile-stat-label';
    labelEl.textContent = label;
    stat.appendChild(labelEl);

    container.appendChild(stat);
}

function buildProfileButton(cfg) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + (cfg.modifier || 'btn-ghost');
    if (cfg.icon) {
        const i = document.createElement('i');
        i.setAttribute('data-lucide', cfg.icon);
        btn.appendChild(i);
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

window.renderProfileCard = renderProfileCard;
