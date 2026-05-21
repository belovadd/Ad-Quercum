/**
 *  КОМПОНЕНТ: PublicationCard — Карточка публикации (.pub-card) 
 *
 * НАЗНАЧЕНИЕ:
 * Рендеринг карточки публикации в ленте: автор, дата, опционально книга, текст,
 * подвал с действиями, контейнер для комментариев, форма ответа.
 */

//  1. РЕНДЕРИНГ КАРТОЧКИ ПУБЛИКАЦИИ  //

function renderPublicationCard(publication, currentUserId, callbacks) {
    const cb = callbacks || {};

    const card = document.createElement('article');
    card.className = 'pub-card';
    card.dataset.publicationId = publication.id;

    card.appendChild(buildPubHeader(publication, currentUserId, cb));

    // Привязанная книга
    if (publication.book_id && publication.book_title) {
        card.appendChild(buildPubBookRef(publication));
    }

    // Текст
    const textElement = document.createElement('div');
    textElement.className = 'pub-text';
    textElement.textContent = Utils.safeText(publication?.publication_text, '');
    card.appendChild(textElement);

    // Подвал-действия
    card.appendChild(buildPubActions(publication, currentUserId, cb));

    // Контейнер для комментариев
    const commentsSection = document.createElement('div');
    commentsSection.className = 'pub-comments';
    commentsSection.id = 'comments-' + publication.id;
    card.appendChild(commentsSection);

    return card;
}

function buildPubHeader(publication, currentUserId, cb) {
    const header = document.createElement('div');
    header.className = 'pub-header';

    const avatar = document.createElement('a');
    avatar.className = 'user-avatar user-avatar-link pub-avatar';
    avatar.href = PAGE_URL.PROFILE + '?user_id=' + publication.user_id;

    const avatarImage = document.createElement('img');
    avatarImage.src = Utils.getAvatarUrl(publication.user_avatar_path);
    avatarImage.alt = '';
    avatar.appendChild(avatarImage);
    header.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'pub-meta';

    const author = document.createElement('a');
    author.className = 'pub-author user-profile-link';
    author.href = PAGE_URL.PROFILE + '?user_id=' + publication.user_id;
    author.textContent = composeFullName(publication);
    info.appendChild(author);

    const date = document.createElement('div');
    date.className = 'pub-date';
    date.textContent = Utils.formatDate(publication.time_created);
    info.appendChild(date);

    header.appendChild(info);

    if ((cb.canDeleteAny || currentUserId === parseInt(publication.user_id, 10)) && cb.onDelete) {
        header.appendChild(buildPublicationDeleteButton(publication.id, cb.onDelete, 'pub-header-delete'));
    }

    return header;
}

function buildPubBookRef(publication) {
    const ref = document.createElement('a');
    ref.className = 'pub-book-ref';
    ref.href = PAGE_URL.BOOK + '?id=' + publication.book_id;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'book-open');
    ref.appendChild(icon);

    const text = document.createElement('span');
    let label = Utils.safeText(publication?.book_title, 'Книга');
    if (publication.book_author) label += ' — ' + publication.book_author;
    text.textContent = label;
    ref.appendChild(text);

    return ref;
}

function buildPubActions(publication, currentUserId, cb) {
    const actions = document.createElement('div');
    actions.className = 'pub-actions';

    const commentBtn = document.createElement('button');
    commentBtn.type = 'button';
    commentBtn.className = 'pub-action';
    const commentIcon = document.createElement('i');
    commentIcon.setAttribute('data-lucide', 'message-circle');
    commentBtn.appendChild(commentIcon);
    const commentText = document.createElement('span');
    commentText.textContent = formatPublicationCommentCount(publication.comment_count);
    commentBtn.appendChild(commentText);
    if (cb.onToggleComments) {
        commentBtn.addEventListener('click', () => cb.onToggleComments(publication.id));
    }
    actions.appendChild(commentBtn);

    return actions;
}

function buildPublicationDeleteButton(publicationId, onDelete, extraClass) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger-ghost btn-sm ' + extraClass;
    deleteBtn.title = 'Удалить';

    const trashIcon = document.createElement('i');
    trashIcon.setAttribute('data-lucide', 'trash-2');
    deleteBtn.appendChild(trashIcon);

    const deleteText = document.createElement('span');
    deleteText.textContent = 'Удалить';
    deleteBtn.appendChild(deleteText);

    deleteBtn.addEventListener('click', () => onDelete(publicationId));

    return deleteBtn;
}

//  2. РЕНДЕРИНГ КОММЕНТАРИЯ  //

function renderComment(comment, currentUserId, onDelete, options) {
    const opts = options || {};
    const element = document.createElement('div');
    element.className = 'pub-comment';
    element.dataset.commentId = comment.id;

    const avatarLink = document.createElement('a');
    avatarLink.className = 'user-avatar user-avatar-link pub-comment-avatar';
    avatarLink.href = PAGE_URL.PROFILE + '?user_id=' + comment.user_id;

    const avatarImage = document.createElement('img');
    avatarImage.src = Utils.getAvatarUrl(comment.user_avatar_path);
    avatarImage.alt = '';
    avatarLink.appendChild(avatarImage);
    const body = document.createElement('div');
    body.className = 'pub-comment-body';

    const headerRow = document.createElement('div');
    headerRow.className = 'pub-comment-header';
    headerRow.appendChild(avatarLink);

    const name = document.createElement('a');
    name.className = 'pub-comment-name user-profile-link';
    name.href = PAGE_URL.PROFILE + '?user_id=' + comment.user_id;
    name.textContent = composeFullName(comment);

    const meta = document.createElement('div');
    meta.className = 'pub-comment-meta';
    meta.appendChild(name);

    const time = document.createElement('span');
    time.className = 'pub-comment-time';
    time.textContent = Utils.formatDate(comment.time_created);
    meta.appendChild(time);

    headerRow.appendChild(meta);

    if ((opts.canDeleteAny || currentUserId === parseInt(comment.user_id, 10)) && onDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn-danger-ghost btn-sm pub-comment-delete';
        deleteBtn.title = 'Удалить';
        deleteBtn.setAttribute('aria-label', 'Удалить комментарий');

        const trashIcon = document.createElement('i');
        trashIcon.setAttribute('data-lucide', 'trash-2');
        deleteBtn.appendChild(trashIcon);
        const deleteText = document.createElement('span');
        deleteText.textContent = 'Удалить';
        deleteBtn.appendChild(deleteText);

        deleteBtn.addEventListener('click', () => onDelete(comment.id));
        headerRow.appendChild(deleteBtn);
    }

    body.appendChild(headerRow);

    const text = document.createElement('div');
    text.className = 'pub-comment-text';
    text.textContent = Utils.safeText(comment?.comment_text, '');
    body.appendChild(text);

    element.appendChild(body);

    return element;
}

//  3. РЕНДЕРИНГ ФОРМЫ КОММЕНТАРИЯ //

function renderCommentForm(publicationId, onSubmit) {
    const form = document.createElement('div');
    form.className = 'pub-comment-input';

    const input = document.createElement('textarea');
    input.className = 'form-input form-textarea';
    input.placeholder = 'Написать комментарий... (новая строка Shift+Enter)';
    input.rows = 2;
    input.maxLength = MAX_COMMENT_TEXT_LENGTH;
    form.appendChild(input);

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn btn-primary';
    const sendIcon = document.createElement('i');
    sendIcon.setAttribute('data-lucide', 'send');
    submitBtn.appendChild(sendIcon);
    const sendText = document.createElement('span');
    sendText.textContent = 'Отправить';
    submitBtn.appendChild(sendText);
    submitBtn.addEventListener('click', () => submitCommentInput(publicationId, input, onSubmit));

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submitCommentInput(publicationId, input, onSubmit);
        }
    });

    form.appendChild(submitBtn);

    return form;
}

//  4. ВНУТРЕННИЕ ПОМОЩНИКИ  //

function composeFullName(entity) {
    return Utils.composeUserName(entity, 'Пользователь', { useIdentifier: false, useEmail: true });
}

function formatPublicationCommentCount(value) {
    const count = Number(value) || 0;
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    let word = 'комментариев';

    if (lastDigit === 1 && lastTwoDigits !== 11) {
        word = 'комментарий';
    } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
        word = 'комментария';
    }

    return count + ' ' + word;
}

function submitCommentInput(publicationId, input, onSubmit) {
    const text = input.value.trim();
    if (text === '') return;
    onSubmit(publicationId, text);
    input.value = '';
}
