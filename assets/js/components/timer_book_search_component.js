/**
 *  КОМПОНЕНТ: TimerBookSearch — поиск книги для сессии таймера 
 *
 * НАЗНАЧЕНИЕ:
 * Поисковая привязка книги к сессии чтения. Ищет по полке пользователя:
 * быстрые подсказки берутся из уже загруженных книг, а запрос от двух символов
 * отправляется в `LibraryService.searchUserLibrary()`.
 */

//  1. РЕНДЕРИНГ КОМПОНЕНТА  //

function renderTimerBookSearchComponent(options) {
    const opts = options || {};
    const root = document.createElement('div');
    root.className = 'timer-book-search';

    const searchBox = buildTimerBookSearchBox();
    const input = searchBox.querySelector('input');
    root.appendChild(searchBox);

    const selectedWrap = document.createElement('div');
    selectedWrap.className = 'book-binding-selected';
    root.appendChild(selectedWrap);

    const list = document.createElement('div');
    list.className = 'work-suggestion-list book-binding-results';
    list.hidden = true;
    root.appendChild(list);

    renderTimerBookSelection(selectedWrap, opts.selectedBook, function () {
        clearTimerBookBinding(input, list, selectedWrap, opts);
    });
    bindTimerBookSearchEvents(root, input, list, selectedWrap, opts);

    return root;
}

function buildTimerBookSearchBox() {
    const searchBox = document.createElement('div');
    searchBox.className = 'search-box book-binding-search-box';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'search-box-icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'search');
    iconWrap.appendChild(icon);
    searchBox.appendChild(iconWrap);

    const input = document.createElement('input');
    input.className = 'search-box-input';
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = 'Найти книгу на моей полке…';
    searchBox.appendChild(input);

    return searchBox;
}

//  2. СОБЫТИЯ ПОИСКА  //

function bindTimerBookSearchEvents(root, input, list, selectedWrap, opts) {
    let debounceTimer = null;
    let requestId = 0;
    let selectedBook = opts.selectedBook || null;

    function selectTimerBook(book) {
        requestId++;
        clearTimeout(debounceTimer);
        selectedBook = book;
        input.value = '';
        input.blur();
        hideTimerBookResults(list);
        if (opts.onSelect) opts.onSelect(selectedBook);
        renderTimerBookSelection(selectedWrap, selectedBook, function () {
            selectedBook = null;
            clearTimerBookBinding(input, list, selectedWrap, opts);
        });
    }

    function cancelTimerBookSearch() {
        requestId++;
        clearTimeout(debounceTimer);
        hideTimerBookResults(list);
    }

    input.addEventListener('focus', function () {
        const query = input.value.trim();
        if (query.length === 0) {
            hideTimerBookResults(list);
            return;
        }

        renderTimerBookResults(list, getLocalTimerBookSuggestions(opts.books || [], input.value), input.value, opts, function (book) {
            selectTimerBook(book);
        });
    });

    input.addEventListener('input', function () {
        const query = input.value.trim();
        requestId++;
        clearTimeout(debounceTimer);

        if (query.length === 0) {
            hideTimerBookResults(list);
            return;
        }

        if (query.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
            renderTimerBookResults(list, getLocalTimerBookSuggestions(opts.books || [], query), query, opts, function (book) {
                selectTimerBook(book);
            });
            return;
        }

        const currentRequestId = requestId;
        debounceTimer = setTimeout(async function () {
            try {
                const response = await LibraryService.searchUserLibrary({
                    query: query,
                    page: 1,
                    perPage: AUTOCOMPLETE_MAX_RESULTS,
                });

                if (currentRequestId !== requestId) return;

                renderTimerBookResults(list, response.items || [], query, opts, function (book) {
                    selectTimerBook(book);
                });
            } catch (error) {
                Notification.error('Ошибка поиска книги');
            }
        }, AUTOCOMPLETE_DEBOUNCE_MS);
    });

    input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            cancelTimerBookSearch();
            input.blur();
        }
    });

    root.addEventListener('focusout', function () {
        setTimeout(function () {
            if (!root.contains(document.activeElement)) {
                cancelTimerBookSearch();
            }
        }, UI_FAST_RENDER_DELAY_MS);
    });

    document.addEventListener('pointerdown', function (event) {
        if (!root.contains(event.target)) {
            cancelTimerBookSearch();
        }
    });
}

//  3. РЕЗУЛЬТАТЫ И ЭЛЕМЕНТЫ СПИСКА  //

function renderTimerBookResults(list, books, query, opts, onSelectLocal) {
    const uniqueBooks = dedupeTimerBooks(books);
    const normalizedQuery = query.trim();

    Utils.clearChildren(list);

    if (uniqueBooks.length === 0 && normalizedQuery.length < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
        hideTimerBookResults(list);
        return;
    }

    if (uniqueBooks.length === 0) {
        list.appendChild(buildTimerBookEmptyResult());
    } else {
        uniqueBooks.forEach(function (book) {
            list.appendChild(buildTimerBookSuggestion(book, opts, onSelectLocal));
        });
    }

    list.hidden = false;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function buildTimerBookEmptyResult() {
    const item = document.createElement('div');
    item.className = 'work-suggestion book-binding-empty-result';

    item.appendChild(buildTimerBookIconBox('search-x'));
    item.appendChild(buildTimerBookSuggestionBody('На вашей полке ничего не найдено', ''));

    return item;
}

function buildTimerBookSuggestion(book, opts, onSelectLocal) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'work-suggestion';

    const cover = document.createElement('div');
    cover.className = 'work-suggestion-cover';
    cover.appendChild(Utils.createImage(
        book.edition_cover_path,
        composeTimerBookText(book),
        DEFAULT_BOOK_COVER_URL
    ));
    item.appendChild(cover);
    item.appendChild(buildTimerBookSuggestionBody(
        Utils.safeText(book.book_title, 'Без названия'),
        Utils.safeText(book.book_author, 'Автор не указан')
    ));

    item.addEventListener('click', function () {
        const selectedBook = toTimerSelectedBook(book);
        if (onSelectLocal) {
            onSelectLocal(selectedBook);
        } else if (opts.onSelect) {
            opts.onSelect(selectedBook);
        }
    });

    return item;
}

function buildTimerBookSuggestionBody(title, subtitle) {
    const body = document.createElement('div');
    body.className = 'work-suggestion-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'work-suggestion-title';
    titleEl.textContent = title;
    body.appendChild(titleEl);

    if (subtitle) {
        const subtitleEl = document.createElement('div');
        subtitleEl.className = 'work-suggestion-author';
        subtitleEl.textContent = subtitle;
        body.appendChild(subtitleEl);
    }

    return body;
}

function buildTimerBookIconBox(iconName) {
    const cover = document.createElement('div');
    cover.className = 'work-suggestion-cover book-binding-empty-icon';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    cover.appendChild(icon);
    return cover;
}

//  4. ВЫБОР И СБРОС ПРИВЯЗКИ  //

function renderTimerBookSelection(container, selectedBook, onClear) {
    if (!container) return;

    Utils.clearChildren(container);
    if (!selectedBook) {
        container.hidden = false;
        container.classList.add('is-empty');

        const emptyLabel = document.createElement('span');
        emptyLabel.className = 'book-binding-selected-label';
        emptyLabel.textContent = 'Без привязки к книге';
        container.appendChild(emptyLabel);
        return;
    }

    container.hidden = false;
    container.classList.remove('is-empty');

    const label = document.createElement('span');
    label.className = 'book-binding-selected-label';
    label.textContent = 'Выбрано: ' + selectedBook.text;
    container.appendChild(label);

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'book-binding-clear';
    clearButton.setAttribute('aria-label', 'Сбросить привязку книги');
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'x');
    clearButton.appendChild(icon);
    clearButton.addEventListener('click', onClear);
    container.appendChild(clearButton);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function clearTimerBookBinding(input, list, selectedWrap, opts) {
    if (input) input.value = '';
    hideTimerBookResults(list);
    if (opts.onClear) opts.onClear();
    renderTimerBookSelection(selectedWrap, null);

    if (input) input.focus();
}

function hideTimerBookResults(list) {
    if (!list) return;

    Utils.clearChildren(list);
    list.hidden = true;
}

//  5. ПОИСКОВЫЕ ХЕЛПЕРЫ  //

function getLocalTimerBookSuggestions(books, query) {
    const normalizedQuery = normalizeTimerBookSearchText(query);
    const suggestions = dedupeTimerBooks(books);

    if (!normalizedQuery) {
        return suggestions.slice(0, AUTOCOMPLETE_MAX_RESULTS);
    }

    return suggestions.filter(function (book) {
        return normalizeTimerBookSearchText(composeTimerBookText(book)).includes(normalizedQuery);
    }).slice(0, AUTOCOMPLETE_MAX_RESULTS);
}

function dedupeTimerBooks(books) {
    const seenBookIds = new Set();
    const result = [];

    books.forEach(function (book) {
        if (!book.book_id || seenBookIds.has(Number(book.book_id))) return;
        seenBookIds.add(Number(book.book_id));
        result.push(book);
    });

    return result;
}

function toTimerSelectedBook(book) {
    return {
        id: Number(book.book_id),
        text: composeTimerBookText(book),
        edition_cover_path: book.edition_cover_path || null,
    };
}

function composeTimerBookText(book) {
    return Utils.safeText(book.book_title, 'Без названия')
        + (book.book_author ? ' — ' + book.book_author : '');
}

function normalizeTimerBookSearchText(value) {
    return String(value || '').trim().toLowerCase();
}
