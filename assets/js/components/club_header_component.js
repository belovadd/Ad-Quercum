/**
 *  КОМПОНЕНТ: ClubHeader — Заголовок страницы клуба 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `.club-header` с обложкой, названием, описанием, статами
 *   (участники, текущая книга, дата создания) и кнопками действий, зависящими от
 *   роли (member → «Покинуть»; moderator/creator → управление; none → «Вступить»).
 */

function renderClubHeader(props) {
    const p = props || {};
    const club = p.club || {};
    const role = p.currentUserRole || null;

    const header = document.createElement('header');
    header.className = 'club-header';
    if (club.club_id) header.dataset.clubId = club.club_id;

    // --- Изображение ---
    const imgWrap = document.createElement('div');
    imgWrap.className = 'club-header-image';
    const imagePath = club.club_image_path || DEFAULT_CLUB_COVER_URL;
    if (imagePath) {
        imgWrap.classList.add('has-image');
        const img = document.createElement('img');
        img.src = imagePath;
        img.alt = Utils.safeText(club.club_name, 'Клуб');
        imgWrap.appendChild(img);
    }
    header.appendChild(imgWrap);

    // --- Тело ---
    const body = document.createElement('div');
    body.className = 'club-header-body';

    if (club.club_description) {
        const desc = document.createElement('p');
        desc.className = 'club-header-desc';
        desc.textContent = club.club_description;
        body.appendChild(desc);
    }

    const stats = document.createElement('div');
    stats.className = 'club-header-stats';
    appendClubHeaderStat(stats, 'users', formatClubMemberCount(club.members_count));
    appendClubHeaderStat(stats, Number(club.is_public) === 1 ? 'globe' : 'lock', Number(club.is_public) === 1 ? 'Публичный' : 'Приватный');
    if (club.current_book_title) {
        appendClubHeaderStat(stats, 'book-open', 'Сейчас читают: ' + club.current_book_title);
    }
    if (club.time_created) {
        appendClubHeaderStat(stats, 'calendar', 'Создан ' + Utils.formatDate(club.time_created));
    }
    if (stats.childElementCount > 0) body.appendChild(stats);

    // --- Действия по роли ---
    const actions = document.createElement('div');
    actions.className = 'club-header-actions';

    const canManage = role === 'creator' || role === 'moderator';

    if (canManage) {
        if (p.onEdit) {
            actions.appendChild(buildClubHeaderButton({
                label: 'Редактировать',
                icon: 'edit-3',
                modifier: 'btn-outlined btn-sm',
                onClick: p.onEdit,
            }));
        }
        if (p.onUpload) {
            actions.appendChild(buildClubHeaderButton({
                label: 'Загрузить фото',
                icon: 'image',
                modifier: 'btn-outlined btn-sm',
                onClick: p.onUpload,
            }));
        }
        if (p.onDelete) {
            actions.appendChild(buildClubHeaderButton({
                label: 'Удалить клуб',
                icon: 'trash-2',
                modifier: 'btn-danger btn-sm',
                onClick: p.onDelete,
            }));
        }
    }

    if (role === 'member' || role === 'moderator') {
        if (p.onLeave) {
            actions.appendChild(buildClubHeaderButton({
                label: 'Покинуть',
                icon: 'log-out',
                modifier: 'btn-danger btn-sm',
                onClick: p.onLeave,
            }));
        }
    }

    if (role === null) {
        if (p.onJoin) {
            actions.appendChild(buildClubHeaderButton({
                label: 'Вступить в клуб',
                icon: 'user-plus',
                modifier: 'btn-primary btn-sm',
                onClick: p.onJoin,
            }));
        }
    }

    if (actions.childElementCount > 0) body.appendChild(actions);

    header.appendChild(body);
    return header;
}

function appendClubHeaderStat(container, iconName, value) {
    if (value === null || value === undefined || value === '') return;
    const stat = document.createElement('div');
    stat.className = 'club-header-stat';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    stat.appendChild(icon);

    const valueEl = document.createElement('span');
    valueEl.textContent = String(value);
    stat.appendChild(valueEl);

    container.appendChild(stat);
}

function formatClubMemberCount(value) {
    const count = Number(value) || 0;
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    let word = 'участников';

    if (lastDigit === 1 && lastTwoDigits !== 11) {
        word = 'участник';
    } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        word = 'участника';
    }

    return count + ' ' + word;
}

function buildClubHeaderButton(cfg) {
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

window.renderClubHeader = renderClubHeader;
