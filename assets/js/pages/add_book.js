/**
 * СТРАНИЦА: Добавление книги — двухшаговый сценарий добавления произведения и издания 
 *
 * НАЗНАЧЕНИЕ:
 *   Управляет двухшаговым сценарием добавления книги: выбор или создание
 *   произведения, заполнение издания, выбор коллекции и отправка результата.
 *   Для нового произведения вызывает BookService.createBook(bookData, editionData, libraryId).
 *   Для существующего произведения вызывает BookService.createEdition(bookId, editionData, libraryId).
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ //

const STEP = { SELECT_BOOK: 1, EDITION_FORM: 2 };

const pageState = {
    step: STEP.SELECT_BOOK,
    selectedBook: null,    // {id, book_title, book_author, ...} — если выбрали из автокомплита
    newBookData: null,     // payload для нового произведения
    libraries: [],
    selectedLibraryId: null,
    bookCreateForm: null,
    editionForm: null,
    isSubmitting: false,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;
    initNavigation(user);

    await loadLibraries();
    renderStep1();
}

async function loadLibraries() {
    try {
        pageState.libraries = await LibraryService.getUserLibraries() || [];
    } catch (error) {
        Notification.error('Ошибка загрузки коллекций: ' + error.message);
        pageState.libraries = [];
    }
}

//  3. ШАГ 1: ВЫБОР ИЛИ СОЗДАНИЕ ПРОИЗВЕДЕНИЯ  //

function renderStep1() {
    pageState.step = STEP.SELECT_BOOK;
    pageState.selectedBook = null;
    pageState.newBookData = null;

    const root = document.getElementById('add-book-root');
    if (!root) return;
    root.replaceChildren();
    root.classList.add('is-awaiting-work');

    renderStepperUI(root);

    const search = renderBookSearchComponent({
        onSelect: book => {
            pageState.selectedBook = book;
            renderStep2();
        },
        onCreateNew: query => {
            pageState.bookCreateForm = renderBookCreateFormComponent({
                initialTitle: query,
            });
            renderCreateFormUnderSearch(root, search);
        },
    });

    const stepBlock = document.createElement('section');
    stepBlock.id = 'add-book-step-work';
    stepBlock.className = 'section-card add-book-step';

    const header = document.createElement('header');
    header.className = 'section-card-header';
    const headerBody = document.createElement('div');

    const title = document.createElement('h2');
    title.className = 'section-card-title';
    title.textContent = 'Произведение';
    headerBody.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'section-card-subtitle';
    hint.textContent = 'Найдите в каталоге или создайте новое';
    headerBody.appendChild(hint);

    header.appendChild(headerBody);
    stepBlock.appendChild(header);

    stepBlock.appendChild(search);
    root.appendChild(stepBlock);
}

function renderCreateFormUnderSearch(root, _search) {
    root.classList.remove('is-awaiting-work');

    // Удаляем предыдущий блок «Создание нового», если был, и добавляем новую форму.
    const existing = document.getElementById('new-book-form-block');
    if (existing) existing.remove();

    const parent = document.getElementById('add-book-step-work') || root;
    const block = document.createElement('div');
    block.id = 'new-book-form-block';
    block.className = 'add-book-create-block';

    const divider = document.createElement('div');
    divider.className = 'or-divider';
    divider.textContent = 'или';
    block.appendChild(divider);

    block.appendChild(buildModerationNotice(
        'Новое произведение пройдёт модерацию. До этого видеть его будете только вы — но сможете сразу читать, оценивать и делать заметки.'
    ));

    block.appendChild(pageState.bookCreateForm.element);

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-primary';
    appendButtonIcon(next, 'arrow-right', 'Далее к изданию');
    next.addEventListener('click', () => {
        const errors = pageState.bookCreateForm.validate();
        if (errors.length) {
            Notification.error(errors.join('; '));
            return;
        }
        pageState.newBookData = pageState.bookCreateForm.getData();
        renderStep2();
    });
    block.appendChild(next);

    parent.appendChild(block);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  4. ШАГ 2: ФОРМА ИЗДАНИЯ + ВЫБОР КОЛЛЕКЦИИ  //

function renderStep2() {
    pageState.step = STEP.EDITION_FORM;

    const root = document.getElementById('add-book-root');
    if (!root) return;
    root.replaceChildren();
    root.classList.remove('is-awaiting-work');

    renderStepperUI(root);

    const work = pageState.selectedBook || pageState.newBookData;
    if (work) {
        const workBlock = document.createElement('section');
        workBlock.className = 'section-card add-book-step';
        workBlock.appendChild(buildSectionHeader(
            'Произведение',
            pageState.selectedBook ? 'Выбрано из каталога' : 'Новое произведение'
        ));
        workBlock.appendChild(buildSelectedWorkSuggestion(work));
        root.appendChild(workBlock);
    }

    // Форма издания
    pageState.editionForm = renderEditionFormComponent();
    const formBlock = document.createElement('section');
    formBlock.className = 'section-card add-book-step';
    formBlock.appendChild(buildSectionHeader(
        'Издание',
        'Конкретное издание выбранного произведения — то, что у вас в руках'
    ));
    formBlock.appendChild(buildModerationNotice(
        'Издание пройдёт модерацию. Вы сразу можете поставить его на полку и использовать с таймером — другим пользователям оно станет видно после одобрения.'
    ));
    formBlock.appendChild(pageState.editionForm.element);

    const libGroup = document.createElement('div');
    libGroup.className = 'form-field';
    const libLabel = document.createElement('label');
    libLabel.htmlFor = 'library-id';
    libLabel.className = 'form-label';
    libLabel.textContent = 'Добавить в коллекцию';
    const libSelect = document.createElement('select');
    libSelect.id = 'library-id';
    libSelect.className = 'form-input form-select';

    const shelfOnlyOption = document.createElement('option');
    shelfOnlyOption.value = '';
    shelfOnlyOption.textContent = 'Не добавлять в коллекцию';
    libSelect.appendChild(shelfOnlyOption);

    pageState.libraries.forEach(lib => {
        const option = document.createElement('option');
        option.value = lib.id;
        option.textContent = lib.library_name;
        libSelect.appendChild(option);
    });
    libGroup.appendChild(libLabel);
    libGroup.appendChild(libSelect);
    formBlock.appendChild(libGroup);

    // Отправка формы
    const actions = document.createElement('div');
    actions.className = 'form-actions';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn btn-ghost';
    back.textContent = 'Назад';
    back.addEventListener('click', renderStep1);
    actions.appendChild(back);

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'btn btn-primary';
    submit.disabled = pageState.isSubmitting;
    appendButtonIcon(submit, 'check', 'Добавить');
    submit.addEventListener('click', () => {
        const libraryId = libSelect.value ? parseInt(libSelect.value, 10) : null;
        handleSubmit(libraryId, submit);
    });
    actions.appendChild(submit);

    formBlock.appendChild(actions);

    root.appendChild(formBlock);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  5. ОТПРАВКА ФОРМЫ  //

async function handleSubmit(libraryId, submitButton = null) {
    if (pageState.isSubmitting) return;

    const editionErrors = pageState.editionForm.validate();
    if (editionErrors.length) {
        Notification.error(editionErrors.join('; '));
        return;
    }

    const editionData = pageState.editionForm.getData();
    const coverFile = pageState.editionForm.getCoverFile();

    if (!pageState.selectedBook && !pageState.newBookData) {
        Notification.error('Не выбрано произведение');
        return;
    }

    pageState.isSubmitting = true;
    if (submitButton) submitButton.disabled = true;

    try {
        let response;
        if (pageState.selectedBook) {
            response = await BookService.createEdition(
                pageState.selectedBook.id, editionData, libraryId
            );
        } else if (pageState.newBookData) {
            response = await BookService.createBook(
                pageState.newBookData, editionData, libraryId
            );
        }

        const editionId = response.edition?.id || response.edition?.edition_id;
        if (coverFile && editionId) {
            try {
                await BookService.uploadEditionCover(editionId, coverFile);
            } catch (coverError) {
                Notification.info('Книга добавлена, но обложку не удалось загрузить: ' + coverError.message);
            }
        }

        Notification.success('Добавлено');
        const bookId = response.book?.id || pageState.selectedBook?.id;
        if (bookId) {
            PageRouter.open(PAGE_URL.BOOK + '?id=' + bookId);
        } else {
            PageRouter.open(PAGE_URL.LIBRARY);
        }
    } catch (error) {
        Notification.error('Не удалось добавить: ' + error.message);
    } finally {
        pageState.isSubmitting = false;
        if (submitButton) submitButton.disabled = false;
    }
}

//  6. ВСПОМОГАТЕЛЬНЫЕ DOM-БЛОКИ  //

function buildSectionHeader(titleText, subtitleText) {
    const header = document.createElement('header');
    header.className = 'section-card-header';

    const body = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'section-card-title';
    title.textContent = titleText;
    body.appendChild(title);

    if (subtitleText) {
        const subtitle = document.createElement('p');
        subtitle.className = 'section-card-subtitle';
        subtitle.textContent = subtitleText;
        body.appendChild(subtitle);
    }

    header.appendChild(body);
    return header;
}

function buildModerationNotice(text) {
    const notice = document.createElement('div');
    notice.className = 'moderation-notice';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'info');
    notice.appendChild(icon);

    const content = document.createElement('span');
    content.textContent = text;
    notice.appendChild(content);

    return notice;
}

function buildSelectedWorkSuggestion(work) {
    const item = document.createElement('div');
    item.className = 'work-suggestion is-selected';

    const cover = document.createElement('div');
    cover.className = 'work-suggestion-cover';
    const coverPath = work.sample_cover_path || work.edition_cover_path;
    cover.appendChild(Utils.createImage(coverPath, '', DEFAULT_BOOK_COVER_URL));
    item.appendChild(cover);

    const body = document.createElement('div');
    body.className = 'work-suggestion-body';

    const title = document.createElement('div');
    title.className = 'work-suggestion-title';
    title.textContent = Utils.safeText(work.book_title, 'Без названия');
    body.appendChild(title);

    const author = document.createElement('div');
    author.className = 'work-suggestion-author';
    author.textContent = composeWorkCaption(work);
    body.appendChild(author);

    if (work.editions_count) {
        const meta = document.createElement('div');
        meta.className = 'work-suggestion-meta';
        meta.textContent = formatSelectedEditionCount(work.editions_count) + ' в каталоге';
        body.appendChild(meta);
    }

    item.appendChild(body);

    const changeButton = document.createElement('button');
    changeButton.type = 'button';
    changeButton.className = 'btn btn-ghost btn-sm';
    appendButtonIcon(changeButton, 'x', 'Сменить');
    changeButton.addEventListener('click', renderStep1);
    item.appendChild(changeButton);

    return item;
}

function composeWorkCaption(work) {
    const parts = [Utils.safeText(work.book_author, 'Автор не указан')];
    if (work.book_year_published) parts.push(String(work.book_year_published));
    if (work.book_genre) parts.push(Utils.formatGenre(work.book_genre));
    return parts.join(' · ');
}

function formatSelectedEditionCount(count) {
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

function appendButtonIcon(button, iconName, label) {
    Utils.appendIconText(button, iconName, label);
}

//  7. ПОШАГОВЫЙ ИНТЕРФЕЙС  //

function renderStepperUI(root) {
    const stepper = document.createElement('div');
    stepper.className = 'stepper';

    [
        { num: 1, label: 'Шаг 1', name: 'Произведение' },
        { num: 2, label: 'Шаг 2', name: 'Издание' },
    ].forEach(({ num, label, name }, index) => {
        const step = document.createElement('div');
        step.className = 'stepper-item';
        if (num === pageState.step) step.classList.add('is-active');
        if (num < pageState.step) step.classList.add('is-done');

        const number = document.createElement('div');
        number.className = 'stepper-num';
        if (num < pageState.step) {
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'check');
            number.appendChild(icon);
        } else {
            number.textContent = String(num);
        }
        step.appendChild(number);

        const text = document.createElement('div');
        text.className = 'stepper-text';
        const labelElement = document.createElement('div');
        labelElement.className = 'stepper-label';
        labelElement.textContent = label;
        text.appendChild(labelElement);
        const nameElement = document.createElement('div');
        nameElement.className = 'stepper-name';
        nameElement.textContent = name;
        text.appendChild(nameElement);
        step.appendChild(text);

        stepper.appendChild(step);

        if (index === 0) {
            const arrow = document.createElement('i');
            arrow.className = 'stepper-arrow';
            arrow.setAttribute('data-lucide', 'chevron-right');
            stepper.appendChild(arrow);
        }
    });

    root.appendChild(stepper);
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  8. ЗАПУСК  //

function destroy() {}

PageRegistry.register('add-book', {
    init: init,
    destroy: destroy,
});
})();
