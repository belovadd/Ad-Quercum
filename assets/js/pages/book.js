/**
 *  СТРАНИЦА: Произведение — work_header + .editions-grid 
 *
 * НАЗНАЧЕНИЕ:
 *   Загружает карточку произведения, издания, отзывы и заметки, рендерит
 *   пользовательские действия с оценками, коллекциями и таймером чтения.
 *   Основной источник данных: BookService.getBook(bookId) → { book, editions, readers_count }.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ //

const pageState = {
    currentUser: null,
    bookId: null,
    payload: null,
    showAllEditions: false,
    activeNoteFilter: NOTE_FILTER_ALL,
    isEditingRate: false,
    libraries: [],
    reviews: [],
    reviewsTotalCount: 0,
    notes: [],
    notesTotalCount: 0,
    selectedRating: 0,
    pendingActions: new Set(),
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;
    pageState.currentUser = user;
    initNavigation(user);

    pageState.bookId = parseInt(new URLSearchParams(window.location.search).get('id'), 10);
    if (!pageState.bookId) {
        Notification.error('Не указан ID произведения');
        return;
    }

    await loadLibraries();
    await loadBook();
    await Promise.all([loadReviews(), loadNotes()]);
}

//  3. ЗАГРУЗКА  //

async function loadBook() {
    try {
        pageState.payload = await BookService.getBook(pageState.bookId);
        pageState.selectedRating = parseInt(pageState.payload.book.rate_score || 0, 10);
        renderPage();
    } catch (error) {
        Notification.error('Не удалось загрузить произведение: ' + error.message);
    }
}

async function loadReviews() {
    try {
        const data = await BookService.getBookReviews(pageState.bookId, 1);
        pageState.reviews = data.items || [];
        pageState.reviewsTotalCount = data.total_count || 0;
        renderRatesSection();
    } catch (error) {
        pageState.reviews = [];
        pageState.reviewsTotalCount = 0;
        renderRatesSection();
    }
}

async function loadNotes() {
    try {
        const data = await TimerService.listUserNotes({
            book_id: pageState.bookId,
            page: PAGINATION_DEFAULT_PAGE,
            per_page: BOOK_NOTES_PER_PAGE,
        });
        pageState.notes = data.items || [];
        pageState.notesTotalCount = data.total_count || 0;
        renderNotesSection();
    } catch (error) {
        pageState.notes = [];
        pageState.notesTotalCount = 0;
        renderNotesSection();
    }
}

async function loadLibraries() {
    try {
        pageState.libraries = await LibraryService.getUserLibraries() || [];
    } catch (error) {
        // Не критично — кнопка «На полку» просто не сработает
        pageState.libraries = [];
    }
}

//  4. РЕНДЕРИНГ  //

function renderPage() {
    if (!pageState.payload) return;

    renderHeader();
    renderReadingStatusSection();
    renderEditionsGrid();
    renderRatesSection();
    renderNotesSection();

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderHeader() {
    const container = document.getElementById('work-header');
    if (!container) return;

    container.replaceChildren();
    container.appendChild(renderWorkHeaderComponent(pageState.payload, {
        onStartTimer: handleStartTimerFromHeader,
        onAddToCollection: handleAddToCollectionFromHeader,
        onEdit: pageState.payload.book.is_owner ? handleEditBook : null,
        onDelete: pageState.payload.book.is_owner ? handleDeleteBook : null,
    }));
}

function renderReadingStatusSection() {
    const container = document.getElementById('reading-status-row');
    if (!container || !pageState.payload) return;

    container.replaceChildren();

    const book = pageState.payload.book || {};
    const currentStatus = book.book_status || BOOK_STATUS.WANT_TO_READ;

    const wrapper = document.createElement('div');
    wrapper.className = 'status-select-wrapper';

    const tag = document.createElement('span');
    tag.className = 'tag tag-primary reading-status-tag';
    tag.textContent = BOOK_STATUS_LABELS[currentStatus] || 'Хочу прочитать';
    wrapper.appendChild(tag);

    const select = document.createElement('select');
    select.className = 'form-input form-select reading-status-select';
    Object.entries(BOOK_STATUS_LABELS).forEach(function (entry) {
        const option = document.createElement('option');
        option.value = entry[0];
        option.textContent = entry[1];
        option.selected = entry[0] === currentStatus;
        select.appendChild(option);
    });
    wrapper.appendChild(select);

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-primary btn-sm';
    appendBookButtonIcon(saveButton, 'save', 'Сохранить');
    saveButton.addEventListener('click', function () {
        handleSaveReadingStatus(select.value);
    });

    container.appendChild(wrapper);
    container.appendChild(saveButton);
}

function renderEditionsHeader(editions) {
    const countElement = document.getElementById('editions-count');
    if (countElement) {
        const approvedCount = editions.filter(function (edition) {
            return edition.edition_moderation_status === EDITION_MODERATION_STATUS.APPROVED;
        }).length;
        const pendingCount = editions.filter(function (edition) {
            return edition.edition_moderation_status === EDITION_MODERATION_STATUS.PENDING;
        }).length;

        const parts = [approvedCount + ' опубликованных'];
        if (pendingCount > 0) {
            parts.push(pendingCount + ' на модерации');
        }
        countElement.textContent = parts.join(' + ');
    }

    const addButton = document.getElementById('add-edition-button');
    if (addButton) {
        addButton.onclick = handleCreateEdition;
    }
}

function renderEditionsGrid() {
    const container = document.getElementById('editions-grid');
    if (!container) return;

    container.replaceChildren();

    const editions = pageState.payload.editions || [];
    const originalLanguage = pageState.payload.book.book_original_language;
    renderEditionsHeader(editions);

    if (editions.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'Изданий пока нет',
                iconName: 'layers',
                subtitle: 'Добавьте первое издание этого произведения',
            }));
        }
        return;
    }

    const visible = pageState.showAllEditions
        ? editions
        : editions.slice(0, VISIBLE_EDITIONS_LIMIT);

    const grid = document.createElement('div');
    grid.className = 'editions-grid';

    visible.forEach(edition => {
        grid.appendChild(renderEditionCardComponent(edition, originalLanguage, {
            onAddToShelf: handleAddToShelf,
            onRemoveFromShelf: handleRemoveFromShelf,
            onEdit: handleEditEdition,
            onDelete: handleDeleteEdition,
        }));
    });

    container.appendChild(grid);

    if (editions.length > VISIBLE_EDITIONS_LIMIT && !pageState.showAllEditions) {
        const showMore = document.createElement('div');
        showMore.className = 'editions-show-more';

        const showMoreButton = document.createElement('button');
        showMoreButton.type = 'button';
        showMoreButton.className = 'btn btn-outlined btn-sm';
        appendBookButtonIcon(showMoreButton, 'chevron-down', 'Показать ещё ' + (editions.length - VISIBLE_EDITIONS_LIMIT));
        showMoreButton.addEventListener('click', () => {
            pageState.showAllEditions = true;
            renderEditionsGrid();
            if (typeof lucide !== 'undefined') lucide.createIcons();
        });

        showMore.appendChild(showMoreButton);
        container.appendChild(showMore);
    }
}

function renderRatesSection() {
    renderRateFormSection();
    renderReviewsList();

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderRateFormSection() {
    const section = document.getElementById('rate-form-section');
    const container = document.getElementById('rate-form-container');
    if (!section || !container || !pageState.payload) return;

    container.replaceChildren();

    if (hasOwnPublicReview() && !pageState.isEditingRate) {
        section.hidden = true;
        return;
    }

    section.hidden = false;
    container.appendChild(buildRateForm());
}

function renderReviewsList() {
    const container = document.getElementById('rates-list');
    if (!container || !pageState.payload) return;

    container.replaceChildren();
    const reviews = getVisibleReviews();

    if (reviews.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'Рецензий пока нет',
            iconName: 'message-square',
            subtitle: 'Сохраните первую рецензию к этому произведению',
        }));
    } else {
        reviews.forEach(review => {
            container.appendChild(buildReviewCard(review));
        });
    }
}

function renderNotesSection() {
    const container = document.getElementById('notes-list');
    if (!container || !pageState.payload) return;

    renderNotesHeader();
    container.replaceChildren();
    container.appendChild(buildNoteForm());

    const visibleNotes = getFilteredNotes();
    if (visibleNotes.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        container.appendChild(divider);
    }

    if (visibleNotes.length === 0) {
        container.appendChild(renderEmptyState({
            message: pageState.notes.length === 0
                ? 'Заметок по книге пока нет'
                : 'Заметок этого типа пока нет',
            iconName: 'sticky-note',
            subtitle: pageState.notes.length === 0
                ? 'Добавьте цитату, мысль или вопрос к произведению'
                : 'Переключите фильтр или добавьте новую заметку',
        }));
    } else {
        visibleNotes.forEach(note => {
            container.appendChild(renderNoteCard({
                note: adaptReadingNote(note),
                onDelete: handleDeleteNote,
            }));
        });
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderNotesHeader() {
    const countElement = document.getElementById('notes-count');
    if (countElement) {
        countElement.textContent = String(pageState.notesTotalCount || pageState.notes.length);
    }

    const filters = document.querySelectorAll('[data-note-filter]');
    filters.forEach(function (button) {
        const filter = button.dataset.noteFilter || NOTE_FILTER_ALL;
        button.classList.toggle('is-active', filter === pageState.activeNoteFilter);
        button.onclick = function () {
            if (!NOTE_FILTERS.includes(filter)) return;
            pageState.activeNoteFilter = filter;
            renderNotesSection();
        };
    });
}

function getFilteredNotes() {
    if (pageState.activeNoteFilter === NOTE_FILTER_ALL) {
        return pageState.notes;
    }

    return pageState.notes.filter(function (note) {
        return note.note_type === pageState.activeNoteFilter;
    });
}

function getVisibleReviews() {
    const reviews = pageState.reviews.slice();
    const ownIndex = reviews.findIndex(isOwnReview);

    if (ownIndex > -1) {
        const ownReview = reviews.splice(ownIndex, 1)[0];
        return [ownReview].concat(reviews);
    }

    if (hasOwnPublicReview()) {
        return [buildOwnReviewFromBook()].concat(reviews);
    }

    return reviews;
}

function hasOwnPublicReview() {
    const book = pageState.payload?.book || {};
    return Utils.safeText(book.rate_review, '').trim() !== '';
}

function buildRateForm() {
    const book = pageState.payload.book || {};
    const form = document.createElement('div');
    form.className = 'book-rate-form';

    const ratingField = document.createElement('div');
    ratingField.className = 'form-field book-rate-rating-field';
    const ratingLabel = document.createElement('div');
    ratingLabel.className = 'form-label';
    ratingLabel.textContent = 'Оценка';
    ratingField.appendChild(ratingLabel);
    const ratingRow = document.createElement('div');
    ratingRow.className = 'book-rate-row';
    const rating = renderStarRating({
        value: pageState.selectedRating,
        onChange: value => { pageState.selectedRating = value; },
    });
    rating.setAttribute('aria-label', 'Оценка');
    ratingRow.appendChild(rating);
    ratingField.appendChild(ratingRow);
    form.appendChild(ratingField);

    const reviewTextarea = createBookTextareaField(
        'rate-review',
        'Публичная рецензия',
        'Что стоит знать другим читателям?',
        book.rate_review || ''
    );
    form.appendChild(reviewTextarea.field);

    const notesTextarea = createBookTextareaField(
        'rate-notes',
        'Личные заметки',
        'Мысли для себя, они хранятся в вашей оценке',
        book.rate_notes || ''
    );
    form.appendChild(notesTextarea.field);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-primary';
    appendBookButtonIcon(submit, 'save', hasOwnPublicReview() ? 'Сохранить рецензию' : 'Сохранить оценку');
    submit.addEventListener('click', () => handleSaveRate(
        reviewTextarea.input.value,
        notesTextarea.input.value
    ));
    actions.appendChild(submit);
    form.appendChild(actions);

    return form;
}

function buildReviewCard(review) {
    const isCurrentUserReview = isOwnReview(review);
    const card = document.createElement('article');
    card.className = 'pub-card review-card';
    if (isCurrentUserReview) {
        card.classList.add('is-own-review');
    }

    const header = document.createElement('div');
    header.className = 'pub-header';
    header.appendChild(buildReviewerAvatar(review));

    const meta = document.createElement('div');
    meta.className = 'pub-meta';
    const authorRow = document.createElement('div');
    authorRow.className = 'review-card-author-row';

    const author = document.createElement('div');
    author.className = 'pub-author';
    author.textContent = composeReviewerName(review);
    authorRow.appendChild(author);

    if (isCurrentUserReview) {
        const mark = document.createElement('span');
        mark.className = 'review-own-mark';
        mark.textContent = 'Ваша рецензия';
        authorRow.appendChild(mark);
    }
    meta.appendChild(authorRow);

    const date = document.createElement('div');
    date.className = 'pub-date';
    date.textContent = Utils.formatDate(review.time_created);
    meta.appendChild(date);
    header.appendChild(meta);

    if (review.rate_score) {
        const rating = renderStarRating({ value: parseInt(review.rate_score, 10), onChange: null });
        rating.classList.add('review-card-rating');
        header.appendChild(rating);
    }

    card.appendChild(header);

    const text = document.createElement('p');
    text.className = 'pub-text';
    text.textContent = Utils.safeText(review.rate_review, '');
    card.appendChild(text);

    if (isCurrentUserReview) {
        const actions = document.createElement('div');
        actions.className = 'review-card-actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn btn-outlined btn-sm';
        appendBookButtonIcon(editButton, 'pencil', 'Редактировать');
        editButton.addEventListener('click', handleEditOwnRate);
        actions.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-danger-ghost btn-sm';
        appendBookButtonIcon(deleteButton, 'trash-2', 'Удалить');
        deleteButton.addEventListener('click', handleDeleteOwnReview);
        actions.appendChild(deleteButton);

        card.appendChild(actions);
    }

    return card;
}

function buildNoteForm() {
    const form = document.createElement('div');
    form.className = 'note-add-form';

    const title = document.createElement('h3');
    title.className = 'note-form-title';
    const titleIcon = document.createElement('i');
    titleIcon.setAttribute('data-lucide', 'plus-circle');
    title.appendChild(titleIcon);
    title.appendChild(document.createTextNode('Новая заметка'));
    form.appendChild(title);

    const row = document.createElement('div');
    row.className = 'note-add-row';

    const typeField = document.createElement('div');
    typeField.className = 'form-field';
    const typeSelect = document.createElement('select');
    typeSelect.id = 'book-note-type';
    typeSelect.className = 'form-input form-select note-type-select';
    NOTE_TYPE_OPTIONS.forEach(({ value, label }) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        typeSelect.appendChild(option);
    });
    typeField.appendChild(typeSelect);

    const pageField = document.createElement('div');
    pageField.className = 'form-field';
    const pageInput = document.createElement('input');
    pageInput.id = 'book-note-page';
    pageInput.className = 'form-input note-page-input';
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.placeholder = 'Стр.';
    pageField.appendChild(pageInput);

    row.appendChild(pageField);
    row.appendChild(typeField);
    form.appendChild(row);

    const quoteField = createBookTextareaField(
        'book-note-quote',
        '',
        'Цитата из книги (необязательно)',
        ''
    );
    quoteField.input.rows = 2;
    form.appendChild(quoteField.field);

    const textField = createBookTextareaField(
        'book-note-text',
        '',
        'Ваша мысль, наблюдение или вопрос...',
        ''
    );
    textField.input.rows = 3;
    form.appendChild(textField.field);

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-primary btn-sm';
    appendBookButtonIcon(submit, 'plus', 'Добавить заметку');
    submit.addEventListener('click', async () => {
        const isCreated = await handleCreateNote({
            note_type: typeSelect.value,
            note_page: pageInput.value,
            note_quote: quoteField.input.value,
            note_text: textField.input.value,
        });
        if (isCreated) {
            pageInput.value = '';
            quoteField.input.value = '';
            textField.input.value = '';
            typeSelect.value = NOTE_TYPE.QUOTE;
        }
    });
    form.appendChild(submit);

    return form;
}

//  5. ОБРАБОТЧИКИ  //

async function handleSaveReadingStatus(status) {
    await runBookAction('reading-status:' + status, async function () {
        try {
            await BookService.updateStatus(pageState.bookId, status);
            Notification.success('Статус сохранён');
            await loadBook();
        } catch (error) {
            Notification.error(error.message || 'Не удалось сохранить статус');
        }
    });
}

async function handleStartTimerFromHeader() {
    await runBookAction('start-timer:' + pageState.bookId, async function () {
        try {
            await TimerService.startSession(TIMER_DEFAULTS.WORK_DURATION, pageState.bookId, true);
            PageRouter.open(PAGE_URL.TIMER);
        } catch (error) {
            Notification.error(error.message || 'Не удалось запустить таймер');
        }
    });
}

async function handleAddToCollectionFromHeader() {
    const edition = pickHeaderEditionForShelf();

    if (!edition) {
        Notification.info('У произведения пока нет доступных изданий');
        return;
    }

    await openBookCollectionPicker({
        edition: edition,
        getEditionId: getEditionId,
        runAction: runBookAction,
        reload: async function () {
            await loadLibraries();
            await loadBook();
        },
        openModal: openBookModal,
    });
}

function pickHeaderEditionForShelf() {
    const editions = pageState.payload ? (pageState.payload.editions || []) : [];
    const onShelf = editions.find(function (edition) {
        return edition.is_on_shelf;
    });
    const approved = editions.find(function (edition) {
        return edition.edition_moderation_status === EDITION_MODERATION_STATUS.APPROVED;
    });

    return onShelf || approved || editions[0] || null;
}

async function handleAddToShelf(edition) {
    const editionId = getEditionId(edition);
    if (!editionId) {
        Notification.error('Не удалось определить издание');
        return;
    }

    await runBookAction('add-shelf:' + editionId, async function () {
        try {
            await LibraryService.addEditionToShelf(editionId);
            Notification.success('Издание добавлено в библиотеку');
            await loadBook();
        } catch (error) {
            Notification.error(error.message || 'Не удалось добавить издание на полку');
        }
    });
}

async function handleRemoveFromShelf(edition) {
    const editionId = getEditionId(edition);

    if (!editionId) {
        Notification.error('Не удалось определить издание');
        return;
    }

    await runBookAction('remove-shelf:' + editionId, async function () {
        try {
            await LibraryService.removeEditionFromShelf(editionId);
            Notification.success('Издание снято с полки');
            await loadBook();
        } catch (error) {
            Notification.error(error.message || 'Не удалось снять издание с полки');
        }
    });
}

async function handleCreateEdition() {
    const form = renderEditionFormComponent({});

    openBookModal('Добавить издание', form.element, async () => {
        const errors = form.validate();
        if (errors.length) {
            Notification.error(errors.join('; '));
            return false;
        }

        const result = await BookService.createEdition(pageState.bookId, form.getData());
        const coverFile = form.getCoverFile();
        const editionId = getEditionId(result.edition || result);

        if (coverFile && editionId) {
            await BookService.uploadEditionCover(editionId, coverFile);
        }

        Notification.success('Издание добавлено');
        await loadBook();
        return true;
    });
}

async function handleEditBook() {
    const form = renderBookCreateFormComponent({
        initial: pageState.payload.book,
    });

    openBookModal('Редактировать произведение', form.element, async () => {
        const errors = form.validate();
        if (errors.length) {
            Notification.error(errors.join('; '));
            return false;
        }

        await BookService.updateBook(pageState.bookId, form.getData());
        Notification.success('Произведение обновлено');
        await loadBook();
        return true;
    });
}

async function handleDeleteBook() {
    await runBookAction('delete-book:' + pageState.bookId, async function () {
        const confirmed = await AppConfirm.ask({
            title: 'Удалить произведение',
            message: 'Удалить произведение со всеми изданиями? Это необратимо.',
            confirmLabel: 'Удалить',
            isDanger: true,
        });
        if (!confirmed) return;

        try {
            await BookService.deleteBook(pageState.bookId);
            Notification.success('Произведение удалено');
            PageRouter.open(PAGE_URL.LIBRARY);
        } catch (error) {
            Notification.error(error.message);
        }
    });
}

async function handleEditEdition(edition) {
    const editionId = getEditionId(edition);
    if (!editionId) {
        Notification.error('Не удалось определить издание');
        return;
    }

    const form = renderEditionFormComponent({
        initial: edition,
    });

    openBookModal('Редактировать издание', form.element, async () => {
        const errors = form.validate();
        if (errors.length) {
            Notification.error(errors.join('; '));
            return false;
        }

        const editionData = form.getData();
        if (form.shouldRemoveCover()) {
            editionData.remove_edition_cover = true;
        }

        await BookService.updateEdition(editionId, editionData);
        const coverFile = form.getCoverFile();
        if (coverFile) {
            await BookService.uploadEditionCover(editionId, coverFile);
        }
        Notification.success('Издание обновлено');
        await loadBook();
        return true;
    });
}

async function handleDeleteEdition(edition) {
    const editionId = getEditionId(edition);
    if (!editionId) {
        Notification.error('Не удалось определить издание');
        return;
    }

    await runBookAction('delete-edition:' + editionId, async function () {
        const confirmed = await AppConfirm.ask({
            title: 'Удалить издание',
            message: 'Удалить это издание?',
            confirmLabel: 'Удалить',
            isDanger: true,
        });
        if (!confirmed) return;

        try {
            await BookService.deleteEdition(editionId);
            Notification.success('Издание удалено');
            await loadBook();
        } catch (error) {
            Notification.error(error.message);
        }
    });
}

function getEditionId(edition) {
    const editionId = parseInt(edition?.edition_id || edition?.id, 10);
    return Number.isNaN(editionId) ? null : editionId;
}

async function handleSaveRate(reviewValue, notesValue) {
    await runBookAction('save-rate:' + pageState.bookId, async function () {
        try {
            await BookService.rate(pageState.bookId, {
                rate_score: pageState.selectedRating || null,
                rate_review: reviewValue.trim() || null,
                rate_notes: notesValue.trim() || null,
            });
            pageState.isEditingRate = false;
            Notification.success('Оценка сохранена');
            await loadBook();
            await loadReviews();
        } catch (error) {
            Notification.error(error.message || 'Не удалось сохранить оценку');
        }
    });
}

function handleEditOwnRate() {
    pageState.isEditingRate = true;
    renderRatesSection();

    window.requestAnimationFrame(function () {
        const section = document.getElementById('rate-form-section');
        if (!section) return;

        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const reviewInput = document.getElementById('rate-review');
        if (reviewInput) {
            reviewInput.focus();
        }
    });
}

async function handleDeleteOwnReview() {
    await runBookAction('delete-review:' + pageState.bookId, async function () {
        const isConfirmed = await AppConfirm.ask({
            title: 'Удалить рецензию',
            message: 'Удалить вашу рецензию? Оценка и личные заметки сохранятся.',
            confirmLabel: 'Удалить',
            isDanger: true,
        });
        if (!isConfirmed) return;

        try {
            await BookService.deleteReview(pageState.bookId);
            pageState.isEditingRate = false;
            Notification.success('Рецензия удалена');
            await loadBook();
            await loadReviews();
        } catch (error) {
            Notification.error(error.message || 'Не удалось удалить рецензию');
        }
    });
}

async function handleCreateNote(noteData) {
    const noteType = noteData.note_type || NOTE_TYPE.THOUGHT;
    const quote = noteData.note_quote ? noteData.note_quote.trim() : '';
    let text = noteData.note_text ? noteData.note_text.trim() : '';

    if (noteType === NOTE_TYPE.QUOTE && quote !== '' && text === '') {
        text = quote;
    } else if (quote !== '' && text !== '') {
        text = quote + '\n\n' + text;
    }

    if (!text) {
        Notification.error('Введите текст заметки');
        return false;
    }

    return runBookAction('create-note:' + pageState.bookId, async function () {
        try {
            const page = parseInt(noteData.note_page, 10);
            await TimerService.createNote({
                book_id: pageState.bookId,
                note_type: noteType,
                note_text: text,
                note_page: page > 0 ? page : null,
            });
            Notification.success('Заметка добавлена');
            await loadNotes();
            return true;
        } catch (error) {
            Notification.error(error.message || 'Не удалось добавить заметку');
            return false;
        }
    }, false);
}

async function handleDeleteNote(note) {
    if (!note || !note.note_id) return;

    await runBookAction('delete-note:' + note.note_id, async function () {
        const confirmed = await AppConfirm.ask({
            title: 'Удалить заметку',
            message: 'Удалить заметку?',
            confirmLabel: 'Удалить',
            isDanger: true,
        });
        if (!confirmed) return;

        try {
            await TimerService.deleteNote(note.note_id);
            Notification.success('Заметка удалена');
            await loadNotes();
        } catch (error) {
            Notification.error(error.message || 'Не удалось удалить заметку');
        }
    });
}

//  6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ  //

async function runBookAction(key, action, busyResult = undefined) {
    return await Utils.runPendingAction(pageState.pendingActions, key, action, busyResult);
}

function createBookTextareaField(id, label, placeholder, value) {
    const field = document.createElement('div');
    field.className = 'form-field';

    if (label) {
        const labelElement = document.createElement('label');
        labelElement.className = 'form-label';
        labelElement.htmlFor = id;
        labelElement.textContent = label;
        field.appendChild(labelElement);
    }

    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.className = 'form-input form-textarea';
    textarea.placeholder = placeholder;
    textarea.value = value || '';
    field.appendChild(textarea);

    return { field: field, input: textarea };
}

function buildReviewerAvatar(review) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar pub-avatar';

    const image = document.createElement('img');
    image.src = Utils.getAvatarUrl(review.user_avatar_path);
    image.alt = composeReviewerName(review);
    avatar.appendChild(image);

    return avatar;
}

function isOwnReview(review) {
    const currentUserId = parseInt(pageState.currentUser?.id, 10);
    const reviewerId = parseInt(review?.reviewer_id, 10);
    return !Number.isNaN(currentUserId) && currentUserId === reviewerId;
}

function buildOwnReviewFromBook() {
    const book = pageState.payload?.book || {};
    const user = pageState.currentUser || {};

    return {
        reviewer_id: user.id,
        user_name_first: user.user_name_first,
        user_name_last: user.user_name_last,
        user_avatar_path: user.user_avatar_path,
        rate_score: book.rate_score,
        rate_review: book.rate_review,
        time_created: book.rate_time_created || book.time_updated || '',
    };
}

function composeReviewerName(review) {
    return Utils.composeUserName(review, 'Читатель', { useIdentifier: false });
}

function adaptReadingNote(note) {
    return {
        note_id: note.id || note.note_id,
        note_type: note.note_type,
        note_text: note.note_text,
        note_page: note.note_page,
        time_created: note.time_created,
    };
}

function appendBookButtonIcon(button, iconName, label) {
    Utils.appendIconText(button, iconName, label);
}

function openBookModal(title, contentElement, onSubmit) {
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
    appendBookButtonIcon(saveButton, 'check', 'Сохранить');
    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        try {
            const shouldClose = await onSubmit();
            if (shouldClose) {
                backdrop.remove();
            }
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

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

//  7. ЗАПУСК  //

function destroy() {
    document.querySelectorAll('.modal-backdrop').forEach(function (element) { element.remove(); });
}

PageRegistry.register('book', {
    init: init,
    destroy: destroy,
});
})();
