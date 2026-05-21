/**
 * СТРАНИЦА: Библиотека — поиск по полке + сетка карточек изданий 
 *
 * НАЗНАЧЕНИЕ:
 *   Рендерит библиотеку пользователя, фильтрацию и поиск по полке, где каждая
 *   карточка представляет конкретное издание из library_books.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const pageState = {
    currentUser: null,
    targetUserId: null,
    profileUser: null,
    isOwnLibrary: true,
    catalogMode: 'my',
    currentPage: 1,
    query: '',
    filters: { status: '', genre: '', language: '' },
    genres: [],
    languages: [],
    isLoading: false,
};

let searchDebounceTimer = null;

const LIBRARY_CATALOG_MODE = {
    MY: 'my',
    ALL: 'all',
};

const LIBRARY_MODE_OPTIONS = [
    { value: LIBRARY_CATALOG_MODE.MY, label: 'Мои книги', icon: 'bookmark-check' },
    { value: LIBRARY_CATALOG_MODE.ALL, label: 'Все книги', icon: 'layout-grid' },
];

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    pageState.currentUser = user;
    pageState.targetUserId = getTargetUserId();
    pageState.isOwnLibrary = pageState.targetUserId === null || pageState.targetUserId === user.id;

    initNavigation(user);
    setupEventListeners();
    const isProfileReady = await loadProfileIfNeeded();
    if (!isProfileReady) return;
    configurePageChrome();
    await loadBooks();
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadBooks(shouldScroll) {
    if (pageState.isLoading) return;
    pageState.isLoading = true;

    try {
        const searchParams = {
            query:    pageState.query,
            status:   pageState.filters.status,
            genre:    pageState.filters.genre,
            language: pageState.filters.language,
            page:     pageState.currentPage,
        };
        const payload = await loadBooksByMode(searchParams);
        pageState.genres = payload.genres || [];
        pageState.languages = payload.languages || [];
        renderModeFilter();
        renderLibraryTitle();
        renderLibraryCount(payload.total_count || 0);
        renderBooks(payload);
        renderFilters();
        renderPaginationBlock(payload);
        if (shouldScroll) {
            scrollToBooksListTop();
        }
    } catch (error) {
        renderUnavailableLibrary(error.message || 'Библиотека недоступна');
    } finally {
        pageState.isLoading = false;
    }
}

async function loadBooksByMode(searchParams) {
    if (!pageState.isOwnLibrary) {
        return await LibraryService.searchPublicUserLibrary(pageState.targetUserId, searchParams);
    }

    if (pageState.catalogMode === LIBRARY_CATALOG_MODE.ALL) {
        return await LibraryService.searchCatalog(searchParams);
    }

    return await LibraryService.searchUserLibrary(searchParams);
}

async function loadProfileIfNeeded() {
    if (pageState.isOwnLibrary) return true;

    try {
        pageState.profileUser = await AuthService.getProfile(pageState.targetUserId);
        return true;
    } catch (error) {
        renderUnavailableLibrary(error.message || 'Профиль недоступен');
        return false;
    }
}

function configurePageChrome() {
    const addButton = document.getElementById('add-book-button');

    renderLibraryTitle();
    renderModeFilter();

    if (addButton) {
        if (pageState.isOwnLibrary) {
            Utils.showElement(addButton);
        } else {
            Utils.hideElement(addButton);
        }
    }

    document.title = pageState.isOwnLibrary
        ? getLibraryTitleText() + ' — Ad Quercum'
        : 'Библиотека ' + composeProfileName(pageState.profileUser) + ' — Ad Quercum';
}

//  4. РЕНДЕРИНГ  //

function renderBooks(payload) {
    const container = document.getElementById('books-list');
    if (!container) return;

    container.replaceChildren();

    if (!payload.items || payload.items.length === 0) {
        const isCatalogMode = pageState.isOwnLibrary
            && pageState.catalogMode === LIBRARY_CATALOG_MODE.ALL;
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: pageState.query
                    ? 'Ничего не найдено'
                    : getEmptyLibraryMessage(isCatalogMode),
                iconName: pageState.query ? 'x' : 'book-open',
                subtitle: pageState.query
                    ? getEmptySearchSubtitle(isCatalogMode)
                    : getEmptyLibrarySubtitle(isCatalogMode),
                actionLabel: getEmptyLibraryActionLabel(isCatalogMode),
                actionHref: getEmptyLibraryActionHref(isCatalogMode),
            }));
        }
        return;
    }

    payload.items.forEach(item => container.appendChild(renderBookCard(item)));

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderLibraryTitle() {
    const titleElement = document.querySelector('.library-title');
    if (!titleElement) return;

    const countElement = document.getElementById('library-count');
    titleElement.textContent = getLibraryTitleText();
    if (countElement) titleElement.appendChild(countElement);
}

function getLibraryTitleText() {
    if (!pageState.isOwnLibrary) {
        return 'Библиотека ' + composeProfileName(pageState.profileUser);
    }

    return pageState.catalogMode === LIBRARY_CATALOG_MODE.ALL
        ? 'Все книги'
        : 'Моя библиотека';
}

function renderLibraryCount(totalCount) {
    const countElement = document.getElementById('library-count');
    if (!countElement) return;
    countElement.textContent = totalCount > 0 ? '(' + totalCount + ' изданий)' : '';
}

function renderFilters() {
    renderChipGroup('status-filter', [
        { value: '', label: 'Все' },
        { value: BOOK_STATUS.READING, label: 'Читаю' },
        { value: BOOK_STATUS.FINISHED, label: 'Прочитано' },
        { value: BOOK_STATUS.WANT_TO_READ, label: 'Хочу прочитать' },
    ], pageState.filters.status, function (value) {
        pageState.filters.status = value;
        pageState.currentPage = 1;
        loadBooks();
    });

    renderChipGroup('language-filter', [
        { value: '', label: 'Все' },
        ...pageState.languages.map(function (language) {
            return { value: language, label: String(language).toUpperCase() };
        }),
    ], pageState.filters.language, function (value) {
        pageState.filters.language = value;
        pageState.currentPage = 1;
        loadBooks();
    });

    renderChipGroup('genre-filter', [
        { value: '', label: 'Все' },
        ...pageState.genres.map(function (genre) {
            return { value: genre, label: Utils.formatGenre(genre) };
        }),
    ], pageState.filters.genre, function (value) {
        pageState.filters.genre = value;
        pageState.currentPage = 1;
        loadBooks();
    });
}

function renderModeFilter() {
    const container = document.getElementById('library-mode-filter');
    if (!container) return;

    container.replaceChildren();

    if (!pageState.isOwnLibrary) {
        Utils.hideElement(container);
        return;
    }

    Utils.showElement(container);

    LIBRARY_MODE_OPTIONS.forEach(function (option) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip';
        button.dataset.libraryMode = option.value;
        button.setAttribute('aria-pressed', option.value === pageState.catalogMode ? 'true' : 'false');
        button.classList.toggle('is-active', option.value === pageState.catalogMode);

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', option.icon);
        button.appendChild(icon);

        const label = document.createElement('span');
        label.textContent = option.label;
        button.appendChild(label);

        button.addEventListener('click', function () {
            handleCatalogModeChange(option.value);
        });

        container.appendChild(button);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderChipGroup(containerId, options, currentValue, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.replaceChildren();

    options.forEach(function (option) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-chip';
        button.textContent = option.label;
        button.dataset.value = option.value;
        if (option.value === currentValue) {
            button.classList.add('is-active');
        }
        button.addEventListener('click', function () {
            if (option.value === currentValue) return;
            onSelect(option.value);
        });
        container.appendChild(button);
    });
}

function renderPaginationBlock(payload) {
    const container = document.getElementById('pagination');
    if (!container) return;

    container.replaceChildren();
    if (!payload.total_pages || payload.total_pages <= 1) return;

    container.appendChild(renderPagination({
        currentPage: payload.page,
        totalPages: payload.total_pages,
        onPageChange: function (page) {
            pageState.currentPage = page;
            loadBooks(true);
        },
        options: {
            totalCount: payload.total_count || 0,
            perPage: payload.per_page || PAGINATION_DEFAULT_PER_PAGE,
            label: 'изданий',
        },
    }));
}

function scrollToBooksListTop() {
    Utils.scrollToElementTop(document.getElementById('books-list'));
}

function shouldScrollElementToTop(element) {
    return Utils.shouldScrollElementToTop(element);
}

//  5. ОБРАБОТЧИКИ  //

function setupEventListeners() {
    const search = document.getElementById('search-input');
    if (search) {
        search.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                pageState.query = search.value.trim();
                pageState.currentPage = 1;
                loadBooks();
            }, AUTOCOMPLETE_DEBOUNCE_MS);
        });
    }

    const addButton = document.getElementById('add-book-button');
    if (addButton) {
        addButton.addEventListener('click', () => {
            PageRouter.open(PAGE_URL.ADD_BOOK);
        });
    }
}

function handleCatalogModeChange(mode) {
    if (mode === pageState.catalogMode) return;
    if (![LIBRARY_CATALOG_MODE.MY, LIBRARY_CATALOG_MODE.ALL].includes(mode)) return;

    pageState.catalogMode = mode;
    pageState.currentPage = 1;
    renderModeFilter();
    renderLibraryTitle();
    document.title = getLibraryTitleText() + ' — Ad Quercum';
    loadBooks(false);
}

function getEmptyLibraryMessage(isCatalogMode) {
    if (isCatalogMode) return 'В каталоге пока пусто';
    return pageState.isOwnLibrary ? 'На полках пока пусто' : 'В библиотеке пока пусто';
}

function getEmptySearchSubtitle(isCatalogMode) {
    return isCatalogMode
        ? 'Если книги ещё нет в каталоге, добавьте её'
        : 'Попробуйте изменить поисковый запрос';
}

function getEmptyLibrarySubtitle(isCatalogMode) {
    if (isCatalogMode) return 'Добавьте первое издание в общий каталог';
    return pageState.isOwnLibrary ? 'Добавьте первое издание в свою библиотеку' : null;
}

function getEmptyLibraryActionLabel(isCatalogMode) {
    if (!pageState.isOwnLibrary) return null;
    return isCatalogMode || !pageState.query ? 'Добавить книгу' : null;
}

function getEmptyLibraryActionHref(isCatalogMode) {
    if (!getEmptyLibraryActionLabel(isCatalogMode)) return null;
    return typeof PAGE_URL !== 'undefined' ? PAGE_URL.ADD_BOOK : 'add-book.html';
}

function getTargetUserId() {
    const value = new URLSearchParams(window.location.search).get('user_id');
    const id = parseInt(value, 10);
    return Number.isNaN(id) || id < 1 ? null : id;
}

function composeProfileName(profile) {
    return Utils.composeUserName(profile, 'пользователя', { prefixIdentifier: true });
}

function renderUnavailableLibrary(message) {
    const container = document.getElementById('books-list');
    if (!container) return;

    container.replaceChildren();
    if (typeof renderEmptyState === 'function') {
        container.appendChild(renderEmptyState({
            message: message || 'Библиотека недоступна',
            iconName: 'lock',
            subtitle: 'Владелец профиля ограничил доступ',
        }));
    }
}

//  6. ЗАПУСК  //

function destroy() {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

PageRegistry.register('library', {
    init: init,
    destroy: destroy,
});
})();
