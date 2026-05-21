/**
 *  КОМПОНЕНТ: EditionForm — Форма создания/редактирования издания 
 *
 * НАЗНАЧЕНИЕ:
 * Поля издания: isbn, language, translator, publisher, series, pages, type.
 * Все поля опциональны (на сервере — book_id и user_id выставляются отдельно).
 */

function renderEditionFormComponent(options) {
    const opts = options || {};
    const initial = opts.initial || {};

    const form = document.createElement('div');
    form.className = 'edition-form';

    const gridTop = document.createElement('div');
    gridTop.className = 'form-grid-3';
    form.appendChild(gridTop);

    const isbnInput = createEditionField(gridTop, 'edition_isbn', 'ISBN', 'text', {
        maxlength: MAX_EDITION_ISBN_LENGTH,
        value: initial.edition_isbn || '',
        placeholder: '978-5-17-090630-7',
    });

    const languageInput = createEditionLanguageSelect(gridTop, initial.edition_language);
    const typeSelect = createEditionTypeSelect(gridTop, initial.edition_type);

    const translatorInput = createEditionField(form, 'edition_translator', 'Переводчик / автор оригинала', 'text', {
        maxlength: MAX_EDITION_TRANSLATOR_LENGTH,
        value: initial.edition_translator || '',
        placeholder: 'Например, «Нора Галь / Льюис Кэрролл»',
        hint: 'Для оригинального издания — ФИО автора произведения. Для перевода — ФИО переводчика.',
    });

    const gridDetails = document.createElement('div');
    gridDetails.className = 'form-grid-2';
    form.appendChild(gridDetails);

    const publisherInput = createEditionField(gridDetails, 'edition_publisher', 'Издатель', 'text', {
        maxlength: MAX_EDITION_PUBLISHER_LENGTH,
        value: initial.edition_publisher || '',
        placeholder: 'Например, «АСТ»',
    });

    const seriesInput = createEditionField(gridDetails, 'edition_series', 'Серия (необязательно)', 'text', {
        maxlength: MAX_EDITION_SERIES_LENGTH,
        value: initial.edition_series || '',
        placeholder: 'Например, «Эксклюзивная классика»',
    });

    const pagesInput = createEditionField(gridDetails, 'edition_pages', 'Количество страниц', 'number', {
        min: MIN_EDITION_PAGES,
        max: MAX_EDITION_PAGES,
        value: initial.edition_pages || '',
        placeholder: '672',
    });

    const coverUpload = createEditionCoverUpload(form, initial.edition_cover_path || null);

    function getData() {
        const pagesValue = pagesInput.value.trim();
        return {
            edition_isbn:       isbnInput.value.trim() || null,
            edition_language:   languageInput.value.trim() || null,
            edition_translator: translatorInput.value.trim() || null,
            edition_publisher:  publisherInput.value.trim() || null,
            edition_series:     seriesInput.value.trim() || null,
            edition_pages:      pagesValue ? parseInt(pagesValue, 10) : null,
            edition_type:       typeSelect.value || null,
        };
    }

    function getCoverFile() {
        return coverUpload.getFile();
    }

    function shouldRemoveCover() {
        return coverUpload.shouldRemove();
    }

    function validate() {
        const errors = [];
        const data = getData();
        if (data.edition_pages !== null
            && (data.edition_pages < MIN_EDITION_PAGES || data.edition_pages > MAX_EDITION_PAGES)) {
            errors.push('Некорректное количество страниц');
        }
        const coverFile = getCoverFile();
        if (coverFile && !ALLOWED_IMAGE_MIME_TYPES.includes(coverFile.type)) {
            errors.push('Обложка должна быть JPG, PNG или WebP');
        }
        if (coverFile && coverFile.size > MAX_UPLOAD_SIZE_BYTES) {
            errors.push('Обложка должна быть не больше 5 МБ');
        }
        return errors;
    }

    return { element: form, getData, getCoverFile, shouldRemoveCover, validate };
}

//  2. ВНУТРЕННИЕ DOM-ХЕЛПЕРЫ  //

function createEditionField(parent, name, label, type, attrs) {
    const a = attrs || {};

    const field = document.createElement('div');
    field.className = 'form-field';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = name;
    labelEl.className = 'form-label';
    labelEl.textContent = label;

    const input = document.createElement('input');
    input.type = type;
    input.id = name;
    input.name = name;
    input.className = 'form-input';
    if (a.maxlength) input.maxLength = a.maxlength;
    if (a.min !== undefined) input.min = a.min;
    if (a.max !== undefined) input.max = a.max;
    if (a.placeholder) input.placeholder = a.placeholder;
    if (a.value) input.value = a.value;

    field.appendChild(labelEl);
    field.appendChild(input);

    if (a.hint) {
        const hint = document.createElement('div');
        hint.className = 'form-hint';
        hint.textContent = a.hint;
        field.appendChild(hint);
    }

    parent.appendChild(field);

    return input;
}

function createEditionLanguageSelect(parent, selectedValue) {
    const field = document.createElement('div');
    field.className = 'form-field';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = 'edition_language';
    labelEl.className = 'form-label';
    labelEl.textContent = 'Язык';

    const select = document.createElement('select');
    select.id = 'edition_language';
    select.name = 'edition_language';
    select.className = 'form-input form-select';

    [
        ['ru', 'Русский'],
        ['en', 'Английский'],
        ['fr', 'Французский'],
        ['de', 'Немецкий'],
        ['ja', 'Японский'],
        ['ko', 'Корейский'],
    ].forEach(function (item) {
        const option = document.createElement('option');
        option.value = item[0];
        option.textContent = item[1];
        if ((selectedValue || 'ru') === item[0]) option.selected = true;
        select.appendChild(option);
    });

    field.appendChild(labelEl);
    field.appendChild(select);
    parent.appendChild(field);

    return select;
}

function createEditionTypeSelect(parent, selectedValue) {
    const field = document.createElement('div');
    field.className = 'form-field';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = 'edition_type';
    labelEl.className = 'form-label';
    labelEl.textContent = 'Тип';

    const select = document.createElement('select');
    select.id = 'edition_type';
    select.name = 'edition_type';
    select.className = 'form-input form-select';

    Object.entries(EDITION_TYPE_LABELS).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if ((selectedValue || EDITION_TYPE.PAPERBACK) === value) option.selected = true;
        select.appendChild(option);
    });

    field.appendChild(labelEl);
    field.appendChild(select);
    parent.appendChild(field);

    return select;
}

function createEditionCoverUpload(parent, initialCoverPath) {
    let selectedFile = null;
    let previewUrl = null;
    let shouldRemoveCurrentCover = false;
    const hasInitialCover = Boolean(initialCoverPath);

    const field = document.createElement('div');
    field.className = 'form-field';

    const labelEl = document.createElement('label');
    labelEl.className = 'form-label';
    labelEl.textContent = 'Обложка (необязательно)';
    field.appendChild(labelEl);

    const upload = document.createElement('div');
    upload.className = 'cover-upload';

    const preview = document.createElement('div');
    preview.className = 'cover-upload-preview';
    upload.appendChild(preview);

    const controls = document.createElement('div');
    controls.className = 'cover-upload-controls';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = ALLOWED_IMAGE_MIME_TYPES.join(',');
    fileInput.className = 'is-hidden';
    controls.appendChild(fileInput);

    const chooseButton = document.createElement('button');
    chooseButton.type = 'button';
    chooseButton.className = 'btn btn-outlined btn-sm';
    appendEditionButtonIcon(chooseButton, 'upload', 'Выбрать файл');
    chooseButton.addEventListener('click', () => fileInput.click());
    controls.appendChild(chooseButton);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn btn-ghost btn-sm is-hidden';
    appendEditionButtonIcon(removeButton, 'x', 'Убрать');
    removeButton.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        shouldRemoveCurrentCover = hasInitialCover;
        renderCoverPreview(null);
    });
    controls.appendChild(removeButton);

    const hint = document.createElement('div');
    hint.className = 'form-hint';
    hint.textContent = 'JPG / PNG / WebP, до 5 МБ. Лучше работает вертикальная обложка около 2:3.';
    controls.appendChild(hint);

    fileInput.addEventListener('change', () => {
        selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (selectedFile) {
            shouldRemoveCurrentCover = false;
        }
        renderCoverPreview(selectedFile);
    });

    upload.appendChild(controls);
    field.appendChild(upload);
    parent.appendChild(field);

    renderCoverPreview(initialCoverPath);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    function renderCoverPreview(source) {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        preview.replaceChildren();

        if (source) {
            const image = document.createElement('img');
            previewUrl = source instanceof File ? URL.createObjectURL(source) : null;
            image.src = previewUrl || source;
            image.alt = 'Обложка издания';
            preview.appendChild(image);
            removeButton.classList.remove('is-hidden');
            return;
        }

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'image-plus');
        preview.appendChild(icon);
        removeButton.classList.add('is-hidden');

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    return {
        getFile: function () {
            return selectedFile;
        },
        shouldRemove: function () {
            return shouldRemoveCurrentCover && selectedFile === null;
        },
    };
}

function appendEditionButtonIcon(button, iconName, label) {
    Utils.appendIconText(button, iconName, label);
}
