/**
 *  СТРАНИЦА: Управление пользователями — список, роли, блокировка, удаление 
 *
 * НАЗНАЧЕНИЕ:
 * Страница управления пользователями для администратора.
 * Поиск, фильтрация, смена роли, блокировка/разблокировка, удаление.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

const pageState = {
    currentUser: null,
    users: [],
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    searchQuery: '',
    filterRole: '',
    filterBlocked: '',
    searchTimeout: null,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initAdminUsersPage() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    // Только admin
    if (user.user_role !== USER_ROLE.ADMIN) {
        PageRouter.open(PAGE_URL.LIBRARY);
        return;
    }

    pageState.currentUser = user;
    initNavigation(user);
    initFilters();

    await loadUsers(1);
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadUsers(page) {
    try {
        const params = { page: page, per_page: PAGINATION_DEFAULT_PER_PAGE };

        if (pageState.searchQuery) {
            params.query = pageState.searchQuery;
        }
        if (pageState.filterRole) {
            params.role = pageState.filterRole;
        }
        if (pageState.filterBlocked !== '') {
            params.is_blocked = pageState.filterBlocked === '1';
        }

        const data = await AdminService.getUsers(params);

        pageState.users = data.items;
        pageState.currentPage = data.page;
        pageState.totalPages = data.total_pages;
        pageState.totalCount = data.total_count || 0;

        renderUsersCount();
        renderUsersTable();
        renderPaginationBlock();
    } catch (error) {
        Notification.error('Не удалось загрузить пользователей');
    }
}

//  4. РЕНДЕРИНГ: ТАБЛИЦА  //

function renderUsersCount() {
    const countElement = document.getElementById('admin-users-count');
    if (countElement) {
        countElement.textContent = 'Найдено ' + Utils.formatNumber(pageState.totalCount);
    }
}

function renderUsersTable() {
    const container = document.getElementById('users-table-container');
    container.textContent = '';

    if (pageState.users.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'Пользователи не найдены',
                iconName: 'user-x',
                subtitle: 'Измените параметры поиска',
            }));
        }
        return;
    }

    const table = document.createElement('table');
    table.className = 'user-table admin-table';

    // Заголовок
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const headers = ['Пользователь', 'Роль', 'Статус', 'Регистрация', 'Действия'];

    headers.forEach(function (text) {
        const th = document.createElement('th');
        th.textContent = text;
        headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    // Тело
    const tbody = document.createElement('tbody');
    pageState.users.forEach(function (user) {
        tbody.appendChild(renderUserRow(user));
    });

    table.appendChild(tbody);
    container.appendChild(table);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderUserRow(user) {
    const row = document.createElement('tr');
    if (user.is_blocked) row.classList.add('is-blocked');

    const isSelf = user.id === pageState.currentUser.id;

    // Колонка «Пользователь» (аватар + имя + email)
    const tdUser = document.createElement('td');
    tdUser.dataset.label = 'Пользователь';
    if (typeof renderUserCell === 'function') {
        tdUser.appendChild(renderUserCell({
            user: {
                user_id: user.id,
                user_name_first: user.user_name_first,
                user_name_last: user.user_name_last,
                user_email: user.user_email,
                user_avatar_path: user.user_avatar_path,
                user_profile_identifier: user.user_profile_identifier,
            },
        }));
    } else {
        tdUser.textContent = user.user_email;
    }
    row.appendChild(tdUser);

    // Роль (тег + select)
    const tdRole = document.createElement('td');
    tdRole.dataset.label = 'Роль';
    const roleTag = document.createElement('span');
    roleTag.className = 'tag tag-role-' + (user.user_role || 'user');
    roleTag.textContent = USER_ROLE_LABELS[user.user_role] || user.user_role;
    tdRole.appendChild(roleTag);
    row.appendChild(tdRole);

    // Статус
    const tdStatus = document.createElement('td');
    tdStatus.dataset.label = 'Статус';
    const statusTag = document.createElement('span');
    if (user.is_blocked) {
        statusTag.className = 'tag tag-status-blocked';
        statusTag.textContent = 'Заблокирован';
    } else {
        statusTag.className = 'tag tag-status-active';
        statusTag.textContent = 'Активен';
    }
    tdStatus.appendChild(statusTag);
    row.appendChild(tdStatus);

    // Дата регистрации
    const tdDate = document.createElement('td');
    tdDate.dataset.label = 'Регистрация';
    tdDate.className = 'user-date';
    tdDate.textContent = user.time_created ? Utils.formatDate(user.time_created) : '—';
    row.appendChild(tdDate);

    // Действия
    const tdActions = document.createElement('td');
    tdActions.dataset.label = 'Действия';
    const actions = document.createElement('div');
    actions.className = 'user-actions';

    const roleSelect = buildRoleSelect(user, isSelf);
    actions.appendChild(roleSelect);

    const editLink = document.createElement('a');
    editLink.className = 'btn btn-outlined btn-sm';
    editLink.href = PAGE_URL.ADMIN_USER_EDIT + '?user_id=' + user.id;
    editLink.title = 'Редактировать';
    editLink.setAttribute('aria-label', 'Редактировать');
    {
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'pencil');
        editLink.appendChild(i);
    }
    actions.appendChild(editLink);

    if (!isSelf) {
        const blockButton = document.createElement('button');
        blockButton.type = 'button';
        blockButton.className = user.is_blocked
            ? 'btn btn-primary btn-sm'
            : 'btn btn-danger-ghost btn-sm';
        appendAdminUsersButtonIcon(
            blockButton,
            user.is_blocked ? 'check' : 'ban',
            user.is_blocked ? 'Разблокировать' : 'Заблокировать'
        );
        blockButton.addEventListener('click', function () {
            if (user.is_blocked) {
                handleUnblockUser(user.id);
            } else {
                handleBlockUser(user.id);
            }
        });
        actions.appendChild(blockButton);
    }

    tdActions.appendChild(actions);
    row.appendChild(tdActions);
    return row;
}

//  5. РЕНДЕРИНГ: ПАГИНАЦИЯ  //

function renderPaginationBlock() {
    const container = document.getElementById('users-pagination');
    container.textContent = '';

    if (pageState.totalPages <= 1) return;

    if (typeof renderPagination === 'function') {
        container.appendChild(renderPagination({
            currentPage: pageState.currentPage,
            totalPages: pageState.totalPages,
            onPageChange: function (newPage) { loadUsers(newPage); },
            options: {
                totalCount: pageState.totalCount,
                perPage: PAGINATION_DEFAULT_PER_PAGE,
                label: 'пользователей',
            },
        }));
    }
}

//  6. ОБРАБОТЧИКИ ДЕЙСТВИЙ  //

async function handleChangeRole(userId, newRole) {
    try {
        await AdminService.updateRole(userId, newRole);
        Notification.success('Роль обновлена');
        await loadUsers(pageState.currentPage);
    } catch (error) {
        Notification.error(error.message);
        await loadUsers(pageState.currentPage);
    }
}

async function handleBlockUser(userId) {
    const confirmed = await AppConfirm.ask({
        title: 'Заблокировать пользователя',
        message: 'Заблокировать пользователя? Он не сможет войти в систему.',
        confirmLabel: 'Заблокировать',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await AdminService.blockUser(userId);
        Notification.success('Пользователь заблокирован');
        await loadUsers(pageState.currentPage);
    } catch (error) {
        Notification.error(error.message);
    }
}

async function handleUnblockUser(userId) {
    try {
        await AdminService.unblockUser(userId);
        Notification.success('Пользователь разблокирован');
        await loadUsers(pageState.currentPage);
    } catch (error) {
        Notification.error(error.message);
    }
}

//  7. ОБРАБОТЧИКИ ФИЛЬТРОВ  //

function initFilters() {
    const searchInput = document.getElementById('search-input');
    const roleFilter = document.getElementById('filter-role');
    const blockedFilter = document.getElementById('filter-blocked');

    // Поиск с debounce
    searchInput.addEventListener('input', function () {
        clearTimeout(pageState.searchTimeout);
        pageState.searchTimeout = setTimeout(function () {
            pageState.searchQuery = searchInput.value.trim();
            loadUsers(1);
        }, SEARCH_DEBOUNCE_MS);
    });

    // Фильтр по роли
    roleFilter.addEventListener('change', function () {
        pageState.filterRole = roleFilter.value;
        loadUsers(1);
    });

    // Фильтр по статусу блокировки
    blockedFilter.addEventListener('change', function () {
        pageState.filterBlocked = blockedFilter.value;
        loadUsers(1);
    });
}

//  8. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ  //

function buildRoleSelect(user, isSelf) {
    const select = document.createElement('select');
    select.className = 'user-role-select';
    select.disabled = isSelf;
    select.title = isSelf ? 'Нельзя менять собственную роль' : 'Сменить роль';

    [USER_ROLE.ADMIN, USER_ROLE.MODERATOR, USER_ROLE.USER].forEach(function (role) {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = USER_ROLE_LABELS[role] || role;
        option.selected = user.user_role === role;
        select.appendChild(option);
    });

    select.addEventListener('change', function () {
        if (select.value !== user.user_role) {
            handleChangeRole(user.id, select.value);
        }
    });

    return select;
}

function appendAdminUsersButtonIcon(button, iconName, label) {
    button.title = label;
    button.setAttribute('aria-label', label);
    button.appendChild(Utils.createLucideIcon(iconName));
}

//  9. ЗАПУСК  //

function destroy() {}

PageRegistry.register('admin-users', {
    init: initAdminUsersPage,
    destroy: destroy,
});
})();
