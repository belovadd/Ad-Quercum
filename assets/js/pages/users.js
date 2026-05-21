/**
 *  СТРАНИЦА: Пользователи — каталог всех пользователей с поиском и пагинацией 
 *
 * НАЗНАЧЕНИЕ:
 * Страница-каталог зарегистрированных пользователей. Загружает всех пользователей
 * при открытии, поддерживает поиск по имени/email с debounce и пагинацию.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

const pageState = {
    currentUser: null,
    users: [],
    searchQuery: '',
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    pendingActions: new Set(),
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initUsersPage() {
    try {
        const user = await AuthGuard.requireAuth();

        if (!user) {
            return;
        }

        pageState.currentUser = user;
        initNavigation(user);

        await loadUsers(1);
        bindEvents();
    } catch (error) {
        Notification.error('Ошибка загрузки страницы');
    }
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadUsers(page, shouldScroll) {
    try {
        if (page !== undefined) {
            pageState.currentPage = page;
        }

        const data = await AuthService.searchUsers(
            pageState.searchQuery,
            pageState.currentPage,
            PAGINATION_DEFAULT_PER_PAGE
        );

        pageState.users = data.items;
        pageState.totalPages = data.total_pages;
        pageState.totalCount = data.total_count;

        renderUsersSectionTitle();
        renderUsersSummary();
        renderUsers();
        renderUsersPagination();
        if (shouldScroll) {
            scrollToUsersListTop();
        }
    } catch (error) {
        Notification.error('Не удалось загрузить пользователей');
    }
}

//  4. РЕНДЕРИНГ: СПИСОК ПОЛЬЗОВАТЕЛЕЙ  //

function renderUsers() {
    const container = Utils.getElement('users-list');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (pageState.users.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: pageState.searchQuery
                    ? 'Пользователи не найдены'
                    : 'Пользователей пока нет',
                iconName: 'users',
                imageSrc: pageState.searchQuery ? UNKNOWN_AVATAR_URL : null,
                imageAlt: 'Неизвестный пользователь',
                subtitle: pageState.searchQuery
                    ? 'Попробуйте другой запрос'
                    : null,
            }));
        }
        return;
    }

    pageState.users.forEach(function (user) {
        const item = renderUserItem({
            user: adaptUserForItem(user),
            friendship: getUserFriendship(user),
            onSendRequest: handleSendRequest,
            onCancelRequest: handleCancelRequest,
            onAcceptRequest: handleAcceptRequest,
            onRejectRequest: handleRejectRequest,
            onRemove: handleRemoveFriend,
            showProfileAction: true,
        });
        container.appendChild(item);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderUsersSummary() {
    const countElement = Utils.getElement('users-total-count');
    const countText = 'Найдено ' + pageState.totalCount;

    if (countElement) {
        countElement.textContent = countText;
    }
}

function renderUsersSectionTitle() {
    const titleElement = Utils.getElement('users-section-title');

    if (titleElement) {
        titleElement.textContent = pageState.searchQuery
            ? 'Результаты поиска'
            : 'Все пользователи';
    }
}

function adaptUserForItem(user) {
    return {
        user_id: user.id,
        user_name_first: user.user_name_first,
        user_name_last: user.user_name_last,
        user_email: user.user_email,
        user_avatar_path: user.user_avatar_path,
        user_profile_identifier: user.user_profile_identifier,
        books_count: user.books_count,
        friends_count: user.friends_count,
        publications_count: user.publications_count,
        friendship_status: user.friendship_status,
        friendship_request_id: user.friendship_request_id,
        friendship: user.friendship,
    };
}

function getUserFriendship(user) {
    if (user.friendship) {
        return user.friendship;
    }

    return {
        status: user.friendship_status || FRIENDSHIP_STATUS.NONE,
        request_id: user.friendship_request_id || null,
    };
}

//  5. РЕНДЕРИНГ: ПАГИНАЦИЯ //

function renderUsersPagination() {
    const container = Utils.getElement('users-pagination');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (pageState.totalPages <= 1) {
        return;
    }

    if (typeof window.renderPagination === 'function') {
        container.appendChild(window.renderPagination({
            currentPage: pageState.currentPage,
            totalPages: pageState.totalPages,
            onPageChange: function (newPage) { loadUsers(newPage, true); },
            options: {
                totalCount: pageState.totalCount,
                perPage: PAGINATION_DEFAULT_PER_PAGE,
                label: 'пользователей',
            },
        }));
    }
}

function scrollToUsersListTop() {
    Utils.scrollToElementTop(Utils.getElement('users-list'));
}

function shouldScrollElementToTop(element) {
    return Utils.shouldScrollElementToTop(element);
}

//  6. ОБРАБОТЧИКИ  //

function handleSearch() {
    const searchInput = Utils.getElement('user-search-input');

    if (!searchInput) {
        return;
    }

    pageState.searchQuery = searchInput.value.trim();
    renderUsersSectionTitle();
    loadUsers(1);
}

const handleSearchInputDebounced = Utils.debounce(function () {
    handleSearch();
}, SEARCH_DEBOUNCE_MS);

function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleSearch();
    }
}

async function handleSendRequest(user) {
    await runUserAction('send:' + user.user_id, async function () {
        try {
            await FriendService.sendRequest(user.user_id);
            Notification.success('Запрос дружбы отправлен');
            await loadUsers(pageState.currentPage);
        } catch (error) {
            Notification.error(error.message || 'Не удалось отправить запрос');
        }
    });
}

async function handleCancelRequest(user, requestId) {
    await runUserAction('cancel:' + requestId, async function () {
        try {
            await FriendService.cancelRequest(requestId);
            Notification.success('Запрос отменён');
            await loadUsers(pageState.currentPage);
        } catch (error) {
            Notification.error(error.message || 'Не удалось отменить запрос');
        }
    });
}

async function handleAcceptRequest(user, requestId) {
    await runUserAction('accept:' + requestId, async function () {
        try {
            await FriendService.acceptRequest(requestId);
            Notification.success('Запрос принят');
            await loadUsers(pageState.currentPage);
        } catch (error) {
            Notification.error(error.message || 'Не удалось принять запрос');
        }
    });
}

async function handleRejectRequest(user, requestId) {
    await runUserAction('reject:' + requestId, async function () {
        try {
            await FriendService.rejectRequest(requestId);
            Notification.success('Запрос отклонён');
            await loadUsers(pageState.currentPage);
        } catch (error) {
            Notification.error(error.message || 'Не удалось отклонить запрос');
        }
    });
}

async function handleRemoveFriend(user) {
    const userId = user && user.user_id;
    if (!userId) return;

    const confirmed = await confirmRemoveFriend();
    if (!confirmed) return;

    await runUserAction('remove:' + userId, async function () {
        try {
            await FriendService.removeFriend(userId);
            Notification.success('Друг удалён');
            await loadUsers(pageState.currentPage);
        } catch (error) {
            Notification.error(error.message || 'Не удалось удалить друга');
        }
    });
}

async function confirmRemoveFriend() {
    return await AppConfirm.ask({
        title: 'Удалить друга',
        message: 'Вы действительно хотите удалить друга?',
        confirmLabel: 'Удалить',
        cancelLabel: 'Отмена',
        isDanger: true,
    });
}

//  7. ПРИВЯЗКА СОБЫТИЙ  //

async function runUserAction(key, action) {
    await Utils.runPendingAction(pageState.pendingActions, key, action);
}

function bindEvents() {
    const searchInput = Utils.getElement('user-search-input');

    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInputDebounced);
        searchInput.addEventListener('keydown', handleSearchKeydown);
    }
}

//  8. ЗАПУСК  //

function destroy() {}

PageRegistry.register('users', {
    init: initUsersPage,
    destroy: destroy,
});
})();
