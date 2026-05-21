/**
 *  СТРАНИЦА: Коллекции — список, создание, детали через .card-mini-grid 
 *
 * НАЗНАЧЕНИЕ:
 *   Управляет пользовательскими коллекциями: списком, созданием, деталями,
 *   поиском изданий для добавления и операциями с полкой.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const pageState = {
    currentUser: null,
    targetUserId: null,
    profileUser: null,
    isOwnCollections: true,
    collectionsHidden: false,
    libraries: [],
    selectedLibrary: null,
    selectedPage: 1,
    addSearchResults: [],
    addSearchQuery: '',
    routeLibraryId: null,
    pendingActions: new Set(),
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;
    pageState.currentUser = user;
    pageState.targetUserId = getRouteUserId();
    pageState.isOwnCollections = pageState.targetUserId === null || pageState.targetUserId === user.id;
    initNavigation(user);
    setupEventListeners();
    pageState.routeLibraryId = getRouteLibraryId();
    const isProfileReady = await loadProfileIfNeeded();
    if (!isProfileReady) return;
    applyPageMode();

    if (pageState.routeLibraryId) {
        await loadLibraryDetails(pageState.routeLibraryId);
        return;
    }

    await loadLibraries();
}

//  3. ЗАГРУЗКА  //

async function loadLibraries() {
    try {
        pageState.libraries = pageState.isOwnCollections
            ? await LibraryService.getUserLibraries() || []
            : await LibraryService.getPublicLibraries(pageState.targetUserId) || [];
        pageState.collectionsHidden = false;
        renderList();
    } catch (error) {
        pageState.libraries = [];
        pageState.collectionsHidden = error.status === 403;
        renderList();
        if (!pageState.collectionsHidden) {
            Notification.error('Ошибка загрузки коллекций: ' + error.message);
        }
    }
}

async function loadProfileIfNeeded() {
    if (pageState.isOwnCollections || pageState.routeLibraryId) return true;

    try {
        pageState.profileUser = await AuthService.getProfile(pageState.targetUserId);
        return true;
    } catch (error) {
        pageState.collectionsHidden = true;
        renderList();
        return false;
    }
}

async function loadLibraryDetails(libraryId) {
    try {
        pageState.selectedLibrary = await LibraryService.getLibrary(libraryId, pageState.selectedPage);
        pageState.addSearchResults = [];
        pageState.addSearchQuery = '';
        applyPageMode();
        renderDetails();
    } catch (error) {
        Notification.error('Ошибка загрузки коллекции: ' + error.message);
        if (pageState.routeLibraryId) {
            PageRouter.open(PAGE_URL.COLLECTIONS);
        }
    }
}

//  4. РЕНДЕРИНГ — СПИСОК  //

function renderList() {
    const container = document.getElementById('collections-list');
    if (!container) return;

    container.replaceChildren();
    toggleDetailsVisibility(false);
    renderCollectionsCount();

    if (pageState.collectionsHidden) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'Коллекции скрыты',
                iconName: 'lock',
                subtitle: 'Владелец профиля ограничил доступ',
            }));
        }
        return;
    }

    if (pageState.libraries.length === 0) {
        toggleDetailsVisibility(false);
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: pageState.isOwnCollections ? 'Коллекций пока нет' : 'Нет публичных коллекций',
                iconName: 'folder',
                subtitle: pageState.isOwnCollections ? 'Создайте первую коллекцию' : null,
                actionLabel: pageState.isOwnCollections ? 'Создать коллекцию' : null,
                onAction: pageState.isOwnCollections ? () => toggleCreateForm(true) : null,
            }));
        }
        return;
    }

    pageState.libraries.forEach(library => {
        const card = renderCollectionCard(library);
        container.appendChild(card);
    });
    if (pageState.isOwnCollections) {
        container.appendChild(renderNewCollectionCard());
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderCollectionsCount() {
    const countElement = document.getElementById('collections-count');
    if (!countElement) return;
    countElement.textContent = '(' + pageState.libraries.length + ')';
}

function renderCollectionCard(library) {
    const card = document.createElement('article');
    card.className = 'collection-card surface-elevated';

    card.appendChild(renderCollectionCollage(library));

    const body = document.createElement('div');
    body.className = 'collection-card-body';

    const title = document.createElement('h3');
    title.className = 'collection-card-title';
    title.textContent = library.library_name;
    body.appendChild(title);

    if (library.library_description) {
        const desc = document.createElement('p');
        desc.className = 'collection-card-desc';
        desc.textContent = library.library_description;
        body.appendChild(desc);
    }

    const meta = document.createElement('div');
    meta.className = 'collection-card-meta';
    if (library.is_private && pageState.isOwnCollections) {
        const privacy = document.createElement('span');
        privacy.className = 'collection-card-meta-item collection-card-privacy';
        const privacyIcon = document.createElement('i');
        privacyIcon.setAttribute('data-lucide', 'lock');
        privacy.appendChild(privacyIcon);
        const privacyText = document.createElement('span');
        privacyText.textContent = 'Приватная';
        privacy.appendChild(privacyText);
        meta.appendChild(privacy);
    }

    const count = document.createElement('span');
    count.className = 'collection-card-meta-item';
    const countIcon = document.createElement('i');
    countIcon.setAttribute('data-lucide', 'book');
    count.appendChild(countIcon);
    const countText = document.createElement('span');
    countText.textContent = (library.book_count || 0) + ' изданий';
    count.appendChild(countText);
    meta.appendChild(count);
    if (library.time_created) {
        const created = document.createElement('span');
        created.className = 'collection-card-meta-item';
        const createdIcon = document.createElement('i');
        createdIcon.setAttribute('data-lucide', 'calendar');
        created.appendChild(createdIcon);
        const createdText = document.createElement('span');
        createdText.textContent = Utils.formatDate(library.time_created);
        created.appendChild(createdText);
        meta.appendChild(created);
    }
    body.appendChild(meta);

    card.appendChild(body);

    card.addEventListener('click', () => {
        PageRouter.open(PAGE_URL.COLLECTIONS + '?id=' + library.id);
    });

    return card;
}

function renderCollectionCollage(library) {
    const collage = document.createElement('div');
    collage.className = 'collection-card-collage';

    const covers = String(library.cover_paths || '')
        .split('||')
        .filter(Boolean)
        .slice(0, COLLECTION_COLLAGE_COVER_LIMIT);

    for (let index = 0; index < COLLECTION_COLLAGE_COVER_LIMIT; index++) {
        const cell = document.createElement('div');
        cell.className = 'collection-card-collage-cell';

        if (covers[index]) {
            const image = document.createElement('img');
            image.src = covers[index];
            image.alt = '';
            cell.appendChild(image);
        } else {
            cell.classList.add('is-empty');
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'book-open');
            cell.appendChild(icon);
        }

        collage.appendChild(cell);
    }

    return collage;
}

function renderNewCollectionCard() {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'collection-card collection-card-new';
    card.addEventListener('click', () => toggleCreateForm(true));

    const inner = document.createElement('span');
    inner.className = 'collection-card-new-inner';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'plus-circle');
    inner.appendChild(icon);
    const text = document.createElement('span');
    text.textContent = 'Создать коллекцию';
    inner.appendChild(text);
    card.appendChild(inner);

    return card;
}

//  5. РЕНДЕРИНГ — ДЕТАЛИ  //

function renderDetails() {
    const container = document.getElementById('collection-details');
    if (!container || !pageState.selectedLibrary) return;

    container.replaceChildren();
    toggleDetailsVisibility(true);
    container.classList.add('collection-detail');

    const lib = pageState.selectedLibrary;

    const header = document.createElement('header');
    header.className = 'section-card-header collection-detail-header';
    const headerBody = document.createElement('div');

    const title = document.createElement('h2');
    title.className = 'section-card-title';
    title.textContent = lib.library_name;
    headerBody.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'section-card-subtitle';
    subtitle.textContent = composeCollectionMetaText(lib);
    headerBody.appendChild(subtitle);

    if (lib.library_description) {
        const description = document.createElement('p');
        description.className = 'collection-detail-description';
        description.textContent = lib.library_description;
        headerBody.appendChild(description);
    }
    header.appendChild(headerBody);

    const actions = document.createElement('div');
    actions.className = 'section-card-actions collection-detail-actions';

    if (lib.is_owner) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-ghost btn-sm';
        appendCollectionButtonIcon(editBtn, 'pencil', 'Изменить');
        editBtn.addEventListener('click', handleEditLibrary);
        actions.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger-ghost btn-sm';
        appendCollectionButtonIcon(deleteBtn, 'trash-2', 'Удалить');
        deleteBtn.addEventListener('click', handleDeleteLibrary);
        actions.appendChild(deleteBtn);
    }
    header.appendChild(actions);
    container.appendChild(header);

    if (lib.is_owner) {
        container.appendChild(buildAddEditionPanel());
    }

    const items = (lib.books && lib.books.items) || [];
    if (items.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'В коллекции пока нет изданий',
                iconName: 'book-x',
                subtitle: 'Добавьте издания со страницы книги',
            }));
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'collection-detail-grid';
    items.forEach(item => {
        grid.appendChild(renderCollectionEditionCard(item, lib.is_owner));
    });
    container.appendChild(grid);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderCollectionEditionCard(item, canRemove) {
    const card = document.createElement('article');
    card.className = 'collection-edition-card';
    card.addEventListener('click', function (event) {
        if (event.target.closest('.collection-edition-remove')) return;
        PageRouter.open(PAGE_URL.BOOK + '?id=' + item.book_id);
    });

    const cover = document.createElement('div');
    cover.className = 'collection-edition-cover';
    cover.appendChild(Utils.createImage(
        item.edition_cover_path,
        Utils.safeText(item.book_title, ''),
        DEFAULT_BOOK_COVER_URL
    ));
    card.appendChild(cover);

    const body = document.createElement('div');
    body.className = 'collection-edition-body';

    const top = document.createElement('div');
    top.className = 'collection-edition-top';
    if (item.edition_language) {
        const lang = document.createElement('span');
        lang.className = 'lang-chip';
        lang.textContent = String(item.edition_language).toUpperCase();
        top.appendChild(lang);
    }
    if (item.edition_type) {
        const type = document.createElement('span');
        type.className = 'edition-type-icon';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', EDITION_TYPE_ICONS[item.edition_type] || 'book');
        type.appendChild(icon);
        const label = document.createElement('span');
        label.textContent = ' ' + (EDITION_TYPE_LABELS[item.edition_type] || item.edition_type);
        type.appendChild(label);
        top.appendChild(type);
    }
    body.appendChild(top);

    const title = document.createElement('h3');
    title.className = 'collection-edition-title';
    title.textContent = Utils.safeText(item.book_title, 'Без названия');
    body.appendChild(title);

    const author = document.createElement('p');
    author.className = 'collection-edition-author';
    const authorParts = [];
    if (item.book_author) authorParts.push(item.book_author);
    if (item.edition_publisher) authorParts.push(item.edition_publisher);
    author.textContent = authorParts.length > 0 ? authorParts.join(' · ') : 'Автор не указан';
    body.appendChild(author);

    if (canRemove) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'collection-edition-remove';
        remove.setAttribute('aria-label', 'Убрать издание из коллекции');
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'x');
        remove.appendChild(icon);
        remove.addEventListener('click', function (event) {
            event.stopPropagation();
            handleRemoveEdition(item.edition_id);
        });
        body.appendChild(remove);
    }

    card.appendChild(body);
    return card;
}

function buildAddEditionPanel() {
    const panel = document.createElement('section');
    panel.className = 'create-form collection-add-panel';

    const title = document.createElement('h3');
    title.className = 'create-form-title';
    title.textContent = 'Добавить издание из вашей библиотеки';
    panel.appendChild(title);

    const search = document.createElement('div');
    search.className = 'library-search';

    const wrap = document.createElement('div');
    wrap.className = 'library-search-wrap';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'search');
    wrap.appendChild(icon);

    const input = document.createElement('input');
    input.className = 'form-input library-search-input';
    input.type = 'text';
    input.placeholder = 'Название, автор, издатель или ISBN';
    wrap.appendChild(input);
    search.appendChild(wrap);
    panel.appendChild(search);

    const results = document.createElement('div');
    results.className = 'card-mini-grid collection-add-results';
    panel.appendChild(results);

    const onInput = Utils.debounce(() => {
        handleAddEditionSearch(input.value, results);
    }, CATALOG_SEARCH_DEBOUNCE_MS);
    input.addEventListener('input', onInput);

    renderAddEditionResults(results);
    return panel;
}

async function handleAddEditionSearch(query, resultsContainer) {
    pageState.addSearchQuery = query.trim();

    if (pageState.addSearchQuery.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
        pageState.addSearchResults = [];
        renderAddEditionResults(resultsContainer);
        return;
    }

    try {
        const data = await LibraryService.searchUserLibrary({
            query: pageState.addSearchQuery,
            page: PAGINATION_DEFAULT_PAGE,
            perPage: COLLECTION_ADD_SEARCH_LIMIT,
        });
        pageState.addSearchResults = filterEditionsOutsideSelectedCollection(data.items || []);
        renderAddEditionResults(resultsContainer);
    } catch (error) {
        Notification.error(error.message || 'Не удалось выполнить поиск');
    }
}

function renderAddEditionResults(container) {
    if (!container) return;
    container.replaceChildren();

    if (pageState.addSearchQuery.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
        return;
    }

    if (pageState.addSearchResults.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Подходящих изданий не найдено',
            iconName: 'book-x',
            subtitle: 'Возможно, издание уже есть в этой коллекции',
        }));
        return;
    }

    pageState.addSearchResults.forEach(item => {
        container.appendChild(renderCardMiniComponent(item, {
            onClick: it => { PageRouter.open(PAGE_URL.BOOK + '?id=' + it.book_id); },
            onAdd: handleAddEditionToSelectedLibrary,
        }));
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function filterEditionsOutsideSelectedCollection(items) {
    const currentItems = pageState.selectedLibrary?.books?.items || [];
    const currentIds = new Set(currentItems.map(item => parseInt(item.edition_id, 10)));
    return items.filter(item => !currentIds.has(parseInt(item.edition_id, 10)));
}

//  6. ОБРАБОТЧИКИ  //

function setupEventListeners() {
    const createBtn = document.getElementById('create-collection-button');
    if (createBtn) {
        createBtn.addEventListener('click', () => toggleCreateForm(true));
    }

    const cancelBtn = document.getElementById('cancel-create-collection-button');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => toggleCreateForm(false));
    }

    const createForm = document.getElementById('create-collection-form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateLibrary);
    }
}

async function handleCreateLibrary(event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById('create-collection-name');
    const descriptionInput = document.getElementById('create-collection-description');
    const privateInput = document.getElementById('create-collection-private');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        Notification.error('Введите название коллекции');
        return;
    }

    await runPendingAction('create-library', async function () {
        try {
            const library = await LibraryService.createLibrary({
                library_name: name,
                library_description: descriptionInput ? descriptionInput.value.trim() : '',
                is_private: privateInput && privateInput.checked ? 1 : 0,
            });
            Notification.success('Коллекция создана');
            resetCreateForm();
            toggleCreateForm(false);
            if (library && library.id) {
                PageRouter.open(PAGE_URL.COLLECTIONS + '?id=' + library.id);
            } else {
                await loadLibraries();
            }
        } catch (error) {
            Notification.error(error.message);
        }
    });
}

async function handleEditLibrary() {
    if (!pageState.selectedLibrary) return;

    const form = buildCollectionForm(pageState.selectedLibrary);
    openCollectionModal('Редактировать коллекцию', form.element, async () => {
        const data = form.getData();
        if (!data.library_name) {
            Notification.error('Введите название коллекции');
            return false;
        }

        await LibraryService.updateLibrary(pageState.selectedLibrary.id, data);
        Notification.success('Коллекция обновлена');
        await loadLibraryDetails(pageState.selectedLibrary.id);
        return true;
    });
}

function toggleCreateForm(isVisible) {
    const section = document.getElementById('create-collection-section');
    if (!section) return;

    if (isVisible) {
        Utils.showElement(section);
        const nameInput = document.getElementById('create-collection-name');
        if (nameInput) nameInput.focus();
    } else {
        Utils.hideElement(section);
    }
}

function resetCreateForm() {
    const form = document.getElementById('create-collection-form');
    if (form) form.reset();
}

async function handleDeleteLibrary() {
    if (!pageState.selectedLibrary) return;

    const libraryId = pageState.selectedLibrary.id;
    const libraryName = pageState.selectedLibrary.library_name;

    await runPendingAction('delete-library:' + libraryId, async function () {
        const confirmed = await AppConfirm.ask({
            title: 'Удалить коллекцию',
            message: 'Удалить коллекцию «' + libraryName + '»?',
            confirmLabel: 'Удалить',
            isDanger: true,
        });
        if (!confirmed) return;

        try {
            await LibraryService.deleteLibrary(libraryId);
            pageState.selectedLibrary = null;
            Notification.success('Коллекция удалена');
            PageRouter.open(PAGE_URL.COLLECTIONS);
        } catch (error) {
            Notification.error(error.message);
        }
    });
}

function toggleDetailsVisibility(isVisible) {
    const details = document.getElementById('collection-details');
    if (!details) return;

    if (isVisible) {
        Utils.showElement(details);
    } else {
        Utils.hideElement(details);
    }
}

async function handleRemoveEdition(editionId) {
    if (!pageState.selectedLibrary) return;

    const libraryId = pageState.selectedLibrary.id;

    await runPendingAction('remove-edition:' + libraryId + ':' + editionId, async function () {
        const confirmed = await AppConfirm.ask({
            title: 'Убрать издание',
            message: 'Убрать издание из коллекции?',
            confirmLabel: 'Убрать',
            isDanger: true,
        });
        if (!confirmed) return;

        try {
            await LibraryService.removeEdition(libraryId, editionId);
            Notification.success('Издание убрано из коллекции');
            await loadLibraryDetails(libraryId);
        } catch (error) {
            Notification.error(error.message);
        }
    });
}

async function handleAddEditionToSelectedLibrary(item) {
    if (!pageState.selectedLibrary || !item || !item.edition_id) return;

    const libraryId = pageState.selectedLibrary.id;
    const editionId = item.edition_id;

    await runPendingAction('add-edition:' + libraryId + ':' + editionId, async function () {
        try {
            await LibraryService.addEdition(libraryId, editionId);
            Notification.success('Издание добавлено в коллекцию');
            await loadLibraryDetails(libraryId);
        } catch (error) {
            Notification.error(error.message || 'Не удалось добавить издание');
        }
    });
}

//  7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ  //

async function runPendingAction(key, action) {
    await Utils.runPendingAction(pageState.pendingActions, key, action);
}

function getRouteLibraryId() {
    const value = new URLSearchParams(window.location.search).get('id');
    const id = parseInt(value, 10);
    return Number.isNaN(id) || id < 1 ? null : id;
}

function getRouteUserId() {
    const value = new URLSearchParams(window.location.search).get('user_id');
    const id = parseInt(value, 10);
    return Number.isNaN(id) || id < 1 ? null : id;
}

function applyPageMode() {
    const isDetailMode = Boolean(pageState.routeLibraryId);
    const header = document.querySelector('.collections-header');
    const list = document.getElementById('collections-list');
    const createSection = document.getElementById('create-collection-section');

    if (header) {
        if (isDetailMode) Utils.hideElement(header);
        else Utils.showElement(header);
    }

    const title = document.querySelector('.collections-title');
    if (title) {
        title.textContent = pageState.isOwnCollections
            ? 'Мои коллекции '
            : 'Коллекции ' + composeProfileName(pageState.profileUser) + ' ';
        const count = document.getElementById('collections-count');
        if (count) title.appendChild(count);
    }

    if (list) {
        if (isDetailMode) Utils.hideElement(list);
        else Utils.showElement(list);
    }

    if (createSection) {
        Utils.hideElement(createSection);
    }

    renderCollectionsBreadcrumb(isDetailMode);

    document.title = isDetailMode && pageState.selectedLibrary
        ? pageState.selectedLibrary.library_name + ' — Ad Quercum'
        : (pageState.isOwnCollections ? 'Коллекции — Ad Quercum' : 'Коллекции ' + composeProfileName(pageState.profileUser) + ' — Ad Quercum');

    toggleDetailsVisibility(isDetailMode && Boolean(pageState.selectedLibrary));
}

function renderCollectionsBreadcrumb(isDetailMode) {
    const breadcrumb = document.querySelector('.collections-page .breadcrumb');
    if (!breadcrumb) return;

    const homeLink = createBreadcrumbLink('Главная', PAGE_URL.INDEX);
    const collectionsHref = pageState.isOwnCollections || !pageState.targetUserId
        ? PAGE_URL.COLLECTIONS
        : PAGE_URL.COLLECTIONS + '?user_id=' + pageState.targetUserId;
    const collectionsNode = isDetailMode
        ? createBreadcrumbLink('Коллекции', collectionsHref)
        : createBreadcrumbCurrent('Коллекции');

    breadcrumb.replaceChildren(homeLink, createBreadcrumbSeparator(), collectionsNode);

    if (!isDetailMode) return;

    breadcrumb.appendChild(createBreadcrumbSeparator());
    breadcrumb.appendChild(createBreadcrumbCurrent(
        pageState.selectedLibrary?.library_name || 'Коллекция'
    ));
}

function composeProfileName(profile) {
    return Utils.composeUserName(profile, 'пользователя', { prefixIdentifier: true });
}

function createBreadcrumbLink(label, href) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    return link;
}

function createBreadcrumbCurrent(label) {
    const current = document.createElement('span');
    current.textContent = label;
    return current;
}

function createBreadcrumbSeparator() {
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '/';
    return separator;
}

function composeCollectionMetaText(library) {
    const count = Number(library?.book_count || library?.books?.total_count || 0);
    const parts = [count + ' ' + getEditionCountWord(count)];

    if (library?.time_created) {
        parts.push('Создана ' + Utils.formatDate(library.time_created));
    }

    return parts.join(' · ');
}

function getEditionCountWord(count) {
    const abs = Math.abs(count) % 100;
    const last = abs % 10;

    if (abs > 10 && abs < 20) return 'изданий';
    if (last === 1) return 'издание';
    if (last >= 2 && last <= 4) return 'издания';
    return 'изданий';
}

function buildCollectionForm(library) {
    const form = document.createElement('div');
    form.className = 'create-form-fields';

    const nameInput = createCollectionInput(form, 'edit-collection-name', 'Название', 'text', {
        value: library.library_name || '',
        maxlength: 255,
    });

    const descriptionInput = createCollectionTextarea(
        form,
        'edit-collection-description',
        'Описание',
        library.library_description || ''
    );

    const privateField = document.createElement('div');
    privateField.className = 'form-field';
    const privateLabel = document.createElement('label');
    privateLabel.className = 'form-toggle';
    const privateInput = document.createElement('input');
    privateInput.type = 'checkbox';
    privateInput.hidden = true;
    privateInput.checked = Boolean(parseInt(library.is_private, 10));
    privateLabel.appendChild(privateInput);
    const track = document.createElement('span');
    track.className = 'form-toggle-track';
    const dot = document.createElement('span');
    dot.className = 'form-toggle-dot';
    track.appendChild(dot);
    privateLabel.appendChild(track);
    const labelText = document.createElement('span');
    labelText.className = 'form-toggle-label';
    labelText.textContent = 'Приватная коллекция';
    privateLabel.appendChild(labelText);
    privateField.appendChild(privateLabel);
    form.appendChild(privateField);

    return {
        element: form,
        getData: function () {
            return {
                library_name: nameInput.value.trim(),
                library_description: descriptionInput.value.trim(),
                is_private: privateInput.checked ? 1 : 0,
            };
        },
    };
}

function createCollectionInput(parent, id, label, type, attrs) {
    const field = document.createElement('div');
    field.className = 'form-field';

    const labelElement = document.createElement('label');
    labelElement.className = 'form-label';
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    field.appendChild(labelElement);

    const input = document.createElement('input');
    input.id = id;
    input.type = type;
    input.className = 'form-input';
    input.value = attrs.value || '';
    if (attrs.maxlength) input.maxLength = attrs.maxlength;
    field.appendChild(input);
    parent.appendChild(field);

    return input;
}

function createCollectionTextarea(parent, id, label, value) {
    const field = document.createElement('div');
    field.className = 'form-field';

    const labelElement = document.createElement('label');
    labelElement.className = 'form-label';
    labelElement.htmlFor = id;
    labelElement.textContent = label;
    field.appendChild(labelElement);

    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.className = 'form-input form-textarea';
    textarea.rows = 3;
    textarea.value = value || '';
    field.appendChild(textarea);
    parent.appendChild(field);

    return textarea;
}

function openCollectionModal(title, contentElement, onSubmit) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    const card = document.createElement('div');
    card.className = 'modal-card';

    const header = document.createElement('header');
    header.className = 'modal-header';
    const titleElement = document.createElement('h2');
    titleElement.className = 'modal-title';
    titleElement.textContent = title;
    header.appendChild(titleElement);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn-ghost btn-icon';
    closeButton.setAttribute('aria-label', 'Закрыть окно');
    const closeIcon = document.createElement('i');
    closeIcon.setAttribute('data-lucide', 'x');
    closeButton.appendChild(closeIcon);
    closeButton.addEventListener('click', () => backdrop.remove());
    header.appendChild(closeButton);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.appendChild(contentElement);
    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn-ghost';
    cancelButton.textContent = 'Отмена';
    cancelButton.addEventListener('click', () => backdrop.remove());
    actions.appendChild(cancelButton);

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-primary';
    appendCollectionButtonIcon(saveButton, 'check', 'Сохранить');
    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        try {
            const shouldClose = await onSubmit();
            if (shouldClose) backdrop.remove();
        } catch (error) {
            Notification.error(error.message || 'Не удалось сохранить изменения');
        } finally {
            saveButton.disabled = false;
        }
    });
    actions.appendChild(saveButton);
    card.appendChild(actions);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function appendCollectionButtonIcon(button, iconName, label) {
    Utils.appendIconText(button, iconName, label);
}

//  8. ЗАПУСК  //

function destroy() {
    document.querySelectorAll('.modal-backdrop').forEach(function (element) { element.remove(); });
}

PageRegistry.register('collections', {
    init: init,
    destroy: destroy,
});
})();
