/**
 *  КОМПОНЕНТ: EditionCard — Карточка издания в .editions-grid 
 *
 * НАЗНАЧЕНИЕ:
 * Карточка одного издания на странице произведения (`book.html`).
 * Поддерживает состояния:
 *   - is-on-shelf — есть на полке пользователя (primary-рамка + bookmark-check)
 *   - is-pending  — собственное pending-издание (пунктир + песочные часы)
 */

// 1. РЕНДЕРИНГ КАРТОЧКИ ИЗДАНИЯ  //

function renderEditionCardComponent(edition, originalLanguage, callbacks) {
    const cb = callbacks || {};
    const editionId = edition.edition_id || edition.id;

    const card = document.createElement('article');
    card.className = 'edition-card';
    if (editionId) card.dataset.editionId = editionId;
    if (edition.is_on_shelf) card.classList.add('is-on-shelf');
    if (edition.is_pending) card.classList.add('is-pending');

    // Метка-уголок «На полке»
    if (edition.is_on_shelf) {
        const mark = document.createElement('div');
        mark.className = 'edition-shelf-mark';
        mark.title = 'На вашей полке';
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'bookmark-check');
        mark.appendChild(i);
        card.appendChild(mark);
    }

    // Обложка
    const coverWrap = document.createElement('div');
    coverWrap.className = 'edition-cover';
    coverWrap.appendChild(Utils.createImage(
        edition.edition_cover_path,
        '',
        DEFAULT_BOOK_COVER_URL
    ));
    card.appendChild(coverWrap);

    // Тело
    const body = document.createElement('div');
    body.className = 'edition-body';

    body.appendChild(buildEditionTopRow(edition));

    if (edition.edition_translator) {
        body.appendChild(buildEditionTranslator(edition, originalLanguage));
    }

    if (edition.edition_pages) {
        const meta = document.createElement('div');
        meta.className = 'edition-meta';
        meta.appendChild(buildEditionMetaItem('layers-2', edition.edition_pages + ' стр.'));
        body.appendChild(meta);
    }

    if (edition.edition_publisher) {
        body.appendChild(buildEditionLine('edition-publisher', 'building-2', edition.edition_publisher));
    }

    if (edition.edition_series) {
        body.appendChild(buildEditionLine('edition-series', 'library', edition.edition_series));
    }

    if (edition.edition_isbn) {
        const isbn = document.createElement('div');
        isbn.className = 'edition-isbn';
        isbn.textContent = 'ISBN ' + edition.edition_isbn;
        body.appendChild(isbn);
    }

    body.appendChild(buildEditionActions(edition, cb));

    card.appendChild(body);

    return card;
}

//  2. ВНУТРЕННИЕ БИЛДЕРЫ  //

function buildEditionTopRow(edition) {
    const row = document.createElement('div');
    row.className = 'edition-top-row';

    if (edition.edition_language) {
        const langChip = document.createElement('span');
        langChip.className = 'lang-chip';
        langChip.textContent = String(edition.edition_language).toUpperCase();
        row.appendChild(langChip);
    }

    if (edition.edition_type) {
        const typeIcon = document.createElement('span');
        typeIcon.className = 'edition-type-icon';
        const iconName = EDITION_TYPE_ICONS[edition.edition_type] || 'book';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        typeIcon.appendChild(icon);
        const label = document.createElement('span');
        label.textContent = EDITION_TYPE_LABELS[edition.edition_type] || edition.edition_type;
        typeIcon.appendChild(label);
        row.appendChild(typeIcon);
    }

    if (edition.is_pending) {
        const badge = document.createElement('span');
        badge.className = 'moderation-icon-badge';
        badge.title = 'На модерации';
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'hourglass');
        badge.appendChild(i);
        row.appendChild(badge);
    }

    return row;
}

function buildEditionTranslator(edition, originalLanguage) {
    const row = document.createElement('div');
    row.className = 'edition-translator';

    const isOriginal = originalLanguage
        && edition.edition_language
        && edition.edition_language === originalLanguage;
    const iconName = isOriginal ? 'feather' : 'languages';

    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', iconName);
    row.appendChild(iconEl);

    const text = document.createElement('span');
    text.textContent = Utils.safeText(edition?.edition_translator, '');
    row.appendChild(text);

    return row;
}

function buildEditionLine(className, iconName, text) {
    const row = document.createElement('div');
    row.className = className;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    row.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = text;
    row.appendChild(span);
    return row;
}

function buildEditionMetaItem(iconName, text) {
    const item = document.createElement('span');
    item.className = 'edition-meta-item';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    item.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = text;
    item.appendChild(span);
    return item;
}

function buildEditionActions(edition, cb) {
    const actions = document.createElement('div');
    actions.className = 'edition-actions';

    const shelfRow = document.createElement('div');
    shelfRow.className = 'edition-action-row edition-action-row-shelf';

    if (edition.is_on_shelf && cb.onRemoveFromShelf) {
        shelfRow.appendChild(makeIconButton(
            'bookmark-x', 'Снять с полки', 'btn btn-ghost btn-sm',
            () => cb.onRemoveFromShelf(edition)
        ));
    } else if (!edition.is_on_shelf && cb.onAddToShelf) {
        shelfRow.appendChild(makeIconButton(
            'bookmark-plus', 'На полку', 'btn btn-outlined btn-sm',
            () => cb.onAddToShelf(edition)
        ));
    }
    if (shelfRow.children.length > 0) {
        actions.appendChild(shelfRow);
    }

    const ownerRow = document.createElement('div');
    ownerRow.className = 'edition-action-row edition-action-row-owner';

    if (edition.is_owner && cb.onEdit) {
        ownerRow.appendChild(makeIconButton(
            'pencil', 'Изменить', 'btn btn-ghost btn-sm',
            () => cb.onEdit(edition)
        ));
    }
    if (edition.is_owner && cb.onDelete) {
        ownerRow.appendChild(makeIconButton(
            'trash-2', 'Удалить', 'btn btn-danger-ghost btn-sm',
            () => cb.onDelete(edition)
        ));
    }
    if (ownerRow.children.length > 0) {
        actions.appendChild(ownerRow);
    }

    return actions;
}

function makeIconButton(iconName, text, className, onClick) {
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
