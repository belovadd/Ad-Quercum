/**
 *  КОМПОНЕНТ: NoteCard — Карточка заметки чтения (reading_notes) 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM `<div class="micro-note">` для отображения одной заметки,
 *   созданной во время сессии чтения. Тип определяет цвет чипа
 *   (`micro-note-type-{quote|thought|question|idea}`). Цитата выводится курсивом
 *   (`.micro-note-quote`), мысль/вопрос — `.micro-note-thought`.
 */

function renderNoteCard(props) {
    const p = props || {};
    const note = p.note || {};
    const type = note.note_type || NOTE_TYPE.THOUGHT;

    const card = document.createElement('div');
    card.className = 'micro-note';
    if (note.note_id) card.dataset.noteId = note.note_id;

    // --- Мета: страница, чип типа и дата ---
    const meta = document.createElement('div');
    meta.className = 'micro-note-meta';

    if (note.note_page !== undefined && note.note_page !== null && note.note_page !== '') {
        const page = document.createElement('span');
        page.className = 'micro-note-page';
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'bookmark');
        page.appendChild(i);
        const span = document.createElement('span');
        span.textContent = ' стр. ' + note.note_page;
        page.appendChild(span);
        meta.appendChild(page);
    }

    const chip = document.createElement('span');
    chip.className = 'micro-note-type micro-note-type-' + type;
    chip.textContent = noteTypeLabel(type);
    meta.appendChild(chip);

    if (note.time_created) {
        const date = document.createElement('span');
        date.className = 'micro-note-date';
        date.textContent = Utils.formatDate(note.time_created);
        meta.appendChild(date);
    }

    card.appendChild(meta);

    // --- Тело ---
    const noteText = Utils.safeText(note.note_text, '');
    if (type === NOTE_TYPE.QUOTE && noteText.indexOf('\n\n') !== -1) {
        const parts = noteText.split('\n\n');
        appendNoteBody(card, 'micro-note-quote', parts.shift());
        appendNoteBody(card, 'micro-note-thought', parts.join('\n\n'));
    } else {
        appendNoteBody(card, type === NOTE_TYPE.QUOTE ? 'micro-note-quote' : 'micro-note-thought', noteText);
    }

    if (p.onDelete) {
        const actions = document.createElement('div');
        actions.className = 'micro-note-actions';
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger-ghost btn-sm';
        deleteBtn.setAttribute('aria-label', 'Удалить заметку');
        const i = document.createElement('i');
        i.setAttribute('data-lucide', 'trash-2');
        deleteBtn.appendChild(i);
        deleteBtn.appendChild(document.createTextNode('Удалить'));
        deleteBtn.addEventListener('click', (event) => {
            event.preventDefault();
            p.onDelete(note);
        });
        actions.appendChild(deleteBtn);
        card.appendChild(actions);
    }

    return card;
}

function appendNoteBody(card, className, text) {
    const body = document.createElement('div');
    body.className = className;
    body.textContent = Utils.safeText(text, '');
    card.appendChild(body);
}

function noteTypeLabel(type) {
    if (NOTE_TYPE_LABELS[type]) return NOTE_TYPE_LABELS[type];
    return 'Заметка';
}

window.renderNoteCard = renderNoteCard;
