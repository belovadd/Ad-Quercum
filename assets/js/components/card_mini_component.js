/**
 * КОМПОНЕНТ: CardMini — Компактная карточка издания 
 *
 * НАЗНАЧЕНИЕ:
 * Компактная карточка для плотных списков — внутри коллекций, в подборках и др.
 * Раскладка соответствует шаблону Modern Botanical
 * (см. `!etc/design/modern-botanical/components.html` § 22 CARD-MINI).
 */

function renderCardMiniComponent(item, callbacks) {
    const cb = callbacks || {};

    const card = document.createElement('article');
    card.className = 'card-mini';
    if (cb.onClick) {
        card.classList.add('is-clickable');
        card.addEventListener('click', (event) => {
            if (event.target.closest('.card-mini-actions')) return;
            cb.onClick(item);
        });
    }

    // Обложка
    const cover = document.createElement('div');
    cover.className = 'card-mini-cover';
    cover.appendChild(Utils.createImage(
        item.edition_cover_path,
        '',
        DEFAULT_BOOK_COVER_URL
    ));
    card.appendChild(cover);

    // Тело
    const body = document.createElement('div');
    body.className = 'card-mini-body';

    // Верхний ряд
    const top = document.createElement('div');
    top.className = 'card-mini-top';

    if (item.edition_language) {
        const lang = document.createElement('span');
        lang.className = 'lang-chip';
        lang.textContent = String(item.edition_language).toUpperCase();
        top.appendChild(lang);
    }

    if (item.edition_type) {
        const typeIcon = document.createElement('span');
        typeIcon.className = 'edition-type-icon';
        const iconName = EDITION_TYPE_ICONS[item.edition_type] || 'book';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        typeIcon.appendChild(icon);
        const span = document.createElement('span');
        span.textContent = ' ' + (EDITION_TYPE_LABELS[item.edition_type] || item.edition_type);
        typeIcon.appendChild(span);
        top.appendChild(typeIcon);
    }

    body.appendChild(top);

    const title = document.createElement('div');
    title.className = 'card-mini-title';
    title.textContent = Utils.safeText(item?.book_title, 'Без названия');
    body.appendChild(title);

    const author = document.createElement('div');
    author.className = 'card-mini-author';
    const authorParts = [];
    if (item.book_author) authorParts.push(item.book_author);
    if (item.edition_publisher) authorParts.push(item.edition_publisher);
    author.textContent = authorParts.length > 0
        ? authorParts.join(' · ')
        : Utils.safeText(item?.book_author, 'Автор не указан');
    body.appendChild(author);

    if (cb.onAdd || cb.onRemove) {
        const actions = document.createElement('div');
        actions.className = 'card-mini-actions';

        if (cb.onAdd) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn btn-primary btn-sm';
            addBtn.title = 'Добавить в коллекцию';
            const addIcon = document.createElement('i');
            addIcon.setAttribute('data-lucide', 'plus');
            addBtn.appendChild(addIcon);
            addBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                cb.onAdd(item);
            });
            actions.appendChild(addBtn);
        }

        if (cb.onRemove) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-ghost btn-sm';
            btn.title = 'Удалить из коллекции';
            const i = document.createElement('i');
            i.setAttribute('data-lucide', 'x');
            btn.appendChild(i);
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                cb.onRemove(item);
            });
            actions.appendChild(btn);
        }
        body.appendChild(actions);
    }

    card.appendChild(body);
    return card;
}
