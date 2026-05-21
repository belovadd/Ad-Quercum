/**
 *  КОМПОНЕНТ: PendingEditionCard — Карточка заявки в админ-модерации 
 *
 * НАЗНАЧЕНИЕ:
 * Карточка издания в очереди модерации администратора. Показывает обложку, название и
 * автора произведения, мета-данные издания (язык/тип/издатель/ISBN), автора заявки и
 * кнопки «Одобрить» / «Отклонить».
 */

function renderPendingEditionCardComponent(edition, callbacks) {
    const cb = callbacks || {};

    const card = document.createElement('article');
    card.className = 'pending-card';

    card.appendChild(buildPendingCover(edition));
    card.appendChild(buildPendingBody(edition));
    card.appendChild(buildPendingActions(edition, cb));

    return card;
}

function buildPendingCover(edition) {
    const cover = document.createElement('div');
    cover.className = 'pending-card-cover';

    cover.appendChild(Utils.createImage(
        edition.edition_cover_path,
        '',
        DEFAULT_BOOK_COVER_URL
    ));

    return cover;
}

function buildPendingBody(edition) {
    const body = document.createElement('div');
    body.className = 'pending-card-body';

    const title = document.createElement('h3');
    title.className = 'pending-card-title';
    const titleLink = document.createElement('a');
    titleLink.className = 'pending-card-title-link';
    titleLink.href = PAGE_URL.BOOK + '?id=' + edition.book_id;
    titleLink.textContent = Utils.safeText(edition?.book_title, 'Без названия');
    title.appendChild(titleLink);
    appendParentBookStatus(title, edition);
    body.appendChild(title);

    const author = document.createElement('div');
    author.className = 'pending-card-author';
    author.textContent = Utils.safeText(edition?.book_author, 'Автор не указан');
    body.appendChild(author);

    const meta = document.createElement('div');
    meta.className = 'pending-card-meta';

    const detailsRow = makePendingMetaRow();
    appendPendingEditionLanguage(detailsRow, edition.edition_language);
    appendPendingEditionType(detailsRow, edition.edition_type);
    if (edition.edition_pages) {
        detailsRow.appendChild(makePendingMetaItem('file-text', edition.edition_pages + ' стр.'));
    }
    if (edition.edition_isbn) {
        detailsRow.appendChild(makePendingMetaItem('barcode', 'ISBN ' + edition.edition_isbn));
    }
    meta.appendChild(detailsRow);

    const applicantRow = makePendingMetaRow();
    applicantRow.appendChild(makePendingMetaItem('user', composePendingEditionApplicant(edition)));
    if (edition.time_created) {
        applicantRow.appendChild(makePendingMetaItem('calendar', Utils.formatDate(edition.time_created)));
    }

    meta.appendChild(applicantRow);

    body.appendChild(meta);

    return body;
}

function buildPendingActions(edition, cb) {
    const actions = document.createElement('div');
    actions.className = 'pending-card-actions';

    if (cb.onApprove) {
        const approve = document.createElement('button');
        approve.type = 'button';
        approve.className = 'btn btn-primary btn-sm';
        Utils.appendIconText(approve, 'check', 'Одобрить');
        approve.addEventListener('click', () => cb.onApprove(edition));
        actions.appendChild(approve);
    }

    if (cb.onReject) {
        const reject = document.createElement('button');
        reject.type = 'button';
        reject.className = 'btn btn-danger-ghost btn-sm';
        Utils.appendIconText(reject, 'x', 'Отклонить');
        reject.addEventListener('click', () => cb.onReject(edition));
        actions.appendChild(reject);
    }

    return actions;
}

function appendParentBookStatus(parent, edition) {
    if (!edition.book_moderation_status
        || edition.book_moderation_status === BOOK_MODERATION_STATUS.APPROVED) {
        return;
    }

    const warn = document.createElement('span');
    warn.className = 'tag tag-warning';
    warn.textContent = 'Произведение '
        + (BOOK_MODERATION_STATUS_LABELS[edition.book_moderation_status] || edition.book_moderation_status);
    parent.appendChild(warn);
}

function makePendingMetaRow() {
    const row = document.createElement('div');
    row.className = 'pending-card-meta-row';
    return row;
}

function appendPendingEditionLanguage(parent, language) {
    if (!language) return;

    const lang = document.createElement('span');
    lang.className = 'lang-chip';
    lang.textContent = String(language).toUpperCase();
    parent.appendChild(lang);
}

function appendPendingEditionType(parent, type) {
    if (!type) return;

    const typeIcon = document.createElement('span');
    typeIcon.className = 'edition-type-icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', EDITION_TYPE_ICONS[type] || 'book');
    typeIcon.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = ' ' + (EDITION_TYPE_LABELS[type] || type);
    typeIcon.appendChild(span);
    parent.appendChild(typeIcon);
}

function makePendingMetaItem(iconName, text) {
    const span = document.createElement('span');
    span.className = 'pending-card-meta-item';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    span.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = text;
    span.appendChild(label);

    return span;
}

function composePendingEditionApplicant(edition) {
    return Utils.composeUserName(edition, '', { useEmail: true });
}
