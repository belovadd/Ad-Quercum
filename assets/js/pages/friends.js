/**
 *  СТРАНИЦА: Друзья (Modern Botanical)
 *
 * НАЗНАЧЕНИЕ:
 *   Управление друзьями: поиск пользователей с действиями по статусу,
 *   списки входящих/исходящих запросов, список друзей с пагинацией.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const pageState = {
    currentUser: null,
    incomingRequests: [],
    outgoingRequests: [],
    friends: [],
    friendsPage: 1,
    friendsTotalPages: 1,
    friendsTotalCount: 0,
    searchResults: [],
    pendingActions: new Set(),
};

const SEARCH_RESULT_STATUS_ORDER = {
    request_received: 1,
    request_sent: 2,
    friends: 3,
    none: 4,
    self: 5,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initFriendsPage() {
    try {
        const user = await AuthGuard.requireAuth();
        if (!user) return;

        pageState.currentUser = user;
        if (typeof initNavigation === 'function') {
            initNavigation(user);
        }

        await loadAllData();
        bindEvents();
    } catch (error) {
        Notification.error('Ошибка загрузки страницы');
    }
}

//  3. ЗАГРУЗКА  //

async function loadAllData() {
    try {
        const [incoming, outgoing, friendsData] = await Promise.all([
            FriendService.getIncomingRequests(),
            FriendService.getOutgoingRequests(),
            FriendService.getFriends(pageState.friendsPage),
        ]);

        pageState.incomingRequests = incoming || [];
        pageState.outgoingRequests = outgoing || [];
        pageState.friends = friendsData.items || [];
        pageState.friendsTotalPages = friendsData.total_pages || 1;
        pageState.friendsTotalCount = friendsData.total_count || 0;

        renderIncomingRequests();
        renderOutgoingRequests();
        renderFriends();
    } catch (error) {
        Notification.error('Не удалось загрузить данные');
    }
}

async function loadIncomingRequests() {
    try {
        pageState.incomingRequests = (await FriendService.getIncomingRequests()) || [];
        renderIncomingRequests();
    } catch (error) {
        Notification.error('Не удалось загрузить входящие запросы');
    }
}

async function loadOutgoingRequests() {
    try {
        pageState.outgoingRequests = (await FriendService.getOutgoingRequests()) || [];
        renderOutgoingRequests();
    } catch (error) {
        Notification.error('Не удалось загрузить исходящие запросы');
    }
}

async function loadFriends(page) {
    try {
        if (page !== undefined) pageState.friendsPage = page;
        const data = await FriendService.getFriends(pageState.friendsPage);
        pageState.friends = data.items || [];
        pageState.friendsTotalPages = data.total_pages || 1;
        pageState.friendsTotalCount = data.total_count || 0;
        renderFriends();
    } catch (error) {
        Notification.error('Не удалось загрузить список друзей');
    }
}

async function searchUsers(query) {
    const container = Utils.getElement('search-results');
    if (!container) return;

    if (query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
        Utils.clearChildren(container);
        container.classList.add('is-hidden');
        pageState.searchResults = [];
        return;
    }

    try {
        const result = await AuthService.searchUsers(query, 1, PAGINATION_DEFAULT_PER_PAGE);
        const users = result.items || [];

        const searchResults = await Promise.all(users.map(async function (user) {
            if (user.friendship) {
                return user;
            }

            const friendship = await FriendService.getFriendshipStatus(user.id);
            return Object.assign({}, user, { friendship: friendship });
        }));

        pageState.searchResults = sortSearchResultsByFriendship(searchResults);

        renderSearchResults();
    } catch (error) {
        Notification.error('Ошибка поиска');
    }
}

//  4. РЕНДЕРИНГ: ПОИСК //

function renderSearchResults() {
    const container = Utils.getElement('search-results');
    if (!container) return;
    Utils.clearChildren(container);
    container.classList.remove('is-hidden');

    if (pageState.searchResults.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Пользователи не найдены',
            iconName: 'user-x',
            subtitle: 'Попробуйте другой запрос',
        }));
        return;
    }

    pageState.searchResults.forEach(function (user) {
        const requestId = user.friendship ? user.friendship.request_id : null;

        const item = renderUserItem({
            user: adaptUserForItem(user),
            friendship: user.friendship,
            onSendRequest: function () { handleSendRequest(user.id); },
            onCancelRequest: function () { handleCancelRequest(requestId); },
            onAcceptRequest: function () { handleAcceptRequest(requestId); },
            onRejectRequest: function () { handleRejectRequest(requestId); },
            onMessage: function () {
                PageRouter.open(PAGE_URL.MESSAGES + '?user_id=' + user.id);
            },
            onRemove: function () { handleRemoveFriend(user.id); },
        });
        container.appendChild(item);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function sortSearchResultsByFriendship(users) {
    return users
        .map(function (user, index) {
            return {
                user: user,
                index: index,
                order: getSearchResultStatusOrder(user),
            };
        })
        .sort(function (left, right) {
            if (left.order !== right.order) {
                return left.order - right.order;
            }
            return left.index - right.index;
        })
        .map(function (entry) {
            return entry.user;
        });
}

function getSearchResultStatusOrder(user) {
    const friendship = user && user.friendship ? user.friendship : {};
    const status = friendship.status || user.friendship_status || FRIENDSHIP_STATUS.NONE;

    return SEARCH_RESULT_STATUS_ORDER[status] || SEARCH_RESULT_STATUS_ORDER.none;
}

//  5. РЕНДЕРИНГ: ВХОДЯЩИЕ  //

function renderIncomingRequests() {
    const container = Utils.getElement('incoming-requests');
    const countBadge = Utils.getElement('incoming-count');
    if (!container) return;

    Utils.clearChildren(container);
    setSectionVisibility('incoming-requests-section', pageState.incomingRequests.length > 0);

    if (countBadge) {
        countBadge.textContent = pageState.incomingRequests.length > 0
            ? String(pageState.incomingRequests.length)
            : '';
        countBadge.classList.toggle('is-hidden', pageState.incomingRequests.length === 0);
    }

    if (pageState.incomingRequests.length === 0) {
        return;
    }

    pageState.incomingRequests.forEach(function (request) {
        const item = renderFriendItem({
            user: adaptRequestUser(request, 'sender'),
            status: 'incoming',
            onAccept: function () { handleAcceptRequest(request.id); },
            onDecline: function () { handleRejectRequest(request.id); },
        });
        container.appendChild(item);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  6. РЕНДЕРИНГ: ИСХОДЯЩИЕ  //

function renderOutgoingRequests() {
    const container = Utils.getElement('outgoing-requests');
    const countBadge = Utils.getElement('outgoing-count');
    if (!container) return;

    Utils.clearChildren(container);
    setSectionVisibility('outgoing-requests-section', pageState.outgoingRequests.length > 0);

    if (countBadge) {
        countBadge.textContent = pageState.outgoingRequests.length > 0
            ? String(pageState.outgoingRequests.length)
            : '';
        countBadge.classList.toggle('is-hidden', pageState.outgoingRequests.length === 0);
    }

    if (pageState.outgoingRequests.length === 0) {
        return;
    }

    pageState.outgoingRequests.forEach(function (request) {
        const item = renderFriendItem({
            user: adaptRequestUser(request, 'receiver'),
            status: 'outgoing',
            onCancel: function () { handleCancelRequest(request.id); },
        });
        container.appendChild(item);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function setSectionVisibility(sectionId, isVisible) {
    const section = Utils.getElement(sectionId);
    if (!section) return;

    section.classList.toggle('is-hidden', !isVisible);
}

//  7. РЕНДЕРИНГ: ДРУЗЬЯ //

function renderFriends() {
    const container = Utils.getElement('friends-list');
    const paginationContainer = Utils.getElement('friends-pagination');
    const totalCountBadge = Utils.getElement('friends-total-count');
    if (!container) return;

    Utils.clearChildren(container);

    if (totalCountBadge) {
        totalCountBadge.textContent = pageState.friendsTotalCount > 0
            ? String(pageState.friendsTotalCount)
            : '';
        totalCountBadge.classList.toggle('is-hidden', pageState.friendsTotalCount === 0);
    }

    if (pageState.friends.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Список друзей пуст',
            iconName: 'users',
            subtitle: 'Найдите и добавьте друзей через поиск',
        }));
    } else {
        pageState.friends.forEach(function (friend) {
            const item = renderFriendItem({
                user: adaptUserForItem(friend),
                status: 'friend',
                onMessage: function () {
                    PageRouter.open(PAGE_URL.MESSAGES + '?user_id=' + friend.id);
                },
                onRemove: function () { handleRemoveFriend(friend.id); },
            });
            container.appendChild(item);
        });
    }

    if (paginationContainer) {
        Utils.clearChildren(paginationContainer);
        if (pageState.friendsTotalPages > 1) {
            paginationContainer.appendChild(renderPagination({
                currentPage: pageState.friendsPage,
                totalPages: pageState.friendsTotalPages,
                onPageChange: function (newPage) { loadFriends(newPage); },
                options: {
                    totalCount: pageState.friendsTotalCount,
                    perPage: PAGINATION_DEFAULT_PER_PAGE,
                    label: 'друзей',
                },
            }));
        }
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  8. АДАПТЕРЫ  //

function adaptUserForItem(u) {
    return {
        user_id: u.id || u.user_id,
        user_name_first: u.user_name_first,
        user_name_last: u.user_name_last,
        user_email: u.user_email,
        user_avatar_path: u.user_avatar_path,
        user_profile_identifier: u.user_profile_identifier,
        books_count: u.books_count,
        friends_count: u.friends_count,
        publications_count: u.publications_count,
    };
}

function adaptRequestUser(request, role) {
    return {
        user_id: role === 'sender' ? request.user_id_sender : request.user_id_receiver,
        user_name_first: request.user_name_first,
        user_name_last: request.user_name_last,
        user_email: request.user_email,
        user_avatar_path: request.user_avatar_path,
        user_profile_identifier: request.user_profile_identifier,
        books_count: request.books_count,
        friends_count: request.friends_count,
        publications_count: request.publications_count,
    };
}

//  9. ОБРАБОТЧИКИ  //

async function handleSendRequest(receiverId) {
    await runFriendAction('send:' + receiverId, async function () {
        try {
            await FriendService.sendRequest(receiverId);
            Notification.success('Запрос дружбы отправлен');
            await refreshAfterAction();
        } catch (error) {
            Notification.error(error.message || 'Не удалось отправить запрос');
        }
    });
}

async function handleAcceptRequest(requestId) {
    await runFriendAction('accept:' + requestId, async function () {
        try {
            await FriendService.acceptRequest(requestId);
            Notification.success('Запрос принят');
            await refreshAfterAction();
        } catch (error) {
            Notification.error(error.message || 'Не удалось принять запрос');
        }
    });
}

async function handleRejectRequest(requestId) {
    await runFriendAction('reject:' + requestId, async function () {
        try {
            await FriendService.rejectRequest(requestId);
            Notification.success('Запрос отклонён');
            await refreshAfterAction();
        } catch (error) {
            Notification.error(error.message || 'Не удалось отклонить запрос');
        }
    });
}

async function handleCancelRequest(requestId) {
    await runFriendAction('cancel:' + requestId, async function () {
        try {
            await FriendService.cancelRequest(requestId);
            Notification.success('Запрос отменён');
            await refreshAfterAction();
        } catch (error) {
            Notification.error(error.message || 'Не удалось отменить запрос');
        }
    });
}

async function handleRemoveFriend(friendId) {
    const confirmed = await confirmRemoveFriend();
    if (!confirmed) return;

    await runFriendAction('remove:' + friendId, async function () {
        try {
            await FriendService.removeFriend(friendId);
            Notification.success('Друг удалён');
            await refreshAfterAction();
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

async function runFriendAction(key, action) {
    await Utils.runPendingAction(pageState.pendingActions, key, action);
}

const handleSearchInput = Utils.debounce(function (event) {
    const query = event.target.value.trim();
    searchUsers(query);
}, SEARCH_DEBOUNCE_MS);

function handleSearchFocus(event) {
    const query = event.target.value.trim();
    const container = Utils.getElement('search-results');

    if (!container || query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH || container.childElementCount === 0) {
        return;
    }

    container.classList.remove('is-hidden');
}

function handleDocumentClick(event) {
    const searchSection = event.target.closest('.friends-search-section');
    if (searchSection) return;

    hideSearchResults();
}

function hideSearchResults() {
    const container = Utils.getElement('search-results');
    if (!container) return;

    container.classList.add('is-hidden');
}

async function refreshAfterAction() {
    await Promise.all([
        loadIncomingRequests(),
        loadOutgoingRequests(),
        loadFriends(),
    ]);

    const searchInput = Utils.getElement('user-search-input');
    if (searchInput && searchInput.value.trim().length >= 2) {
        await searchUsers(searchInput.value.trim());
    }
}

// 10. ПРИВЯЗКА СОБЫТИЙ //

function bindEvents() {
    const searchInput = Utils.getElement('user-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('focus', handleSearchFocus);
    }

    document.addEventListener('click', handleDocumentClick);
}

// 11. ЗАПУСК  //

function destroy() {
    const searchInput = Utils.getElement('user-search-input');
    if (searchInput) {
        searchInput.removeEventListener('input', handleSearchInput);
        searchInput.removeEventListener('focus', handleSearchFocus);
    }

    document.removeEventListener('click', handleDocumentClick);
}

PageRegistry.register('friends', {
    init: initFriendsPage,
    destroy: destroy,
});
})();
