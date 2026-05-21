/**
 * СТРАНИЦА: Клубы (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 *   Каталог клубов с фильтрами, поиском, созданием клуба и вступлением/заявками.
 *   Использует `club_card_component`, `pagination_component`, `empty_state_component`.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const pageState = {
    currentUser: null,
    activeFilter: CLUB_CATALOG_FILTER.ALL,
    searchQuery: '',
    clubs: [],
    clubsPage: 1,
    clubsTotalPages: 1,
    clubsTotalCount: 0,
    myClubsTotalCount: 0,
    isCreateFormVisible: false,
};

const CLUB_FILTER_OPTIONS = [
    { value: CLUB_CATALOG_FILTER.ALL, icon: 'layout-grid' },
    { value: CLUB_CATALOG_FILTER.MY, icon: 'bookmark-check' },
    { value: CLUB_CATALOG_FILTER.PUBLIC, icon: 'globe' },
    { value: CLUB_CATALOG_FILTER.PRIVATE, icon: 'lock' },
    { value: CLUB_CATALOG_FILTER.PENDING, icon: 'mail-check' },
];

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initClubsPage() {
    try {
        const user = await AuthGuard.requireAuth();
        if (!user) return;

        pageState.currentUser = user;
        if (typeof initNavigation === 'function') {
            initNavigation(user);
        }

        await loadMyClubsSummary();
        pageState.activeFilter = pageState.myClubsTotalCount > 0
            ? CLUB_CATALOG_FILTER.MY
            : CLUB_CATALOG_FILTER.ALL;

        bindEvents();
        renderFilterButtons();
        await loadCatalogClubs(1);
    } catch (error) {
        Notification.error('Ошибка загрузки страницы');
    }
}

//  3. ЗАГРУЗКА  //

async function loadMyClubsSummary() {
    const data = await ClubService.getMyClubs(1, 1);
    pageState.myClubsTotalCount = data.total_count || 0;
}

async function loadCatalogClubs(page) {
    try {
        if (page !== undefined) pageState.clubsPage = page;

        const data = await ClubService.getCatalogClubs(
            pageState.activeFilter,
            pageState.searchQuery,
            pageState.clubsPage,
            CLUB_CATALOG_PER_PAGE
        );

        pageState.clubs = data.items || [];
        pageState.clubsTotalPages = data.total_pages || 1;
        pageState.clubsTotalCount = data.total_count || 0;

        renderCatalog();
    } catch (error) {
        Notification.error(error.message || 'Не удалось загрузить клубы');
    }
}

//  4. РЕНДЕРИНГ //

function renderCatalog() {
    renderFilterButtons();
    renderClubsCount();
    renderClubsSummary();
    renderSectionTitle();
    renderClubGrid();
    renderCatalogPagination();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderFilterButtons() {
    const container = Utils.getElement('club-filter-group');
    if (!container) return;

    Utils.clearChildren(container);

    CLUB_FILTER_OPTIONS.forEach(function (option) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip';
        button.dataset.clubFilter = option.value;
        button.setAttribute('aria-pressed', option.value === pageState.activeFilter ? 'true' : 'false');
        button.classList.toggle('is-active', option.value === pageState.activeFilter);

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', option.icon);
        button.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = CLUB_CATALOG_FILTER_LABELS[option.value] || option.value;
        button.appendChild(label);

        button.addEventListener('click', function () {
            handleFilterChange(option.value);
        });

        container.appendChild(button);
    });
}

function renderClubsCount() {
    const countElement = Utils.getElement('clubs-count');
    if (!countElement) return;

    countElement.textContent = '('
        + pageState.clubsTotalCount
        + ' '
        + formatClubCountWord(pageState.clubsTotalCount)
        + ')';
}

function renderClubsSummary() {
    const countElement = Utils.getElement('clubs-total-count');

    if (countElement) {
        countElement.textContent = 'Найдено ' + pageState.clubsTotalCount;
    }
}

function renderSectionTitle() {
    const title = Utils.getElement('clubs-section-title');
    if (!title) return;

    let text = pageState.searchQuery
        ? 'Результаты поиска'
        : (CLUB_CATALOG_FILTER_LABELS[pageState.activeFilter] || 'Клубы');

    if (pageState.searchQuery) {
        title.textContent = text;
        return;
    }

    if (pageState.activeFilter === CLUB_CATALOG_FILTER.ALL) {
        text = 'Все клубы';
    } else if (pageState.activeFilter === CLUB_CATALOG_FILTER.MY) {
        text = 'Мои клубы';
    } else if (pageState.activeFilter === CLUB_CATALOG_FILTER.PENDING) {
        text = 'Заявки в клубы';
    }

    title.textContent = text;
}

function renderClubGrid() {
    const container = Utils.getElement('clubs-catalog-list');
    if (!container) return;

    Utils.clearChildren(container);

    if (pageState.clubs.length === 0) {
        container.appendChild(renderEmptyState(getEmptyStateProps()));
        return;
    }

    pageState.clubs.forEach(function (club) {
        container.appendChild(renderClubCard({
            club: adaptClubForCard(club),
            canOpen: canOpenClub(club),
            onOpen: function () {
                PageRouter.open(PAGE_URL.CLUB + '?id=' + club.id);
            },
            onJoin: function () {
                handleJoinClub(club.id);
            },
            onRequestJoin: function () {
                handleRequestJoinClub(club.id);
            },
            onCancelRequest: function () {
                handleCancelJoinRequest(club.join_request_id);
            },
        }));
    });
}

function renderCatalogPagination() {
    const paginationContainer = Utils.getElement('clubs-catalog-pagination');
    if (!paginationContainer) return;

    Utils.clearChildren(paginationContainer);
    if (pageState.clubsTotalPages <= 1) return;

    paginationContainer.appendChild(renderPagination({
        currentPage: pageState.clubsPage,
        totalPages: pageState.clubsTotalPages,
        onPageChange: function (newPage) { loadCatalogClubs(newPage); },
        options: {
            totalCount: pageState.clubsTotalCount,
            perPage: CLUB_CATALOG_PER_PAGE,
            label: 'клубов',
        },
    }));
}

function getEmptyStateProps() {
    if (pageState.searchQuery) {
        return {
            message: 'Клубы не найдены',
            iconName: 'search-x',
            subtitle: 'Попробуйте изменить запрос или фильтр',
        };
    }

    if (pageState.activeFilter === CLUB_CATALOG_FILTER.MY) {
        return {
            message: 'Вы не состоите ни в одном клубе',
            iconName: 'users-round',
            subtitle: 'Переключитесь на все клубы или создайте свой',
        };
    }

    if (pageState.activeFilter === CLUB_CATALOG_FILTER.PENDING) {
        return {
            message: 'Нет активных заявок',
            iconName: 'mail-check',
            subtitle: 'Приватные клубы появятся здесь после подачи заявки',
        };
    }

    return {
        message: 'Клубы пока не созданы',
        iconName: 'book-open',
        subtitle: 'Создайте первый клуб для обсуждения книг',
    };
}

function formatClubCountWord(count) {
    const value = Number(count) || 0;
    const lastTwo = value % 100;
    const lastOne = value % 10;

    if (lastTwo >= 11 && lastTwo <= 14) {
        return 'клубов';
    }

    if (lastOne === 1) {
        return 'клуб';
    }

    if (lastOne >= 2 && lastOne <= 4) {
        return 'клуба';
    }

    return 'клубов';
}

//  5. АДАПТЕР  //

function adaptClubForCard(club) {
    return {
        club_id: club.id || club.club_id,
        club_name: club.club_name,
        club_description: club.club_description,
        club_image_path: club.club_image_path,
        is_public: club.is_public,
        members_count: club.member_count || club.members_count,
        my_role: club.current_user_role || club.my_role,
        join_request_id: club.join_request_id || club.request_id,
        join_request_status: club.join_request_status || club.request_status,
        current_book_title: club.current_book_title,
    };
}

function canOpenClub(club) {
    return Number(club.is_public) === 1 || Boolean(club.current_user_role);
}

//  6. ОБРАБОТЧИКИ  //

async function handleCreateClub(event) {
    event.preventDefault();

    const nameInput = Utils.getElement('create-club-name');
    const descriptionInput = Utils.getElement('create-club-description');
    const publicCheckbox = Utils.getElement('create-club-public');

    const clubName = nameInput ? nameInput.value.trim() : '';
    if (!clubName) {
        Notification.error('Введите название клуба');
        return;
    }

    try {
        await ClubService.createClub({
            club_name: clubName,
            club_description: descriptionInput ? (descriptionInput.value.trim() || null) : null,
            is_public: publicCheckbox ? publicCheckbox.checked : true,
        });

        Notification.success('Клуб создан');

        if (nameInput) nameInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (publicCheckbox) publicCheckbox.checked = true;

        handleToggleCreateForm(false);
        await loadMyClubsSummary();
        pageState.activeFilter = CLUB_CATALOG_FILTER.MY;
        await loadCatalogClubs(1);
    } catch (error) {
        Notification.error(error.message || 'Не удалось создать клуб');
    }
}

function handleToggleCreateForm(forceState) {
    const section = Utils.getElement('create-club-section');
    if (!section) return;

    pageState.isCreateFormVisible = typeof forceState === 'boolean'
        ? forceState
        : !pageState.isCreateFormVisible;
    section.classList.toggle('is-hidden', !pageState.isCreateFormVisible);
}

function handleFilterChange(filter) {
    if (filter === pageState.activeFilter) return;

    pageState.activeFilter = filter;
    loadCatalogClubs(1);
}

async function handleJoinClub(clubId) {
    try {
        await ClubService.joinClub(clubId);
        Notification.success('Вы вступили в клуб');

        await loadMyClubsSummary();
        await loadCatalogClubs(pageState.clubsPage);
    } catch (error) {
        Notification.error(error.message || 'Не удалось вступить в клуб');
    }
}

async function handleRequestJoinClub(clubId) {
    try {
        await ClubService.requestJoinClub(clubId);
        Notification.success('Заявка отправлена');
        await loadCatalogClubs(pageState.clubsPage);
    } catch (error) {
        Notification.error(error.message || 'Не удалось отправить заявку');
    }
}

async function handleCancelJoinRequest(requestId) {
    if (!requestId) return;

    try {
        await ClubService.cancelJoinRequest(requestId);
        Notification.success('Заявка отменена');
        await loadCatalogClubs(pageState.clubsPage);
    } catch (error) {
        Notification.error(error.message || 'Не удалось отменить заявку');
    }
}

const handleSearchInput = Utils.debounce(function (event) {
    pageState.searchQuery = event.target.value.trim();
    loadCatalogClubs(1);
}, SEARCH_DEBOUNCE_MS);

//  7. ПРИВЯЗКА СОБЫТИЙ  //

function bindEvents() {
    const createForm = Utils.getElement('create-club-form');
    const toggleButton = Utils.getElement('toggle-create-form-button');
    const cancelButton = Utils.getElement('cancel-create-button');
    const searchInput = Utils.getElement('club-search-input');

    if (createForm) createForm.addEventListener('submit', handleCreateClub);
    if (toggleButton) toggleButton.addEventListener('click', function () {
        handleToggleCreateForm();
    });
    if (cancelButton) cancelButton.addEventListener('click', function () {
        handleToggleCreateForm(false);
    });
    if (searchInput) searchInput.addEventListener('input', handleSearchInput);
}

//  8. ЗАПУСК  //

function destroy() {}

PageRegistry.register('clubs', {
    init: initClubsPage,
    destroy: destroy,
});
})();
