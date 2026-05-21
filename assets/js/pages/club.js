/**
 *  СТРАНИЦА: Клуб — детали, участники, управление 
 *
 * НАЗНАЧЕНИЕ:
 * Детальная страница клуба: информация, участники с ролями,
 * действия (вступить/выйти), управление (редактирование, удаление,
 * исключение участников, смена ролей).
 */

(function () {
'use strict';

const ClubPage = {};
window.ClubPage = ClubPage;

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

const pageState = {
    currentUser: null,
    clubId: null,
    club: null,
    currentUserRole: null,
    members: [],
    membersPage: 1,
    membersTotalPages: 1,
    membersTotalCount: 0,
    isMembersExpanded: false,
    joinRequests: [],
    publications: [],
    publicationsPage: 1,
    publicationsTotalPages: 1,
    publicationsTotalCount: 0,
    openComments: {},
    commentPages: {},
    userBooks: [],
    selectedPublicationBook: null,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initClubPage() {
    try {
        const user = await AuthGuard.requireAuth();

        if (!user) {
            return;
        }

        pageState.currentUser = user;
        initNavigation(user);

        const clubId = Utils.getUrlParam('id');

        if (!clubId) {
            Notification.error('ID клуба не указан');
            return;
        }

        pageState.clubId = Number(clubId);

        await loadClub();
        ClubPage.bindEvents();
    } catch (error) {
        Notification.error('Ошибка загрузки страницы');
    }
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadClub() {
    try {
        const club = await ClubService.getClub(pageState.clubId);

        pageState.club = club;
        pageState.currentUserRole = club.current_user_role;

        renderClubDetail();

        await loadJoinRequests();
        await loadMembers();
        await loadPublications(1);
        await loadUserBooks();
        renderPublicationForm();
    } catch (error) {
        const container = Utils.getElement('club-header');

        if (container) {
            Utils.clearChildren(container);
            const message = document.createElement('p');
            message.className = 'muted-text';
            message.textContent = error.message || 'Клуб не найден';
            container.appendChild(message);
        }
    }
}

async function loadJoinRequests() {
    if (!canModerateClubContent()) {
        pageState.joinRequests = [];
        renderJoinRequests();
        return;
    }

    try {
        pageState.joinRequests = (await ClubService.getJoinRequests(pageState.clubId)) || [];
        renderJoinRequests();
    } catch (error) {
        pageState.joinRequests = [];
        renderJoinRequests();
    }
}

async function loadMembers(page) {
    try {
        if (page !== undefined) {
            pageState.membersPage = page;
        }

        const data = await ClubService.getMembers(pageState.clubId, pageState.membersPage);

        pageState.members = data.items;
        pageState.membersTotalPages = data.total_pages;
        pageState.membersTotalCount = data.total_count;

        renderMembers();
    } catch (error) {
        Notification.error('Не удалось загрузить участников');
    }
}

//  4. РЕНДЕРИНГ: ИНФОРМАЦИЯ О КЛУБЕ  //

function renderClubDetail() {
    const container = Utils.getElement('club-header');

    if (!container || !pageState.club) {
        return;
    }

    Utils.clearChildren(container);

    const club = pageState.club;
    const clubName = club.club_name || 'Клуб';
    const breadcrumbName = Utils.getElement('club-breadcrumb-name');
    if (breadcrumbName) {
        breadcrumbName.textContent = clubName;
    }
    const pageTitle = Utils.getElement('club-page-title');
    if (pageTitle) {
        pageTitle.textContent = clubName === 'Клуб' ? 'Клуб' : 'Клуб ' + clubName;
    }
    document.title = clubName + ' — Ad Quercum';

    container.appendChild(renderClubHeader({
        club: {
            club_id: club.id || club.club_id,
            club_name: club.club_name,
            club_description: club.club_description,
            club_image_path: club.club_image_path,
            is_public: club.is_public,
            members_count: club.member_count || club.members_count,
            current_book_title: club.current_book_title,
            time_created: club.time_created,
        },
        currentUserRole: pageState.currentUserRole,
        onJoin: Number(club.is_public) === 1 ? ClubPage.handleJoinClub : null,
        onLeave: pageState.currentUserRole === CLUB_ROLE.MODERATOR
            || pageState.currentUserRole === CLUB_ROLE.MEMBER
            ? ClubPage.handleLeaveClub
            : null,
        onEdit: canModerateClubContent() ? ClubPage.handleToggleEdit : null,
        onUpload: canModerateClubContent() ? ClubPage.handleToggleUpload : null,
        onDelete: pageState.currentUserRole === CLUB_ROLE.CREATOR ? ClubPage.handleDeleteClub : null,
    }));
}

//  5. РЕНДЕРИНГ: УЧАСТНИКИ  //

function renderMembers() {
    const container = Utils.getElement('members-list');
    const paginationContainer = Utils.getElement('members-pagination');
    const membersTitle = Utils.getElement('members-title');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (membersTitle) {
        membersTitle.textContent = pageState.membersTotalCount > 0
            ? 'Участники (' + pageState.membersTotalCount + ')'
            : 'Участники';
    }

    renderMembersDisclosure();

    if (pageState.members.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'Участников пока нет',
                iconName: 'users',
            }));
        }
    } else {
        pageState.members.forEach(function (member) {
            const card = renderClubMemberRow(member);
            container.appendChild(card);
        });
    }

    // Пагинация
    if (paginationContainer) {
        renderMembersPagination(paginationContainer);
    }
}

function renderJoinRequests() {
    const section = Utils.getElement('club-join-requests-section');
    const container = Utils.getElement('club-join-requests-list');
    const title = Utils.getElement('club-join-requests-title');

    if (!section || !container) {
        return;
    }

    Utils.clearChildren(container);

    const isVisible = canModerateClubContent() && pageState.joinRequests.length > 0;
    section.classList.toggle('is-hidden', !isVisible);

    if (title) {
        title.textContent = 'Заявки (' + pageState.joinRequests.length + ')';
    }

    if (!isVisible) {
        return;
    }

    pageState.joinRequests.forEach(function (request) {
        container.appendChild(renderJoinRequestRow(request));
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderMembersDisclosure() {
    const panel = Utils.getElement('members-panel');
    const toggleButton = Utils.getElement('toggle-members-button');

    if (panel) {
        if (pageState.isMembersExpanded) {
            panel.classList.remove('is-hidden');
        } else {
            panel.classList.add('is-hidden');
        }
    }

    if (!toggleButton) {
        return;
    }

    Utils.clearChildren(toggleButton);

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', pageState.isMembersExpanded ? 'chevron-up' : 'chevron-down');
    toggleButton.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = pageState.isMembersExpanded ? 'Свернуть' : 'Развернуть';
    toggleButton.appendChild(label);

    toggleButton.setAttribute('aria-expanded', pageState.isMembersExpanded ? 'true' : 'false');
    toggleButton.setAttribute('aria-controls', 'members-panel');

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function toggleMembersPanel() {
    pageState.isMembersExpanded = !pageState.isMembersExpanded;
    renderMembersDisclosure();
}

//  6. РЕНДЕРИНГ: ПАГИНАЦИЯ УЧАСТНИКОВ  //

function renderMembersPagination(container) {
    Utils.clearChildren(container);

    if (pageState.membersTotalPages <= 1) {
        return;
    }

    if (typeof window.renderPagination === 'function') {
        container.appendChild(window.renderPagination({
            currentPage: pageState.membersPage,
            totalPages: pageState.membersTotalPages,
            onPageChange: function (newPage) { loadMembers(newPage); },
            options: {
                totalCount: pageState.membersTotalCount,
                perPage: PAGINATION_DEFAULT_PER_PAGE,
                label: 'участников',
            },
        }));
    }
}

//  7. ВСПОМОГАТЕЛЬНЫЕ: КАРТОЧКА УЧАСТНИКА  //

function renderClubMemberRow(member) {
    const card = document.createElement('div');
    card.className = 'member-item';

    const firstName = member.user_name_first || '';
    const lastName = member.user_name_last || '';
    const fullName = (firstName + ' ' + lastName).trim();

    const avatar = document.createElement('a');
    avatar.className = 'user-avatar user-avatar-link';
    avatar.href = getClubMemberProfileUrl(member);
    avatar.setAttribute('aria-label', 'Открыть профиль ' + (fullName || member.user_email || 'участника'));
    const image = document.createElement('img');
    image.src = Utils.getAvatarUrl(member.user_avatar_path);
    image.alt = fullName || member.user_email || 'Участник';
    avatar.appendChild(image);
    card.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'member-info';

    const identity = document.createElement('div');
    identity.className = 'member-identity';

    const nameElement = document.createElement('a');
    nameElement.className = 'member-name user-profile-link';
    nameElement.href = getClubMemberProfileUrl(member);
    nameElement.textContent = fullName || member.user_email || 'Пользователь';
    identity.appendChild(nameElement);

    const handleElement = document.createElement('span');
    handleElement.className = 'member-handle';
    handleElement.textContent = '@' + Utils.safeText(member.user_profile_identifier, 'user');
    identity.appendChild(handleElement);

    info.appendChild(identity);

    const meta = document.createElement('div');
    meta.className = 'user-meta member-meta';
    appendClubMemberMetaItem(meta, 'book-copy', member.books_count, 'книг');
    appendClubMemberMetaItem(meta, 'users', member.friends_count, 'друзей');
    appendClubMemberMetaItem(meta, 'message-square', member.publications_count, 'публикаций');
    if (meta.childElementCount > 0) info.appendChild(meta);

    card.appendChild(info);

    const actionContainer = document.createElement('div');
    actionContainer.className = 'member-actions';

    const currentRole = pageState.currentUserRole;
    const targetRole = member.member_role;
    const isSelf = Number(member.user_id) === Number(pageState.currentUser.id);

    if (currentRole === CLUB_ROLE.CREATOR && !isSelf) {
        const roleSelect = document.createElement('select');
        roleSelect.className = 'member-role-select';

        const moderatorOption = document.createElement('option');
        moderatorOption.value = CLUB_ROLE.MODERATOR;
        moderatorOption.textContent = CLUB_ROLE_LABELS[CLUB_ROLE.MODERATOR];
        moderatorOption.selected = targetRole === CLUB_ROLE.MODERATOR;
        roleSelect.appendChild(moderatorOption);

        const memberOption = document.createElement('option');
        memberOption.value = CLUB_ROLE.MEMBER;
        memberOption.textContent = CLUB_ROLE_LABELS[CLUB_ROLE.MEMBER];
        memberOption.selected = targetRole === CLUB_ROLE.MEMBER;
        roleSelect.appendChild(memberOption);

        roleSelect.addEventListener('change', function () {
            ClubPage.handleChangeRole(member.user_id, roleSelect.value);
        });

        actionContainer.appendChild(roleSelect);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn btn-danger-ghost btn-sm';
        const removeIcon = document.createElement('i');
        removeIcon.setAttribute('data-lucide', 'user-minus');
        removeButton.appendChild(removeIcon);
        const removeText = document.createElement('span');
        removeText.textContent = 'Исключить';
        removeButton.appendChild(removeText);
        removeButton.addEventListener('click', function () {
            ClubPage.handleRemoveMember(member.user_id);
        });
        actionContainer.appendChild(removeButton);
    }

    if (currentRole === CLUB_ROLE.MODERATOR && !isSelf && targetRole === CLUB_ROLE.MEMBER) {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn btn-danger-ghost btn-sm';
        const removeIcon = document.createElement('i');
        removeIcon.setAttribute('data-lucide', 'user-minus');
        removeButton.appendChild(removeIcon);
        const removeText = document.createElement('span');
        removeText.textContent = 'Исключить';
        removeButton.appendChild(removeText);
        removeButton.addEventListener('click', function () {
            ClubPage.handleRemoveMember(member.user_id);
        });
        actionContainer.appendChild(removeButton);
    }

    if (actionContainer.childNodes.length === 0) {
        const roleChip = document.createElement('span');
        roleChip.className = 'member-role-chip ' + clubRoleTagClass(targetRole);
        roleChip.textContent = CLUB_ROLE_LABELS[targetRole] || targetRole;
        actionContainer.appendChild(roleChip);
    }

    if (actionContainer.childNodes.length > 0) {
        card.appendChild(actionContainer);
    }

    return card;
}

function renderJoinRequestRow(request) {
    const card = document.createElement('div');
    card.className = 'member-item club-join-request-item';

    const firstName = request.user_name_first || '';
    const lastName = request.user_name_last || '';
    const fullName = (firstName + ' ' + lastName).trim();

    const avatar = document.createElement('a');
    avatar.className = 'user-avatar user-avatar-link';
    avatar.href = getClubMemberProfileUrl(request);
    avatar.setAttribute('aria-label', 'Открыть профиль ' + (fullName || request.user_email || 'пользователя'));
    const image = document.createElement('img');
    image.src = Utils.getAvatarUrl(request.user_avatar_path);
    image.alt = fullName || request.user_email || 'Пользователь';
    avatar.appendChild(image);
    card.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'member-info';

    const identity = document.createElement('div');
    identity.className = 'member-identity';

    const nameElement = document.createElement('a');
    nameElement.className = 'member-name user-profile-link';
    nameElement.href = getClubMemberProfileUrl(request);
    nameElement.textContent = fullName || request.user_email || 'Пользователь';
    identity.appendChild(nameElement);

    const handleElement = document.createElement('span');
    handleElement.className = 'member-handle';
    handleElement.textContent = '@' + Utils.safeText(request.user_profile_identifier, 'user');
    identity.appendChild(handleElement);

    info.appendChild(identity);

    const meta = document.createElement('div');
    meta.className = 'user-meta member-meta';
    appendClubMemberMetaItem(meta, 'book-copy', request.books_count, 'книг');
    appendClubMemberMetaItem(meta, 'users', request.friends_count, 'друзей');
    appendClubMemberMetaItem(meta, 'message-square', request.publications_count, 'публикаций');
    if (request.time_created) {
        appendClubMemberMetaText(meta, 'clock', 'Заявка ' + Utils.formatDate(request.time_created));
    }
    if (meta.childElementCount > 0) info.appendChild(meta);

    card.appendChild(info);

    const actionContainer = document.createElement('div');
    actionContainer.className = 'member-actions';

    const acceptButton = document.createElement('button');
    acceptButton.type = 'button';
    acceptButton.className = 'btn btn-primary btn-sm';
    const acceptIcon = document.createElement('i');
    acceptIcon.setAttribute('data-lucide', 'check');
    acceptButton.appendChild(acceptIcon);
    const acceptText = document.createElement('span');
    acceptText.textContent = 'Принять';
    acceptButton.appendChild(acceptText);
    acceptButton.addEventListener('click', function () {
        ClubPage.handleAcceptJoinRequest(request.id);
    });
    actionContainer.appendChild(acceptButton);

    const rejectButton = document.createElement('button');
    rejectButton.type = 'button';
    rejectButton.className = 'btn btn-danger-ghost btn-sm';
    const rejectIcon = document.createElement('i');
    rejectIcon.setAttribute('data-lucide', 'x');
    rejectButton.appendChild(rejectIcon);
    const rejectText = document.createElement('span');
    rejectText.textContent = 'Отклонить';
    rejectButton.appendChild(rejectText);
    rejectButton.addEventListener('click', function () {
        ClubPage.handleRejectJoinRequest(request.id);
    });
    actionContainer.appendChild(rejectButton);

    card.appendChild(actionContainer);

    return card;
}

function clubRoleTagClass(role) {
    if (role === CLUB_ROLE.CREATOR) return 'tag tag-primary';
    if (role === CLUB_ROLE.MODERATOR) return 'tag tag-secondary';
    return 'tag tag-muted';
}

function getClubMemberProfileUrl(member) {
    return Utils.getUserProfileUrl(member);
}

function appendClubMemberMetaItem(container, icon, value, word) {
    if (value === null || value === undefined) return;

    const item = document.createElement('span');
    item.className = 'user-meta-item';

    const iconElement = document.createElement('i');
    iconElement.setAttribute('data-lucide', icon);
    item.appendChild(iconElement);

    const text = document.createElement('span');
    text.textContent = String(value) + ' ' + word;
    item.appendChild(text);

    container.appendChild(item);
}

function appendClubMemberMetaText(container, icon, label) {
    if (!label) return;

    const item = document.createElement('span');
    item.className = 'user-meta-item';

    const iconElement = document.createElement('i');
    iconElement.setAttribute('data-lucide', icon);
    item.appendChild(iconElement);

    const text = document.createElement('span');
    text.textContent = label;
    item.appendChild(text);

    container.appendChild(item);
}

//  8. РЕНДЕРИНГ: ПУБЛИКАЦИИ  //

async function loadPublications(page, shouldScroll) {
    try {
        if (page !== undefined) {
            pageState.publicationsPage = page;
        }

        const data = await ClubService.getClubPublications(
            pageState.clubId,
            pageState.publicationsPage,
            CLUB_PUBLICATIONS_PER_PAGE
        );

        pageState.publications = data.items;
        pageState.publicationsTotalPages = data.total_pages;
        pageState.publicationsTotalCount = data.total_count;

        renderPublications();
        await loadVisiblePublicationCommentsLastPages();
        if (shouldScroll) {
            scrollToPublicationListTop();
        }
    } catch (error) {
        Notification.error('Не удалось загрузить публикации');
    }
}

async function loadUserBooks() {
    try {
        const data = await LibraryService.searchUserLibrary({ perPage: USER_LIBRARY_SELECT_LIMIT });
        pageState.userBooks = data.items || [];
        renderPublicationBookSearch();
    } catch (error) {
        // Не критичная ошибка — привязка книги останется пустой.
    }
}

function renderPublicationForm() {
    const formSection = Utils.getElement('club-publication-form');

    if (!formSection) {
        return;
    }

    // Форма доступна любому участнику клуба: создателю, модератору и участнику.
    if (pageState.currentUserRole !== null) {
        formSection.classList.remove('is-hidden');
    } else {
        formSection.classList.add('is-hidden');
    }
}

function renderPublicationBookSearch() {
    const container = Utils.getElement('club-publication-book-search');

    if (!container || typeof renderTimerBookSearchComponent !== 'function') {
        return;
    }

    Utils.clearChildren(container);

    container.appendChild(renderTimerBookSearchComponent({
        books: pageState.userBooks,
        selectedBook: pageState.selectedPublicationBook,
        onSelect: function (book) {
            pageState.selectedPublicationBook = book;
        },
        onClear: function () {
            pageState.selectedPublicationBook = null;
        },
    }));

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderPublications() {
    const container = Utils.getElement('publications-list');
    const paginationContainer = Utils.getElement('publications-pagination');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (pageState.publications.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'Публикаций пока нет',
                iconName: 'newspaper',
                subtitle: 'Создайте первую публикацию в клубе',
            }));
        }
    } else {
        const currentUserId = pageState.currentUser.id;

        pageState.publications.forEach(function (publication) {
            const card = renderPublicationCard(publication, currentUserId, {
                onDelete: ClubPage.handleDeletePublication,
                onToggleComments: ClubPage.handleToggleComments,
                canDeleteAny: canModerateClubContent(),
            });

            container.appendChild(card);
        });
    }

    // Пагинация
    if (paginationContainer) {
        renderPublicationsPagination(paginationContainer);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderPublicationsPagination(container) {
    Utils.clearChildren(container);

    if (pageState.publicationsTotalPages <= 1) {
        return;
    }

    if (typeof window.renderPagination === 'function') {
        container.appendChild(window.renderPagination({
            currentPage: pageState.publicationsPage,
            totalPages: pageState.publicationsTotalPages,
            onPageChange: function (newPage) { loadPublications(newPage, true); },
            options: {
                totalCount: pageState.publicationsTotalCount,
                perPage: CLUB_PUBLICATIONS_PER_PAGE,
                label: 'публикаций',
            },
        }));
    }
}

//  9. РЕНДЕРИНГ: КОММЕНТАРИИ ПУБЛИКАЦИЙ  //

async function loadPublicationComments(publicationId, page, shouldScroll) {
    try {
        const targetPage = resolveCommentPage(publicationId, page);
        const data = await ClubService.getClubComments(
            publicationId,
            targetPage,
            PUBLICATION_COMMENTS_PER_PAGE
        );

        if (data.total_count > 0 && data.total_pages > 0 && targetPage > data.total_pages) {
            await loadPublicationComments(publicationId, data.total_pages);
            return;
        }

        pageState.commentPages[publicationId] = Number(data.page) || targetPage;
        renderPublicationComments(publicationId, data);
        if (shouldScroll) {
            scrollToPublicationCommentsTop(publicationId);
        }
    } catch (error) {
        Notification.error('Не удалось загрузить комментарии');
    }
}

async function loadVisiblePublicationCommentsLastPages() {
    const tasks = pageState.publications.map(function (publication) {
        return loadPublicationComments(publication.id, 'last');
    });

    await Promise.all(tasks);
}

function renderPublicationComments(publicationId, payload) {
    const container = Utils.getElement('comments-' + publicationId);

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    const comments = Array.isArray(payload) ? payload : (payload.items || []);
    const currentUserId = pageState.currentUser.id;

    // Список комментариев
    if (comments.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: 'Пока нет комментариев',
                iconName: 'message-circle',
            }));
        }
    } else {
        comments.forEach(function (comment) {
            const commentElement = renderComment(comment, currentUserId, function (commentId) {
                ClubPage.handleDeleteComment(commentId, publicationId);
            }, {
                canDeleteAny: canModerateClubContent(),
            });
            container.appendChild(commentElement);
        });
    }

    renderPublicationCommentsPagination(publicationId, payload, container);

    // Форма добавления комментария (только для участников клуба)
    if (pageState.currentUserRole !== null) {
        const form = renderCommentForm(publicationId, ClubPage.handleCreateComment);
        container.appendChild(form);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderPublicationCommentsPagination(publicationId, payload, container) {
    if (Array.isArray(payload) || !payload || payload.total_count <= PUBLICATION_COMMENTS_PER_PAGE) {
        return;
    }

    if (typeof window.renderPagination !== 'function') {
        return;
    }

    const pagination = window.renderPagination({
        currentPage: payload.page || 1,
        totalPages: payload.total_pages || 1,
        onPageChange: function (newPage) {
            loadPublicationComments(publicationId, newPage, true);
        },
        options: {
            totalCount: payload.total_count,
            perPage: PUBLICATION_COMMENTS_PER_PAGE,
            label: 'комментариев',
        },
    });
    pagination.classList.add('pub-comments-pagination');
    container.appendChild(pagination);
}

function resolveCommentPage(publicationId, page) {
    if (page === 'last') {
        return getPublicationLastCommentPage(publicationId);
    }

    if (page !== undefined) {
        return Math.max(1, Number(page) || 1);
    }

    return pageState.commentPages[publicationId] || getPublicationLastCommentPage(publicationId);
}

function getPublicationLastCommentPage(publicationId) {
    const publication = pageState.publications.find(function (item) {
        return Number(item.id) === Number(publicationId);
    });
    const count = publication ? Number(publication.comment_count || 0) : 0;

    return Math.max(1, Math.ceil(count / PUBLICATION_COMMENTS_PER_PAGE));
}

function scrollToPublicationListTop() {
    scrollToElementTop(Utils.getElement('publications-list'));
}

function scrollToPublicationCommentsTop(publicationId) {
    scrollToElementTop(Utils.getElement('comments-' + publicationId));
}

function scrollToElementTop(element) {
    Utils.scrollToElementTop(element);
}

function shouldScrollElementToTop(element) {
    return Utils.shouldScrollElementToTop(element);
}

function canModerateClubContent() {
    return pageState.currentUserRole === CLUB_ROLE.CREATOR
        || pageState.currentUserRole === CLUB_ROLE.MODERATOR;
}

function destroy() {}

Object.assign(ClubPage, {
    state: pageState,
    init: initClubPage,
    destroy: destroy,
    loadClub: loadClub,
    loadJoinRequests: loadJoinRequests,
    loadMembers: loadMembers,
    loadPublications: loadPublications,
    loadPublicationComments: loadPublicationComments,
    renderPublicationForm: renderPublicationForm,
    renderPublicationBookSearch: renderPublicationBookSearch,
    toggleMembersPanel: toggleMembersPanel,
});
})();
