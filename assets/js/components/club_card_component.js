/**
 *  КОМПОНЕНТ: ClubCard — Карточка клуба в сетке
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<a class="club-card">` (или div с onClick) для страницы
 *   `clubs.html`. Внутри: обложка-баннер, название, короткое описание, мета
 *   (участники, текущая книга), опц. бейдж роли.
 */

function renderClubCard(props) {
    const p = props || {};
    const club = p.club || {};

    const card = document.createElement('article');
    card.className = 'club-card';
    if (club.club_id) card.dataset.clubId = club.club_id;

    // --- Изображение ---
    const imgWrap = document.createElement('div');
    imgWrap.className = 'club-card-image';
    const imagePath = club.club_image_path || DEFAULT_CLUB_COVER_URL;
    if (imagePath) {
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = Utils.safeText(club.club_name, 'Клуб');
        imgWrap.appendChild(img);
    }
    card.appendChild(imgWrap);

    // --- Тело ---
    const body = document.createElement('div');
    body.className = 'club-card-body';

    const title = document.createElement('h3');
    title.className = 'club-card-title';
    title.textContent = Utils.safeText(club.club_name, 'Без названия');
    body.appendChild(title);

    if (club.club_description) {
        const desc = document.createElement('p');
        desc.className = 'club-card-description';
        desc.textContent = truncateClubDescription(club.club_description, CLUB_CARD_DESCRIPTION_PREVIEW_LENGTH);
        body.appendChild(desc);
    }

    const footer = document.createElement('div');
    footer.className = 'club-card-footer';

    const meta = document.createElement('div');
    meta.className = 'club-card-meta';
    appendClubMetaItem(meta, 'users', formatClubCardMemberCount(club.members_count), '');
    if (club.is_public !== null && club.is_public !== undefined && club.is_public !== '') {
        appendClubMetaItem(
            meta,
            Number(club.is_public) === 1 ? 'globe' : 'lock',
            Number(club.is_public) === 1 ? 'Публичный' : 'Приватный',
            ''
        );
    }
    if (meta.childElementCount > 0) footer.appendChild(meta);

    if (footer.childElementCount > 0) {
        body.appendChild(footer);
    }

    if (club.my_role) {
        const status = document.createElement('div');
        status.className = 'club-card-status';

        const role = document.createElement('span');
        role.className = 'club-card-role tag tag-secondary';
        role.textContent = clubRoleLabel(club.my_role);
        status.appendChild(role);

        body.appendChild(status);
    }

    const actions = buildClubCardActions(club, p);
    if (actions) {
        body.appendChild(actions);
    }

    card.appendChild(body);

    // --- Клик ---
    if (p.canOpen !== false) {
        card.classList.add('is-clickable');
        card.addEventListener('click', (event) => {
            event.preventDefault();
            if (p.onOpen) {
                p.onOpen(club);
            } else if (club.club_id && typeof PAGE_URL !== 'undefined') {
                PageRouter.open(PAGE_URL.CLUB + '?id=' + club.club_id);
            }
        });
    }

    return card;
}

function buildClubCardActions(club, props) {
    if (club.my_role) return null;

    const actions = document.createElement('div');
    actions.className = 'club-card-actions';

    if (club.join_request_status === CLUB_JOIN_REQUEST_STATUS.PENDING) {
        if (props.onCancelRequest) {
            actions.appendChild(buildClubCardButton('x', 'Отменить', 'btn btn-danger btn-sm', function (event) {
                event.stopPropagation();
                event.preventDefault();
                props.onCancelRequest(club);
            }));
        } else {
            const label = document.createElement('span');
            label.className = 'tag tag-secondary';
            label.textContent = 'Заявка отправлена';
            actions.appendChild(label);
        }

        return actions;
    }

    if (Number(club.is_public) === 1 && props.onJoin) {
        actions.appendChild(buildClubCardButton('log-in', 'Вступить', 'btn btn-primary btn-sm', function (event) {
            event.stopPropagation();
            event.preventDefault();
            props.onJoin(club);
        }));
    } else if (Number(club.is_public) === 0 && props.onRequestJoin) {
        actions.appendChild(buildClubCardButton('mail-plus', 'Подать заявку', 'btn btn-outlined btn-sm', function (event) {
            event.stopPropagation();
            event.preventDefault();
            props.onRequestJoin(club);
        }));
    }

    return actions.childElementCount > 0 ? actions : null;
}

function buildClubCardButton(iconName, text, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    button.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = text;
    button.appendChild(label);

    button.addEventListener('click', onClick);

    return button;
}

function truncateClubDescription(text, max) {
    const safe = Utils.safeText(text, '');
    if (safe.length <= max) return safe;
    return safe.slice(0, max - 1).trimEnd() + '…';
}

function clubRoleLabel(role) {
    if (role === 'creator') return 'Создатель';
    if (role === 'moderator') return 'Модератор';
    if (role === 'member') return 'Участник';
    return Utils.safeText(role, '');
}

function formatClubCardMemberCount(value) {
    if (value === null || value === undefined || value === '') return null;

    const count = Number(value) || 0;
    const lastTwo = count % 100;
    const lastOne = count % 10;
    let word = 'участников';

    if (lastTwo < 11 || lastTwo > 14) {
        if (lastOne === 1) {
            word = 'участник';
        } else if (lastOne >= 2 && lastOne <= 4) {
            word = 'участника';
        }
    }

    return String(count) + ' ' + word;
}

function appendClubMetaItem(container, icon, value, word) {
    if (value === null || value === undefined || value === '') return;
    const item = document.createElement('span');
    item.className = 'user-meta-item';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', icon);
    item.appendChild(i);
    const text = document.createElement('span');
    text.textContent = word ? (String(value) + ' ' + word) : String(value);
    item.appendChild(text);
    container.appendChild(item);
}

window.renderClubCard = renderClubCard;
