/**
 *  КОМПОНЕНТ: BookCard — Карточка ИЗДАНИЯ в `.card-grid`
 *
 * НАЗНАЧЕНИЕ:
 * Карточка одного **издания** (а не абстрактного произведения) в библиотечной
 * сетке. Источник данных — записи из `LibraryService.searchUserLibrary` или
 * `LibraryRepository.find_library_books`: одна строка содержит и поля
 * произведения (book_title, book_author, ...), и поля издания
 * (edition_id, edition_language, edition_cover_path, edition_type, ...).
 */

function renderBookCard(item) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.editionId = item.edition_id;
    if (item.book_id) card.dataset.bookId = item.book_id;

    // Cover
    const cover = document.createElement('div');
    cover.className = 'card-cover';
    cover.appendChild(Utils.createImage(
        item.edition_cover_path,
        item?.book_title,
        DEFAULT_BOOK_COVER_URL
    ));
    card.appendChild(cover);

    // Body
    const body = document.createElement('div');
    body.className = 'card-body';

    // Top row: lang-chip + type icon
    const topRow = document.createElement('div');
    topRow.className = 'card-top-row';

    if (item.edition_language) {
        const langChip = document.createElement('span');
        langChip.className = 'lang-chip';
        langChip.textContent = item.edition_language.toUpperCase();
        topRow.appendChild(langChip);
    }

    if (item.edition_type) {
        const typeIcon = document.createElement('span');
        typeIcon.className = 'edition-type-icon';
        const typeLabel = EDITION_TYPE_LABELS[item.edition_type] || item.edition_type;
        typeIcon.title = typeLabel;
        const i = document.createElement('i');
        i.setAttribute('data-lucide', EDITION_TYPE_ICONS[item.edition_type] || 'book');
        typeIcon.appendChild(i);
        const label = document.createElement('span');
        label.textContent = typeLabel;
        typeIcon.appendChild(label);
        topRow.appendChild(typeIcon);
    }

    body.appendChild(topRow);

    // Title
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = Utils.safeText(item?.book_title, 'Без названия');
    body.appendChild(title);

    // Author
    const author = document.createElement('div');
    author.className = 'card-subtitle';
    author.textContent = Utils.safeText(item?.book_author, 'Автор не указан');
    body.appendChild(author);

    // Мета: статус модерации + статус прочтения + рейтинг
    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const statusRow = document.createElement('div');
    statusRow.className = 'card-status-row';

    if (item.edition_moderation_status === EDITION_MODERATION_STATUS.PENDING) {
        statusRow.appendChild(buildModerationIconBadge());
    }

    if (item.book_status) {
        const tag = document.createElement('span');
        tag.className = 'card-tag ' + bookStatusToTagClass(item.book_status);
        tag.textContent = BOOK_STATUS_LABELS[item.book_status] || item.book_status;
        statusRow.appendChild(tag);
    }

    if (statusRow.children.length > 0) {
        meta.appendChild(statusRow);
    }

    if (item.rate_score) {
        const rating = document.createElement('span');
        rating.className = 'card-stars';
        const score = Math.max(0, Math.min(5, Number(item.rate_score) || 0));
        rating.textContent = '★'.repeat(score) + '☆'.repeat(5 - score);
        meta.appendChild(rating);
    }

    body.appendChild(meta);
    card.appendChild(body);

    // Клик → страница произведения
    if (item.book_id) {
        card.classList.add('is-clickable');
        card.addEventListener('click', () => {
            PageRouter.open(PAGE_URL.BOOK + '?id=' + item.book_id);
        });
    }

    return card;
}

function buildModerationIconBadge() {
    const badge = document.createElement('span');
    badge.className = 'moderation-icon-badge';
    badge.title = 'На модерации';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'hourglass');
    badge.appendChild(icon);
    return badge;
}

function bookStatusToTagClass(status) {
    if (status === BOOK_STATUS.READING) return 'card-tag-reading';
    if (status === BOOK_STATUS.WANT_TO_READ) return 'card-tag-planned';
    if (status === BOOK_STATUS.FINISHED) return 'card-tag-finished';
    return 'card-tag-finished';
}
