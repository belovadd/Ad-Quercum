/**
 *  КОМПОНЕНТ: MemberCard — Строка участника клуба
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<div class="member-item">` для списка участников на странице
 *   клуба. Внутри: аватар, имя, handle, чип роли, опц. кнопки управления
 *   (только для создателя / модератора).
 */

function renderMemberCard(props) {
    const p = props || {};
    const member = p.member || {};
    const myRole = p.currentUserRole || null;
    const targetRole = member.role || 'member';

    const item = document.createElement('div');
    item.className = 'member-item';
    if (member.user_id) item.dataset.userId = member.user_id;

    // --- Аватар ---
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'user-avatar';
    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(member.user_avatar_path);
    img.alt = composeMemberName(member);
    avatarWrap.appendChild(img);
    item.appendChild(avatarWrap);

    // --- Информация ---
    const info = document.createElement('div');
    info.className = 'member-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'member-name';
    nameEl.textContent = composeMemberName(member);
    info.appendChild(nameEl);

    const handleEl = document.createElement('div');
    handleEl.className = 'member-handle';
    handleEl.textContent = '@' + Utils.safeText(member.user_profile_identifier, 'user');
    info.appendChild(handleEl);

    item.appendChild(info);

    // --- Чип роли ---
    const roleChip = document.createElement('span');
    roleChip.className = 'member-role-chip ' + memberRoleChipClass(targetRole);
    roleChip.textContent = memberRoleLabel(targetRole);
    item.appendChild(roleChip);

    // --- Действия: только владелец видит управление другими ---
    if (myRole === 'creator' && targetRole !== 'creator') {
        const actions = document.createElement('div');
        actions.className = 'member-actions';

        if (targetRole === 'member' && p.onPromote) {
            actions.appendChild(buildMemberButton({
                label: 'Назначить модератором',
                icon: 'shield',
                modifier: 'btn-ghost',
                onClick: () => p.onPromote(member),
            }));
        }
        if (targetRole === 'moderator' && p.onDemote) {
            actions.appendChild(buildMemberButton({
                label: 'Снять модератора',
                icon: 'shield-off',
                modifier: 'btn-ghost',
                onClick: () => p.onDemote(member),
            }));
        }
        if (p.onRemove) {
            actions.appendChild(buildMemberButton({
                label: 'Удалить',
                icon: 'user-minus',
                modifier: 'btn-danger-ghost',
                onClick: () => p.onRemove(member),
            }));
        }

        if (actions.childElementCount > 0) item.appendChild(actions);
    }

    return item;
}

function composeMemberName(member) {
    return Utils.composeUserName(member, 'Участник');
}

function memberRoleLabel(role) {
    if (role === 'creator') return 'Создатель';
    if (role === 'moderator') return 'Модератор';
    return 'Участник';
}

function memberRoleChipClass(role) {
    if (role === 'creator') return 'tag tag-primary';
    if (role === 'moderator') return 'tag tag-secondary';
    return 'tag';
}

function buildMemberButton(cfg) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm ' + (cfg.modifier || 'btn-ghost');
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

window.renderMemberCard = renderMemberCard;
