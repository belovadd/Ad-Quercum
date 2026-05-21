/**
 *  МОДУЛЬ: Обработчики заметок таймера 
 *
 * НАЗНАЧЕНИЕ:
 * Подсекция страницы таймера: создание/удаление/рендер заметок,
 * привязанных к активной сессии чтения. Вынесено из timer.js
 * как самостоятельная зона ответственности страницы таймера.
 */

(function () {
'use strict';

const TimerPage = window.TimerPage;
const pageState = TimerPage.state;
let activeNoteFilter = NOTE_FILTER_ALL;
let currentNotes = [];
let isAddNotePending = false;
const pendingNoteDeletes = new Set();


//  1. ВИДИМОСТЬ СЕКЦИЙ  //

function toggleNotesSections() {
    const notesSection = Utils.getElement('notes-section');

    const hasBook = pageState.selectedBook && pageState.selectedBook.id;
    const hasSession = !!pageState.sessionId;

    if (notesSection) {
        if (hasSession && hasBook) {
            Utils.showElement(notesSection);
        } else {
            Utils.hideElement(notesSection);
        }
    }
}

//  2. ЗАГРУЗКА И РЕНДЕРИНГ  //

async function loadAndRenderNotes() {
    const container = Utils.getElement('notes-list');
    const countEl = Utils.getElement('notes-count');
    if (!container) return;

    if (!pageState.sessionId) {
        Utils.clearChildren(container);
        if (countEl) countEl.textContent = '0';
        return;
    }

    try {
        const notes = await TimerService.listSessionNotes(pageState.sessionId);
        renderNotesList(Array.isArray(notes) ? notes : []);
    } catch (error) {
        // Тихо игнорируем — это вспомогательная секция.
    }
}

function renderNotesList(notes) {
    const container = Utils.getElement('notes-list');
    if (!container) return;

    currentNotes = Array.isArray(notes) ? notes : [];
    Utils.clearChildren(container);
    renderNotesHeader();
    container.appendChild(buildTimerNoteForm());

    const visibleNotes = getFilteredNotes();
    if (visibleNotes.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'section-divider';
        container.appendChild(divider);
    }

    if (visibleNotes.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: currentNotes.length === 0
                    ? 'Заметок по книге пока нет'
                    : 'Заметок этого типа пока нет',
                iconName: 'sticky-note',
                subtitle: currentNotes.length === 0
                    ? 'Добавьте цитату, мысль или вопрос к произведению'
                    : 'Переключите фильтр или добавьте новую заметку',
            }));
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
        return;
    }

    visibleNotes.forEach(function (note) {
        if (typeof renderNoteCard === 'function') {
            container.appendChild(renderNoteCard({
                note: adaptReadingNote(note),
                onDelete: handleDeleteNote,
            }));
        }
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderNotesHeader() {
    const countEl = Utils.getElement('notes-count');
    if (countEl) countEl.textContent = String(currentNotes.length);

    const filters = document.querySelectorAll('[data-note-filter]');
    filters.forEach(function (button) {
        const filter = button.dataset.noteFilter || NOTE_FILTER_ALL;
        button.classList.toggle('is-active', filter === activeNoteFilter);
        button.onclick = function () {
            if (!NOTE_FILTERS.includes(filter)) return;
            activeNoteFilter = filter;
            renderNotesList(currentNotes);
        };
    });
}

function getFilteredNotes() {
    if (activeNoteFilter === NOTE_FILTER_ALL) return currentNotes;

    return currentNotes.filter(function (note) {
        return note.note_type === activeNoteFilter;
    });
}

function buildTimerNoteForm() {
    const form = document.createElement('div');
    form.className = 'note-add-form';

    const title = document.createElement('h3');
    title.className = 'note-form-title';
    const titleIcon = document.createElement('i');
    titleIcon.setAttribute('data-lucide', 'plus-circle');
    title.appendChild(titleIcon);
    title.appendChild(document.createTextNode('Новая заметка'));
    form.appendChild(title);

    const row = document.createElement('div');
    row.className = 'note-add-row';

    const pageField = document.createElement('div');
    pageField.className = 'form-field';
    const pageInput = document.createElement('input');
    pageInput.id = 'note-page-input';
    pageInput.className = 'form-input note-page-input';
    pageInput.type = 'number';
    pageInput.min = '1';
    pageInput.placeholder = 'Стр.';
    pageField.appendChild(pageInput);

    const typeField = document.createElement('div');
    typeField.className = 'form-field';
    const typeSelect = document.createElement('select');
    typeSelect.id = 'note-type-select';
    typeSelect.className = 'form-input form-select note-type-select';
    NOTE_TYPE_OPTIONS.forEach(function (optionData) {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.label;
        typeSelect.appendChild(option);
    });
    typeField.appendChild(typeSelect);

    row.appendChild(pageField);
    row.appendChild(typeField);
    form.appendChild(row);

    const quoteField = document.createElement('div');
    quoteField.className = 'form-field';
    const quoteInput = document.createElement('textarea');
    quoteInput.id = 'note-quote-input';
    quoteInput.className = 'form-input';
    quoteInput.rows = 2;
    quoteInput.placeholder = 'Цитата из книги (необязательно)';
    quoteField.appendChild(quoteInput);
    form.appendChild(quoteField);

    const textField = document.createElement('div');
    textField.className = 'form-field';
    const textInput = document.createElement('textarea');
    textInput.id = 'note-text-input';
    textInput.className = 'form-input';
    textInput.rows = 3;
    textInput.placeholder = 'Ваша мысль, наблюдение или вопрос...';
    textField.appendChild(textInput);
    form.appendChild(textField);

    const submit = document.createElement('button');
    submit.id = 'note-add-button';
    submit.type = 'button';
    submit.className = 'btn btn-primary btn-sm';
    submit.disabled = isAddNotePending;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'plus');
    submit.appendChild(icon);
    submit.appendChild(document.createTextNode('Добавить заметку'));
    submit.addEventListener('click', handleAddNote);
    form.appendChild(submit);

    return form;
}

function adaptReadingNote(note) {
    return {
        note_id: note.note_id || note.id,
        note_type: note.note_type,
        note_text: note.note_text,
        note_page: note.note_page,
        time_created: note.time_created,
    };
}

//  3. ОБРАБОТЧИКИ  //

async function handleAddNote() {
    if (isAddNotePending) return;

    if (!pageState.sessionId) {
        Notification.error('Запустите сессию, чтобы добавить заметку');
        return;
    }
    if (!pageState.selectedBook || !pageState.selectedBook.id) {
        Notification.error('Привяжите книгу к сессии для заметок');
        return;
    }

    const typeEl = Utils.getElement('note-type-select');
    const textEl = Utils.getElement('note-text-input');
    const quoteEl = Utils.getElement('note-quote-input');
    const pageEl = Utils.getElement('note-page-input');

    const noteType = typeEl ? typeEl.value : NOTE_TYPE.THOUGHT;
    let text = textEl ? textEl.value.trim() : '';
    const quote = quoteEl ? quoteEl.value.trim() : '';

    // Если выбрана «Цитата» и заполнено только поле quote — берём её как текст.
    if (noteType === NOTE_TYPE.QUOTE && quote !== '' && text === '') {
        text = quote;
    } else if (quote !== '' && text !== '') {
        text = quote + '\n\n' + text;
    }

    if (text === '') {
        Notification.error('Текст заметки не может быть пустым');
        return;
    }

    const noteData = {
        session_id: pageState.sessionId,
        book_id: pageState.selectedBook.id,
        note_type: noteType,
        note_text: text,
    };
    if (pageEl && pageEl.value) {
        noteData.note_page = parseInt(pageEl.value, 10) || null;
    }

    const submitButton = Utils.getElement('note-add-button');
    isAddNotePending = true;
    if (submitButton) submitButton.disabled = true;

    try {
        await TimerService.createNote(noteData);
        Notification.success('Заметка сохранена');
        if (textEl) textEl.value = '';
        if (quoteEl) quoteEl.value = '';
        if (pageEl) pageEl.value = '';
        await loadAndRenderNotes();
    } catch (error) {
        Notification.error(error.message || 'Не удалось сохранить заметку');
    } finally {
        isAddNotePending = false;
        const currentSubmitButton = Utils.getElement('note-add-button');
        if (currentSubmitButton) currentSubmitButton.disabled = false;
    }
}

async function handleDeleteNote(note) {
    if (!note || !note.note_id) return;
    const noteId = note.note_id;
    if (pendingNoteDeletes.has(noteId)) return;

    pendingNoteDeletes.add(noteId);
    try {
        const confirmed = await AppConfirm.ask({
            title: 'Удалить заметку',
            message: 'Удалить заметку?',
            confirmLabel: 'Удалить',
            isDanger: true,
        });
        if (!confirmed) return;

        await TimerService.deleteNote(noteId);
        Notification.success('Заметка удалена');
        await loadAndRenderNotes();
    } catch (error) {
        Notification.error(error.message || 'Не удалось удалить заметку');
    } finally {
        pendingNoteDeletes.delete(noteId);
    }
}

Object.assign(TimerPage, {
    toggleNotesSections: toggleNotesSections,
    loadAndRenderNotes: loadAndRenderNotes,
    handleAddNote: handleAddNote,
    handleDeleteNote: handleDeleteNote,
});

PageRegistry.register('timer', {
    init: TimerPage.init,
    destroy: TimerPage.destroy,
});
})();
