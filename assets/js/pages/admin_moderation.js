/**
 *  СТРАНИЦА: Админ — модерация (произведения / издания / возможные дубликаты) 
 *
 * НАЗНАЧЕНИЕ:
 *   Трёхвкладочный UI: «Произведения» / «Издания» / «Возможные дубликаты». Каждая —
 *   пагинированный список с действиями. Использует `pending_edition_card_component`
 *   для изданий, `empty_state_component` для пустых состояний и `pagination_component`.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const TAB = { BOOKS: 'books', EDITIONS: 'editions', DUPLICATES: 'duplicates' };

const pageState = {
    activeTab: TAB.BOOKS,
    page: PAGINATION_DEFAULT_PAGE,
    isLoading: false,
    duplicatePayload: null,
    duplicateMasters: {},
    bookCatalog: {
        query: '',
        moderationStatus: '',
        page: PAGINATION_DEFAULT_PAGE,
        payload: null,
    },
    editionCatalog: {
        query: '',
        moderationStatus: '',
        language: '',
        type: '',
        page: PAGINATION_DEFAULT_PAGE,
        payload: null,
    },
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;
    if (user.user_role !== USER_ROLE.ADMIN && user.user_role !== USER_ROLE.MODERATOR) {
        Notification.error('Доступ только для модераторов');
        PageRouter.open(PAGE_URL.INDEX);
        return;
    }
    if (typeof initNavigation === 'function') {
        initNavigation(user);
    }
    setupEventListeners();
    await loadCurrentTab();
}

//  3. ЗАГРУЗКА  //

async function loadCurrentTab() {
    if (pageState.isLoading) return;
    pageState.isLoading = true;

    try {
        let payload;

        if (pageState.activeTab === TAB.BOOKS) {
            const results = await Promise.all([
                AdminService.getPendingBooks(pageState.page),
                loadBookCatalogPayload(),
            ]);
            payload = results[0];
            renderBooksList(payload, results[1]);
        } else if (pageState.activeTab === TAB.EDITIONS) {
            const results = await Promise.all([
                AdminService.getPendingEditions(pageState.page),
                loadEditionCatalogPayload(),
            ]);
            payload = results[0];
            renderEditionsList(payload, results[1]);
        } else {
            payload = await AdminService.listDuplicates(pageState.page);
            renderDuplicatesList(payload);
        }

        renderPaginationBlock(payload);
    } catch (error) {
        Notification.error('Ошибка загрузки: ' + (error.message || ''));
    } finally {
        pageState.isLoading = false;
    }
}

async function loadBookCatalogPayload() {
    const payload = await AdminService.getAllBooks({
        query: pageState.bookCatalog.query,
        moderation_status: pageState.bookCatalog.moderationStatus,
        page: pageState.bookCatalog.page,
        per_page: ADMIN_CATALOG_PREVIEW_PER_PAGE,
    });
    pageState.bookCatalog.payload = payload;
    return payload;
}

async function loadEditionCatalogPayload() {
    const payload = await AdminService.getAllEditions({
        query: pageState.editionCatalog.query,
        moderation_status: pageState.editionCatalog.moderationStatus,
        language: pageState.editionCatalog.language,
        type: pageState.editionCatalog.type,
        page: pageState.editionCatalog.page,
        per_page: ADMIN_CATALOG_PREVIEW_PER_PAGE,
    });
    pageState.editionCatalog.payload = payload;
    return payload;
}

//  4. РЕНДЕРИНГ — ПРОИЗВЕДЕНИЯ  //

function renderBooksList(payload, catalogPayload) {
    const container = Utils.getElement('moderation-list');
    if (!container) return;
    Utils.clearChildren(container);

    const queueSection = buildModerationSection(
        'Очередь на модерацию',
        payload ? payload.total_count : 0
    );
    container.appendChild(queueSection.section);

    const items = (payload && payload.items) || [];
    if (items.length === 0) {
        queueSection.body.appendChild(renderEmptyState({
            message: 'Очередь произведений пуста',
            iconName: 'book-open',
            subtitle: 'Все заявки рассмотрены',
        }));
    } else {
        items.forEach(function (book) {
            queueSection.body.appendChild(buildBookModerationCard(book));
        });
    }

    const catalogPayloadData = catalogPayload || pageState.bookCatalog.payload;
    container.appendChild(buildBookCatalogSection(catalogPayloadData));
    container.appendChild(buildCatalogPagination('book', catalogPayloadData));

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function buildBookModerationCard(book) {
    const card = document.createElement('article');
    card.className = 'pending-card';

    const cover = document.createElement('div');
    cover.className = 'pending-card-cover';
    cover.appendChild(Utils.createImage(null, '', DEFAULT_BOOK_COVER_URL));
    card.appendChild(cover);

    const body = document.createElement('div');
    body.className = 'pending-card-body';

    const title = document.createElement('h3');
    title.className = 'pending-card-title';
    const titleLink = document.createElement('a');
    titleLink.className = 'pending-card-title-link';
    titleLink.href = PAGE_URL.BOOK + '?id=' + book.id;
    Utils.setSafeText(titleLink, book.book_title, { fallback: 'Без названия' });
    title.appendChild(titleLink);
    body.appendChild(title);

    const author = document.createElement('div');
    author.className = 'pending-card-author';
    Utils.setSafeText(author, book.book_author, { fallback: '—' });
    body.appendChild(author);

    const meta = document.createElement('div');
    meta.className = 'pending-card-meta';
    const detailsRow = buildPendingMetaRow();
    appendPendingLanguage(detailsRow, book.book_original_language);
    appendPendingMetaItem(detailsRow, 'calendar-days', book.book_year_published ? String(book.book_year_published) : '');
    appendPendingMetaItem(detailsRow, 'tag', book.book_genre ? Utils.formatGenre(book.book_genre) : '');
    meta.appendChild(detailsRow);

    const applicantRow = buildPendingMetaRow();
    appendPendingMetaItem(applicantRow, 'user', composePendingApplicant(book));
    appendPendingMetaItem(applicantRow, 'calendar', book.time_created ? Utils.formatDate(book.time_created) : '');
    meta.appendChild(applicantRow);
    body.appendChild(meta);

    card.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'pending-card-actions';
    actions.appendChild(buildActionButton('Одобрить', 'btn btn-primary btn-sm', 'check', function () {
        handleApproveBook(book.id);
    }));
    actions.appendChild(buildActionButton('Отклонить', 'btn btn-danger-ghost btn-sm', 'x', function () {
        handleRejectBook(book.id);
    }));
    card.appendChild(actions);

    return card;
}

//  5. РЕНДЕРИНГ — ИЗДАНИЯ  //

function renderEditionsList(payload, catalogPayload) {
    const container = Utils.getElement('moderation-list');
    if (!container) return;
    Utils.clearChildren(container);

    const queueSection = buildModerationSection(
        'Очередь на модерацию',
        payload ? payload.total_count : 0
    );
    container.appendChild(queueSection.section);

    const items = (payload && payload.items) || [];
    if (items.length === 0) {
        queueSection.body.appendChild(renderEmptyState({
            message: 'Очередь изданий пуста',
            iconName: 'layers',
            subtitle: 'Все издания одобрены',
        }));
    } else {
        items.forEach(function (edition) {
            queueSection.body.appendChild(renderPendingEditionCardComponent(edition, {
                onApprove: function (e) { handleApproveEdition(e.id); },
                onReject:  function (e) { handleRejectEdition(e.id); },
            }));
        });
    }

    const catalogPayloadData = catalogPayload || pageState.editionCatalog.payload;
    container.appendChild(buildEditionCatalogSection(catalogPayloadData));
    container.appendChild(buildCatalogPagination('edition', catalogPayloadData));

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  6. РЕНДЕРИНГ — КАТАЛОГ  //

function buildBookCatalogSection(payload) {
    const section = document.createElement('section');
    section.className = 'content-section admin-catalog-section';

    section.appendChild(buildCatalogHeader('Каталог книг', payload ? payload.total_count : 0));
    section.appendChild(buildBookCatalogFilters());

    const list = document.createElement('div');
    list.id = 'book-catalog-list';
    list.className = 'catalog-list';
    section.appendChild(list);
    renderBookCatalogItems(list, payload);

    return section;
}

function buildEditionCatalogSection(payload) {
    const section = document.createElement('section');
    section.className = 'content-section admin-catalog-section';

    section.appendChild(buildCatalogHeader('Каталог изданий', payload ? payload.total_count : 0));
    section.appendChild(buildEditionCatalogFilters());

    const list = document.createElement('div');
    list.id = 'edition-catalog-list';
    list.className = 'catalog-list';
    section.appendChild(list);
    renderEditionCatalogItems(list, payload);

    return section;
}

function buildCatalogHeader(titleText, count) {
    const header = document.createElement('div');
    header.className = 'section-header';

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = titleText;

    const tag = document.createElement('span');
    tag.className = 'tag tag-muted';
    tag.textContent = String(count || 0);
    title.appendChild(tag);
    header.appendChild(title);

    return header;
}

function buildBookCatalogFilters() {
    const filters = document.createElement('div');
    filters.className = 'filters-bar';

    filters.appendChild(buildCatalogSearchInput(
        pageState.bookCatalog.query,
        'Поиск по названию или автору...',
        function (value) {
            pageState.bookCatalog.query = value.trim();
            pageState.bookCatalog.page = PAGINATION_DEFAULT_PAGE;
            reloadBookCatalog();
        }
    ));
    filters.appendChild(buildStatusSelect(
        pageState.bookCatalog.moderationStatus,
        BOOK_MODERATION_STATUS_LABELS,
        function (value) {
            pageState.bookCatalog.moderationStatus = value;
            pageState.bookCatalog.page = PAGINATION_DEFAULT_PAGE;
            reloadBookCatalog();
        }
    ));

    return filters;
}

function buildEditionCatalogFilters() {
    const filters = document.createElement('div');
    filters.className = 'filters-bar';

    filters.appendChild(buildCatalogSearchInput(
        pageState.editionCatalog.query,
        'Поиск по книге, автору, издателю или ISBN...',
        function (value) {
            pageState.editionCatalog.query = value.trim();
            pageState.editionCatalog.page = PAGINATION_DEFAULT_PAGE;
            reloadEditionCatalog();
        }
    ));
    filters.appendChild(buildStatusSelect(
        pageState.editionCatalog.moderationStatus,
        EDITION_MODERATION_STATUS_LABELS,
        function (value) {
            pageState.editionCatalog.moderationStatus = value;
            pageState.editionCatalog.page = PAGINATION_DEFAULT_PAGE;
            reloadEditionCatalog();
        }
    ));
    filters.appendChild(buildEditionTypeSelect());

    return filters;
}

function renderBookCatalogItems(container, payload) {
    container.replaceChildren();
    const items = (payload && payload.items) || [];

    if (items.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Книги не найдены',
            iconName: 'book-x',
            subtitle: 'Попробуйте изменить фильтры каталога',
        }));
        return;
    }

    items.forEach(function (book) {
        container.appendChild(buildBookCatalogItem(book));
    });
}

function renderEditionCatalogItems(container, payload) {
    container.replaceChildren();
    const items = (payload && payload.items) || [];

    if (items.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Издания не найдены',
            iconName: 'layers',
            subtitle: 'Попробуйте изменить фильтры каталога',
        }));
        return;
    }

    items.forEach(function (edition) {
        container.appendChild(buildEditionCatalogItem(edition));
    });
}

function buildBookCatalogItem(book) {
    const item = buildCatalogBaseItem('book-open');
    item.info.appendChild(buildCatalogTitle(book.book_title, 'Без названия', PAGE_URL.BOOK + '?id=' + book.id));
    item.info.appendChild(buildCatalogSubtitle(book.book_author, 'Автор не указан'));
    item.status.appendChild(buildModerationTag(book.book_moderation_status, BOOK_MODERATION_STATUS_LABELS));
    return item.root;
}

function buildEditionCatalogItem(edition) {
    const item = buildCatalogBaseItem('layers');
    item.info.appendChild(buildCatalogTitle(edition.book_title, 'Без названия', PAGE_URL.BOOK + '?id=' + edition.book_id));
    item.info.appendChild(buildCatalogSubtitle(edition.book_author, 'Автор не указан'));

    const meta = document.createElement('div');
    meta.className = 'catalog-item-meta';
    if (edition.edition_language) appendInline(meta, String(edition.edition_language).toUpperCase());
    if (edition.edition_type) appendInline(meta, EDITION_TYPE_LABELS[edition.edition_type] || edition.edition_type);
    if (edition.edition_publisher) appendInline(meta, edition.edition_publisher);
    item.info.appendChild(meta);

    item.status.appendChild(buildModerationTag(edition.edition_moderation_status, EDITION_MODERATION_STATUS_LABELS));
    return item.root;
}

//  7. РЕНДЕРИНГ — ДУБЛИКАТЫ  //

function renderDuplicatesList(payload) {
    const container = Utils.getElement('moderation-list');
    if (!container) return;
    Utils.clearChildren(container);
    pageState.duplicatePayload = payload;

    const items = (payload && payload.items) || [];
    if (items.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Возможные дубликаты не найдены',
            iconName: 'copy',
            subtitle: 'В каталоге нет произведений с одинаковыми названиями',
        }));
        return;
    }

    items.forEach(function (group) {
        container.appendChild(buildDuplicateGroup(group));
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function buildDuplicateGroup(group) {
    const section = document.createElement('article');
    section.className = 'duplicate-group';

    const candidates = group.candidates || [];
    const currentMasterId = pageState.duplicateMasters[group.group_id];
    const hasCurrentMaster = candidates.some(function (candidate) {
        return candidate.id === currentMasterId;
    });
    if (!hasCurrentMaster && candidates.length > 0) {
        pageState.duplicateMasters[group.group_id] = getDefaultDuplicateMaster(candidates).id;
    }

    const header = document.createElement('header');
    header.className = 'duplicate-group-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'duplicate-group-title';
    Utils.setSafeText(title, group.book_title, { fallback: 'Похожие произведения' });
    titleWrap.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'duplicate-group-meta';
    meta.textContent = 'Кандидатов: ' + candidates.length;
    titleWrap.appendChild(meta);
    header.appendChild(titleWrap);
    section.appendChild(header);

    const list = document.createElement('div');
    list.className = 'duplicate-candidates';
    candidates.forEach(function (candidate) {
        list.appendChild(buildDuplicateCandidate(group, candidate));
    });
    section.appendChild(list);

    return section;
}

function getDefaultDuplicateMaster(candidates) {
    return candidates.find(function (candidate) {
        return candidate.book_moderation_status === BOOK_MODERATION_STATUS.APPROVED;
    }) || candidates[0];
}

function buildDuplicateCandidate(group, candidate) {
    const currentMasterId = pageState.duplicateMasters[group.group_id];
    const isMaster = candidate.id === currentMasterId;

    const row = document.createElement('div');
    row.className = 'duplicate-candidate';
    if (isMaster) row.classList.add('is-selected');

    const body = document.createElement('div');
    body.className = 'duplicate-candidate-body';

    const title = document.createElement('a');
    title.className = 'duplicate-candidate-title';
    title.href = PAGE_URL.BOOK + '?id=' + candidate.id;
    Utils.setSafeText(title, candidate.book_title, { fallback: 'Без названия' });
    body.appendChild(title);

    const author = document.createElement('div');
    author.className = 'duplicate-candidate-author';
    Utils.setSafeText(author, candidate.book_author, { fallback: 'Автор не указан' });
    body.appendChild(author);

    const meta = document.createElement('div');
    meta.className = 'duplicate-candidate-meta';
    appendInline(meta, 'ID ' + candidate.id);
    appendInline(meta, BOOK_MODERATION_STATUS_LABELS[candidate.book_moderation_status]
        || candidate.book_moderation_status);
    appendInline(meta, 'изданий: ' + candidate.edition_count);
    if (candidate.book_year_published) appendInline(meta, String(candidate.book_year_published));
    if (candidate.user_email) appendInline(meta, 'от ' + candidate.user_email);
    body.appendChild(meta);
    row.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'duplicate-candidate-actions';
    if (isMaster) {
        actions.appendChild(buildDuplicateMasterTag());
    } else {
        actions.appendChild(buildActionButton('Сделать основной', 'btn btn-ghost btn-sm', 'check-circle', function () {
            pageState.duplicateMasters[group.group_id] = candidate.id;
            renderDuplicatesList(pageState.duplicatePayload);
        }));
        actions.appendChild(buildActionButton('Объединить с основной', 'btn btn-primary btn-sm', 'merge', function () {
            handleMergeDuplicate(candidate.id, pageState.duplicateMasters[group.group_id]);
        }));
    }
    row.appendChild(actions);

    return row;
}

function buildDuplicateMasterTag() {
    const tag = document.createElement('span');
    tag.className = 'tag tag-primary duplicate-master-tag';
    tag.textContent = 'Основная запись';
    return tag;
}

//  8. ПАГИНАЦИЯ  //

function renderPaginationBlock(payload) {
    const container = Utils.getElement('moderation-pagination');
    if (!container) return;
    Utils.clearChildren(container);

    const totalPages = (payload && payload.total_pages) || 0;
    if (!totalPages || totalPages <= 1) return;

    container.appendChild(renderPagination({
        currentPage: payload.page || pageState.page,
        totalPages: totalPages,
        onPageChange: function (newPage) {
            pageState.page = newPage;
            loadCurrentTab();
        },
        options: {
            totalCount: payload.total_count,
            perPage: payload.per_page,
        },
    }));
}

function buildCatalogPagination(catalogType, payload) {
    const container = document.createElement('div');
    container.id = catalogType + '-catalog-pagination';
    container.className = 'catalog-pagination';
    renderCatalogPagination(container, catalogType, payload);
    return container;
}

function renderCatalogPagination(container, catalogType, payload) {
    if (!container) return;
    Utils.clearChildren(container);

    const totalPages = (payload && payload.total_pages) || 0;
    if (!totalPages || totalPages <= 1) return;

    const state = catalogType === 'edition' ? pageState.editionCatalog : pageState.bookCatalog;
    const label = catalogType === 'edition' ? 'изданий' : 'книг';

    container.appendChild(renderPagination({
        currentPage: payload.page || state.page,
        totalPages: totalPages,
        onPageChange: function (newPage) {
            state.page = newPage;
            if (catalogType === 'edition') {
                reloadEditionCatalog(true);
            } else {
                reloadBookCatalog(true);
            }
        },
        options: {
            totalCount: payload.total_count,
            perPage: payload.per_page,
            label: label,
        },
    }));
}

//  9. ОБРАБОТЧИКИ  //

function setupEventListeners() {
    document.querySelectorAll('[data-tab]').forEach(function (tabEl) {
        tabEl.addEventListener('click', function () {
            const target = tabEl.dataset.tab;
            if (target !== TAB.BOOKS && target !== TAB.EDITIONS && target !== TAB.DUPLICATES) return;
            pageState.activeTab = target;
            pageState.page = 1;
            document.querySelectorAll('[data-tab]').forEach(function (el) {
                const isActive = el === tabEl;
                el.classList.toggle('is-active', isActive);
                el.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            loadCurrentTab();
        });
    });
}

async function handleApproveBook(bookId) {
    try {
        await AdminService.approveBook(bookId);
        Notification.success('Произведение одобрено');
        await loadCurrentTab();
    } catch (error) {
        Notification.error(error.message);
    }
}

async function handleRejectBook(bookId) {
    try {
        await AdminService.rejectBook(bookId);
        Notification.success('Произведение отклонено');
        await loadCurrentTab();
    } catch (error) {
        Notification.error(error.message);
    }
}

async function handleApproveEdition(editionId) {
    try {
        await AdminService.approveEdition(editionId);
        Notification.success('Издание одобрено');
        await loadCurrentTab();
    } catch (error) {
        Notification.error(error.message);
    }
}

async function handleRejectEdition(editionId) {
    try {
        await AdminService.rejectEdition(editionId);
        Notification.success('Издание отклонено');
        await loadCurrentTab();
    } catch (error) {
        Notification.error(error.message);
    }
}

async function handleMergeDuplicate(sourceBookId, targetBookId) {
    if (!sourceBookId || !targetBookId || sourceBookId === targetBookId) return;

    const confirmed = await AppConfirm.ask({
        title: 'Объединить дубликат',
        message: 'Объединить произведение #' + sourceBookId + ' с основной записью #' + targetBookId + '?',
        confirmLabel: 'Объединить',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await AdminService.mergeBook(sourceBookId, targetBookId);
        Notification.success('Дубликат объединён');
        await loadCurrentTab();
    } catch (error) {
        Notification.error(error.message || 'Не удалось объединить дубликат');
    }
}

async function reloadBookCatalog(shouldScroll) {
    try {
        const payload = await loadBookCatalogPayload();
        const container = Utils.getElement('book-catalog-list');
        if (container) renderBookCatalogItems(container, payload);
        updateCatalogCount(container, payload);
        updateCatalogPagination(container, 'book', payload);
        if (shouldScroll) scrollToCatalogListTop(container);
        refreshLucideIcons();
    } catch (error) {
        Notification.error(error.message || 'Не удалось обновить каталог книг');
    }
}

async function reloadEditionCatalog(shouldScroll) {
    try {
        const payload = await loadEditionCatalogPayload();
        const container = Utils.getElement('edition-catalog-list');
        if (container) renderEditionCatalogItems(container, payload);
        updateCatalogCount(container, payload);
        updateCatalogPagination(container, 'edition', payload);
        if (shouldScroll) scrollToCatalogListTop(container);
        refreshLucideIcons();
    } catch (error) {
        Notification.error(error.message || 'Не удалось обновить каталог изданий');
    }
}

//  10. ХЕЛПЕРЫ  //

function scrollToCatalogListTop(container) {
    const target = container ? container.querySelector('.catalog-item') || container.firstElementChild : null;
    Utils.scrollToElementTop(target || container);
}

function appendInline(parent, text) {
    const span = document.createElement('span');
    span.textContent = text;
    parent.appendChild(span);
}

function buildPendingMetaRow() {
    const row = document.createElement('div');
    row.className = 'pending-card-meta-row';
    return row;
}

function appendPendingMetaItem(parent, iconName, text) {
    const value = Utils.safeText(text, '').trim();
    if (value === '') return;

    const item = document.createElement('span');
    item.className = 'pending-card-meta-item';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    item.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = value;
    item.appendChild(label);

    parent.appendChild(item);
}

function appendPendingLanguage(parent, language) {
    const value = Utils.safeText(language, '').trim();
    if (value === '') return;

    const lang = document.createElement('span');
    lang.className = 'lang-chip';
    lang.textContent = value.toUpperCase();
    parent.appendChild(lang);
}

function composePendingApplicant(entity) {
    return Utils.composeUserName(entity, '', { useEmail: true });
}

function buildModerationSection(titleText, count) {
    const section = document.createElement('section');
    section.className = 'content-section';

    const header = document.createElement('div');
    header.className = 'section-header';

    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = titleText;

    const tag = document.createElement('span');
    tag.className = 'tag tag-warning';
    tag.textContent = String(count || 0);
    title.appendChild(tag);
    header.appendChild(title);
    section.appendChild(header);

    const body = document.createElement('div');
    body.className = 'pending-list';
    section.appendChild(body);

    return { section: section, body: body };
}

function buildCatalogSearchInput(value, placeholder, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'search-input-wrap';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'search');
    wrap.appendChild(icon);

    const input = document.createElement('input');
    input.className = 'form-input';
    input.type = 'text';
    input.value = value || '';
    input.placeholder = placeholder;
    input.addEventListener('input', Utils.debounce(function () {
        onChange(input.value);
    }, CATALOG_SEARCH_DEBOUNCE_MS));
    wrap.appendChild(input);

    return wrap;
}

function buildStatusSelect(value, labels, onChange) {
    const select = document.createElement('select');
    select.className = 'form-input form-select filter-select';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Все статусы';
    select.appendChild(empty);

    Object.entries(labels).forEach(function ([status, label]) {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = label;
        if (value === status) option.selected = true;
        select.appendChild(option);
    });

    select.addEventListener('change', function () {
        onChange(select.value);
    });

    return select;
}

function buildEditionTypeSelect() {
    const select = document.createElement('select');
    select.className = 'form-input form-select filter-select';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Все типы';
    select.appendChild(empty);

    Object.entries(EDITION_TYPE_LABELS).forEach(function ([type, label]) {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = label;
        if (pageState.editionCatalog.type === type) option.selected = true;
        select.appendChild(option);
    });

    select.addEventListener('change', function () {
        pageState.editionCatalog.type = select.value;
        pageState.editionCatalog.page = PAGINATION_DEFAULT_PAGE;
        reloadEditionCatalog();
    });

    return select;
}

function buildCatalogBaseItem(iconName) {
    const root = document.createElement('article');
    root.className = 'catalog-item';

    const cover = document.createElement('div');
    cover.className = 'catalog-item-cover';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    cover.appendChild(icon);
    root.appendChild(cover);

    const info = document.createElement('div');
    info.className = 'catalog-item-info';
    root.appendChild(info);

    const status = document.createElement('div');
    status.className = 'catalog-item-status';
    root.appendChild(status);

    return { root: root, info: info, status: status };
}

function buildCatalogTitle(value, fallback, href) {
    const title = document.createElement('a');
    title.className = 'catalog-item-title';
    title.href = href;
    Utils.setSafeText(title, value, { fallback: fallback });
    return title;
}

function buildCatalogSubtitle(value, fallback) {
    const subtitle = document.createElement('div');
    subtitle.className = 'catalog-item-author';
    Utils.setSafeText(subtitle, value, { fallback: fallback });
    return subtitle;
}

function buildModerationTag(status, labels) {
    const tag = document.createElement('span');
    const className = status === BOOK_MODERATION_STATUS.APPROVED
        ? 'tag-success'
        : status === BOOK_MODERATION_STATUS.REJECTED
            ? 'tag-danger'
            : 'tag-warning';
    tag.className = 'tag ' + className;
    tag.textContent = labels[status] || status || 'Не указан';
    return tag;
}

function updateCatalogCount(container, payload) {
    const section = container ? container.closest('.admin-catalog-section') : null;
    const tag = section ? section.querySelector('.section-title .tag') : null;
    if (tag) tag.textContent = String((payload && payload.total_count) || 0);
}

function updateCatalogPagination(container, catalogType, payload) {
    const pagination = Utils.getElement(catalogType + '-catalog-pagination');
    renderCatalogPagination(pagination, catalogType, payload);
}

function refreshLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function buildActionButton(text, className, iconName, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    if (iconName) {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        btn.appendChild(icon);
    }
    const label = document.createElement('span');
    label.textContent = text;
    btn.appendChild(label);
    btn.addEventListener('click', onClick);
    return btn;
}

//  11. ЗАПУСК  //

function destroy() {}

PageRegistry.register('admin-moderation', {
    init: init,
    destroy: destroy,
});
})();
