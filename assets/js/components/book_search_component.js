/**
 *  КОМПОНЕНТ: BookSearch — Автокомплит произведений (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 * Поле поиска произведений по названию и автору с выпадающим списком (используется на шаге 1 страницы
 * добавления книги). Раскладка соответствует Modern Botanical — `.search-box`
 * (поле + иконка) и `.work-suggestion-list` (список из `.work-suggestion`).
 */

function renderBookSearchComponent(callbacks) {
    const cb = callbacks || {};

    const root = document.createElement('div');
    root.className = 'book-search';

    // Поле ввода
    const searchBox = document.createElement('div');
    searchBox.className = 'search-box';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'search-box-icon';
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', 'search');
    iconWrap.appendChild(iconEl);
    searchBox.appendChild(iconWrap);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'search-box-input';
    input.placeholder = 'Начните вводить название или автора…';
    input.autocomplete = 'off';
    searchBox.appendChild(input);

    root.appendChild(searchBox);

    // Список предложений
    const list = document.createElement('div');
    list.className = 'work-suggestion-list';
    list.hidden = true;
    root.appendChild(list);

    let debounceTimer = null;
    let lastQuery = '';

    input.addEventListener('input', () => {
        const query = input.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
            list.hidden = true;
            list.replaceChildren();
            return;
        }

        debounceTimer = setTimeout(async () => {
            if (query === lastQuery) return;
            lastQuery = query;

            try {
                const response = await BookService.autocomplete(query);
                renderResults(response.items || [], query);
            } catch (error) {
                Notification.error('Ошибка поиска: ' + error.message);
            }
        }, AUTOCOMPLETE_DEBOUNCE_MS);
    });

    function renderResults(items, query) {
        list.replaceChildren();

        items.forEach((book) => {
            list.appendChild(buildSuggestion(book, cb));
        });

        list.appendChild(buildCreateNewSuggestion(items.length === 0, query, cb));

        list.hidden = false;
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    document.addEventListener('click', (event) => {
        if (!root.contains(event.target)) {
            list.hidden = true;
        }
    });

    return root;
}

//  2. ВНУТРЕННИЕ DOM-ХЕЛПЕРЫ  //

function buildSuggestion(book, cb) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'work-suggestion';

    // Обложка / placeholder
    const cover = document.createElement('div');
    cover.className = 'work-suggestion-cover';
    const coverPath = book.sample_cover_path || book.edition_cover_path;
    cover.appendChild(Utils.createImage(coverPath, '', DEFAULT_BOOK_COVER_URL));
    item.appendChild(cover);

    // Тело
    const body = document.createElement('div');
    body.className = 'work-suggestion-body';

    const title = document.createElement('div');
    title.className = 'work-suggestion-title';
    title.textContent = Utils.safeText(book?.book_title, 'Без названия');
    body.appendChild(title);

    const author = document.createElement('div');
    author.className = 'work-suggestion-author';
    author.textContent = composeSuggestionAuthor(book);
    body.appendChild(author);

    if (book.editions_count) {
        const meta = document.createElement('div');
        meta.className = 'work-suggestion-meta';
        const span = document.createElement('span');
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'layers');
        span.appendChild(icon);
        span.appendChild(document.createTextNode(' ' + formatBookSearchEditionCount(book.editions_count)));
        meta.appendChild(span);
        body.appendChild(meta);
    }

    item.appendChild(body);

    item.addEventListener('click', () => {
        if (cb.onSelect) cb.onSelect(book);
    });

    return item;
}

function composeSuggestionAuthor(book) {
    const parts = [Utils.safeText(book?.book_author, 'Автор не указан')];

    if (book.book_year_published) {
        parts.push(String(book.book_year_published));
    }

    if (book.book_genre) {
        parts.push(Utils.formatGenre(book.book_genre));
    }

    return parts.join(' · ');
}

function formatBookSearchEditionCount(count) {
    const value = Number(count) || 0;
    const lastTwo = value % 100;
    const lastOne = value % 10;
    let word = 'изданий';

    if (lastTwo < 11 || lastTwo > 14) {
        if (lastOne === 1) {
            word = 'издание';
        } else if (lastOne >= 2 && lastOne <= 4) {
            word = 'издания';
        }
    }

    return String(value) + ' ' + word;
}

function buildCreateNewSuggestion(empty, query, cb) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'work-suggestion work-suggestion-create';

    const iconBox = document.createElement('div');
    iconBox.className = 'work-suggestion-cover';
    const i = document.createElement('i');
    i.setAttribute('data-lucide', 'plus');
    iconBox.appendChild(i);
    item.appendChild(iconBox);

    const body = document.createElement('div');
    body.className = 'work-suggestion-body';

    const title = document.createElement('div');
    title.className = 'work-suggestion-title';
    title.textContent = empty
        ? 'Создать новое произведение «' + query + '»'
        : 'Не нашли? Создать новое произведение';
    body.appendChild(title);

    item.appendChild(body);

    item.addEventListener('click', () => {
        if (cb.onCreateNew) cb.onCreateNew(query);
    });

    return item;
}
