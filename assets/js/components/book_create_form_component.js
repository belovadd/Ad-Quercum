/**
 *  КОМПОНЕНТ: BookCreateForm — Форма создания произведения
 *
 * НАЗНАЧЕНИЕ:
 * Поля произведения: title, author, genre, year, description.
 * Используется на шаге 1 add-book когда пользователь не нашёл произведение.
 * Не выполняет submit — собирает данные и отдаёт через callback.
 */

function renderBookCreateFormComponent(options) {
    const opts = options || {};
    const initial = opts.initial || {};
    const form = document.createElement('div');
    form.className = 'book-create-form';

    const grid = document.createElement('div');
    grid.className = 'form-grid-2';
    form.appendChild(grid);

    const titleInput = createBookField(grid, 'book_title', 'Название', 'text', {
        required: true,
        maxlength: MAX_BOOK_TITLE_LENGTH,
        placeholder: 'Например, «Над пропастью во ржи»',
        value: opts.initialTitle || initial.book_title || '',
    });

    const authorInput = createBookField(grid, 'book_author', 'Автор', 'text', {
        required: true,
        maxlength: MAX_BOOK_AUTHOR_LENGTH,
        placeholder: 'Например, «Дж. Д. Сэлинджер»',
        value: initial.book_author || '',
    });

    const genreInput = createBookField(grid, 'book_genre', 'Жанр', 'text', {
        maxlength: MAX_BOOK_GENRE_LENGTH,
        placeholder: 'Роман / Повесть / Поэма…',
        value: initial.book_genre || '',
    });

    const yearInput = createBookField(grid, 'book_year_published', 'Год публикации', 'number', {
        min: MIN_BOOK_YEAR_PUBLISHED,
        max: MAX_BOOK_YEAR_PUBLISHED,
        value: initial.book_year_published || '',
        placeholder: '1951',
    });

    const descTextarea = createBookTextarea(form, 'book_description', 'Описание (необязательно)', {
        maxlength: MAX_BOOK_DESCRIPTION_LENGTH,
        placeholder: 'Краткое описание произведения…',
        rows: 3,
        value: initial.book_description || '',
    });

    const inputs = [titleInput, authorInput, genreInput, yearInput, descTextarea];
    if (opts.onChange) {
        inputs.forEach((input) => input.addEventListener('input', () => opts.onChange(getData())));
    }

    function getData() {
        const yearValue = yearInput.value.trim();
        return {
            book_title:             titleInput.value.trim(),
            book_author:            authorInput.value.trim(),
            book_genre:             genreInput.value.trim() || null,
            book_year_published:    yearValue ? parseInt(yearValue, 10) : null,
            book_original_language: null,
            book_description:       descTextarea.value.trim() || null,
        };
    }

    function validate() {
        const errors = [];
        const data = getData();
        if (!data.book_title) errors.push('Укажите название произведения');
        if (!data.book_author) errors.push('Укажите автора');
        return errors;
    }

    return { element: form, getData, validate };
}

function createBookField(parent, name, label, type, attrs) {
    const a = attrs || {};

    const field = document.createElement('div');
    field.className = 'form-field';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = name;
    labelEl.className = 'form-label';
    labelEl.textContent = label + (a.required ? ' *' : '');

    const input = document.createElement('input');
    input.type = type;
    input.id = name;
    input.name = name;
    input.className = 'form-input';
    if (a.required) input.required = true;
    if (a.maxlength) input.maxLength = a.maxlength;
    if (a.min !== undefined) input.min = a.min;
    if (a.max !== undefined) input.max = a.max;
    if (a.placeholder) input.placeholder = a.placeholder;
    if (a.value) input.value = a.value;

    field.appendChild(labelEl);
    field.appendChild(input);
    parent.appendChild(field);

    return input;
}

function createBookTextarea(parent, name, label, attrs) {
    const a = attrs || {};

    const field = document.createElement('div');
    field.className = 'form-field';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = name;
    labelEl.className = 'form-label';
    labelEl.textContent = label;

    const textarea = document.createElement('textarea');
    textarea.id = name;
    textarea.name = name;
    textarea.className = 'form-input form-textarea';
    if (a.maxlength) textarea.maxLength = a.maxlength;
    if (a.placeholder) textarea.placeholder = a.placeholder;
    if (a.rows) textarea.rows = a.rows;
    if (a.value) textarea.value = a.value;

    field.appendChild(labelEl);
    field.appendChild(textarea);
    parent.appendChild(field);

    return textarea;
}
