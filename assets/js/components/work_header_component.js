/**
 * КОМПОНЕНТ: WorkHeader — Шапка произведения (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 * Шапка `.work-header` для page-book: обложка слева (с фолбэком: издание на
 * полке пользователя → первое approved → placeholder), мета-инфо и действия справа.
 * Раскладка соответствует шаблону Modern Botanical
 * (см. `!etc/design/modern-botanical/components.html` § 20 WORK HEADER).
 */

//  1. РЕНДЕРИНГ ШАПКИ  //

function renderWorkHeaderComponent(payload, callbacks) {
    const cb = callbacks || {};
    const book = payload.book || {};
    const editions = payload.editions || [];

    const root = document.createElement('header');
    root.className = 'work-header';

    root.appendChild(buildWorkCoverColumn(book, editions));
    root.appendChild(buildWorkInfoColumn(book, editions, payload.readers_count, cb));

    return root;
}

//  2. КОЛОНКА ОБЛОЖКИ  //

function buildWorkCoverColumn(book, editions) {
    const column = document.createElement('div');

    const coverWrap = document.createElement('div');
    coverWrap.className = 'work-cover';

    const shelfEdition = pickShelfEdition(editions);
    const coverPath = pickCoverPath(editions, shelfEdition);

    coverWrap.appendChild(Utils.createImage(
        coverPath,
        book?.book_title,
        DEFAULT_BOOK_COVER_URL
    ));

    column.appendChild(coverWrap);

    if (shelfEdition) {
        const caption = document.createElement('div');
        caption.className = 'work-cover-caption';
        const parts = ['Ваше издание'];
        if (shelfEdition.edition_publisher) parts.push(shelfEdition.edition_publisher);
        caption.textContent = parts.join(' · ');
        column.appendChild(caption);
    }

    return column;
}

//  3. КОЛОНКА ИНФОРМАЦИИ  //

function buildWorkInfoColumn(book, editions, readersCount, cb) {
    const info = document.createElement('div');
    info.className = 'work-info';

    const title = document.createElement('h1');
    title.className = 'work-title';
    title.textContent = Utils.safeText(book?.book_title, 'Без названия');
    info.appendChild(title);

    const author = document.createElement('div');
    author.className = 'work-author';
    author.textContent = Utils.safeText(book?.book_author, 'Автор не указан');
    info.appendChild(author);

    info.appendChild(buildWorkMetaRow(book, editions, readersCount));

    if (book.book_description) {
        const desc = document.createElement('p');
        desc.className = 'work-description';
        desc.textContent = book.book_description;
        info.appendChild(desc);
    }

    info.appendChild(buildWorkActions(book, cb));

    return info;
}

function buildWorkMetaRow(book, editions, readersCount) {
    const metaRow = document.createElement('div');
    metaRow.className = 'work-meta-row';

    if (book.book_genre) {
        const tag = document.createElement('span');
        tag.className = 'tag tag-secondary work-genre-tag';
        tag.textContent = Utils.formatGenre(book.book_genre);
        metaRow.appendChild(tag);
    }

    if (book.book_year_published) {
        metaRow.appendChild(makeWorkMetaItem('calendar', String(book.book_year_published)));
    }

    metaRow.appendChild(makeWorkMetaItem('layers', editions.length + ' изданий'));

    const readers = (typeof readersCount === 'number') ? readersCount : 0;
    metaRow.appendChild(makeWorkMetaItem('users', readers + ' читателей'));

    return metaRow;
}

function buildWorkActions(book, cb) {
    const actions = document.createElement('div');
    actions.className = 'work-actions';

    if (cb.onStartTimer) {
        actions.appendChild(makeWorkButton('play', 'Запустить таймер', 'btn btn-primary', cb.onStartTimer));
    }
    if (cb.onAddToCollection) {
        actions.appendChild(makeWorkButton('folder-plus', 'В коллекцию', 'btn btn-secondary', cb.onAddToCollection));
    }
    if (book.is_owner && cb.onEdit) {
        actions.appendChild(makeWorkButton('pencil', 'Редактировать', 'btn btn-outlined', cb.onEdit));
    }
    if (book.is_owner && cb.onDelete) {
        actions.appendChild(makeWorkButton('trash-2', 'Удалить', 'btn btn-danger-ghost', cb.onDelete));
    }

    return actions;
}

//  4. ВСПОМОГАТЕЛЬНЫЕ ХЕЛПЕРЫ  //

function pickShelfEdition(editions) {
    return editions.find((e) => e.is_on_shelf) || null;
}

function pickCoverPath(editions, shelfEdition) {
    if (shelfEdition && shelfEdition.edition_cover_path) {
        return shelfEdition.edition_cover_path;
    }
    const approved = editions.find(
        (e) => e.edition_moderation_status === EDITION_MODERATION_STATUS.APPROVED
            && e.edition_cover_path
    );
    return approved ? approved.edition_cover_path : null;
}

function makeWorkMetaItem(iconName, text) {
    const item = document.createElement('span');
    item.className = 'work-meta-item';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    item.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = ' ' + text;
    item.appendChild(span);
    return item;
}

function makeWorkButton(iconName, text, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    btn.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = ' ' + text;
    btn.appendChild(span);
    btn.addEventListener('click', onClick);
    return btn;
}
