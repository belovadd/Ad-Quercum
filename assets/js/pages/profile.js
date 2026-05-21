/**
 *  СТРАНИЦА: Профиль — информация, растение, статистика, публикации
 *
 * НАЗНАЧЕНИЕ:
 * Страница профиля пользователя. Поддерживает просмотр своего профиля
 * (редактирование, приватность, создание публикаций) и чужого профиля
 * (только чтение, с учётом настроек приватности).
 */

(function () {
'use strict';

const ProfilePage = {};
window.ProfilePage = ProfilePage;

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

const pageState = {
    currentUser: null,
    profileUser: null,
    isOwnProfile: false,
    plant: null,
    plantHidden: false,
    stats: null,
    statsHidden: false,
    publications: [],
    publicationsPage: 1,
    publicationsTotalPages: 1,
    publicationsTotalCount: 0,
    openComments: {},
    commentPages: {},
    userBooks: [],
    selectedPublicationBook: null,
    isEditing: false,
};

// 2. ИНИЦИАЛИЗАЦИЯ  //

async function initProfilePage() {
    try {
        const user = await AuthGuard.requireAuth();

        if (!user) {
            return;
        }

        pageState.currentUser = user;
        initNavigation(user);

        // Определяем, чей профиль просматриваем.
        const targetUserId = parseTargetUserId(Utils.getUrlParam('user_id'));
        const currentUserId = Number(pageState.currentUser.id);

        pageState.isOwnProfile = (targetUserId === null || targetUserId === currentUserId);
        const profileUserId = pageState.isOwnProfile ? null : targetUserId;

        const isProfileLoaded = await loadProfileData(profileUserId);
        if (!isProfileLoaded) {
            return;
        }

        await loadPageSections(profileUserId);
        ProfilePage.bindEvents();
    } catch (error) {
        Notification.error('Ошибка загрузки страницы профиля');
    }
}

function parseTargetUserId(userIdParam) {
    if (userIdParam === null || userIdParam.trim() === '') {
        return null;
    }

    const userId = Number(userIdParam);

    if (!Number.isInteger(userId) || userId <= 0) {
        return null;
    }

    return userId;
}

//  3. ЗАГРУЗКА ДАННЫХ //

async function loadProfileData(userId) {
    try {
        const profile = await AuthService.getProfile(userId);
        pageState.profileUser = profile;
        renderProfilePageTitle();
        renderProfileCard();
        return true;
    } catch (error) {
        renderUnavailableProfile(error.status === 403 ? 'Профиль скрыт' : 'Профиль недоступен');
        return false;
    }
}

function renderProfilePageTitle() {
    const titleElement = Utils.getElement('profile-page-title');
    const title = pageState.isOwnProfile
        ? 'Мой профиль'
        : 'Профиль ' + composeProfileDisplayName(pageState.profileUser);

    if (titleElement) {
        titleElement.textContent = title;
    }

    document.title = title + ' — Ad Quercum';
}

function composeProfileDisplayName(profile) {
    return Utils.composeUserName(profile, 'пользователя', { prefixIdentifier: true, useEmail: true });
}

function renderUnavailableProfile(title) {
    pageState.profileUser = null;

    const titleElement = Utils.getElement('profile-page-title');
    if (titleElement) {
        titleElement.textContent = title;
    }
    document.title = title + ' — Ad Quercum';

    const layout = document.querySelector('.profile-layout');
    if (!layout) return;

    Utils.clearChildren(layout);

    const section = document.createElement('section');
    section.className = 'content-section';

    const header = document.createElement('header');
    header.className = 'section-header';

    const sectionTitle = document.createElement('h1');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = title;
    header.appendChild(sectionTitle);

    const text = document.createElement('p');
    text.className = 'muted-text';
    text.textContent = title === 'Профиль скрыт'
        ? 'Пользователь ограничил просмотр профиля.'
        : 'Этот профиль сейчас нельзя просмотреть.';

    section.appendChild(header);
    section.appendChild(text);
    layout.appendChild(section);
}

async function loadPageSections(userId) {
    const targetUserId = pageState.isOwnProfile ? null : userId;

    const promises = [
        loadPlant(targetUserId),
        loadStats(targetUserId),
        loadPublications(targetUserId),
    ];

    // Загружаем книги пользователя для формы публикации (только свой профиль)
    if (pageState.isOwnProfile) {
        promises.push(loadUserBooks());
    }

    await Promise.allSettled(promises);
}

async function loadPlant(userId) {
    try {
        let plant;

        if (userId === null) {
            plant = await TimerService.getPlantState();
        } else {
            plant = await TimerService.getUserPlantState(userId);
        }

        pageState.plant = plant;
        pageState.plantHidden = false;
    } catch (error) {
        if (error.status === 403) {
            pageState.plantHidden = true;
        } else {
            pageState.plantHidden = false;
            pageState.plant = null;
        }
    }

    renderPlant();
}

async function loadStats(userId) {
    try {
        let stats;

        if (userId === null) {
            stats = await StatisticsService.getOverview();
        } else {
            stats = await StatisticsService.getUserOverview(userId);
        }

        pageState.stats = stats;
        pageState.statsHidden = false;
    } catch (error) {
        if (error.status === 403) {
            pageState.statsHidden = true;
        } else {
            pageState.statsHidden = false;
            pageState.stats = null;
        }
    }

    renderStats();
}

async function loadPublications(userId, page, shouldScroll) {
    try {
        if (page !== undefined) {
            pageState.publicationsPage = page;
        }

        const targetId = userId !== null && userId !== undefined
            ? userId
            : pageState.profileUser.id;

        const data = await SocialService.getUserPublications(
            targetId,
            pageState.publicationsPage,
            PROFILE_PUBLICATIONS_PER_PAGE
        );

        pageState.publications = data.items || [];
        pageState.publicationsTotalPages = data.total_pages || 1;
        pageState.publicationsTotalCount = data.total_count || 0;
    } catch (error) {
        pageState.publications = [];
        pageState.publicationsTotalCount = 0;
    }

    renderPublications();
    await loadVisibleCommentsLastPages();
    if (shouldScroll) {
        scrollToPublicationListTop();
    }
}

async function loadUserBooks() {
    try {
        const booksData = await LibraryService.searchUserLibrary({ perPage: USER_LIBRARY_SELECT_LIMIT });
        pageState.userBooks = booksData.items || [];
    } catch (error) {
        pageState.userBooks = [];
    }

    renderPublicationBookSearch();
}

async function loadComments(publicationId, page, shouldScroll) {
    try {
        const targetPage = resolveCommentPage(publicationId, page);
        const data = await SocialService.getComments(
            publicationId,
            targetPage,
            PUBLICATION_COMMENTS_PER_PAGE
        );

        if (data.total_count > 0 && data.total_pages > 0 && targetPage > data.total_pages) {
            await loadComments(publicationId, data.total_pages);
            return;
        }

        pageState.commentPages[publicationId] = Number(data.page) || targetPage;
        renderComments(publicationId, data);
        if (shouldScroll) {
            scrollToPublicationCommentsTop(publicationId);
        }
    } catch (error) {
        Notification.error('Не удалось загрузить комментарии');
    }
}

async function loadVisibleCommentsLastPages() {
    const tasks = pageState.publications.map(function (publication) {
        return loadComments(publication.id, 'last');
    });

    await Promise.all(tasks);
}

//  4. РЕНДЕРИНГ: КАРТОЧКА ПРОФИЛЯ  //

function renderProfileCard() {
    const container = Utils.getElement('profile-card');

    if (!container || !pageState.profileUser) {
        return;
    }

    Utils.clearChildren(container);

    const profile = pageState.profileUser;
    const firstName = profile.user_name_first || '';
    const lastName = profile.user_name_last || '';
    const fullName = (firstName + ' ' + lastName).trim();

    // Аватар
    const avatarWrapper = document.createElement('figure');
    avatarWrapper.className = 'profile-card-avatar';

    const avatarImage = document.createElement('img');
    avatarImage.src = Utils.getAvatarUrl(profile.user_avatar_path);
    avatarImage.alt = '';
    avatarImage.addEventListener('error', () => renderProfileDefaultAvatar(avatarWrapper));
    avatarWrapper.appendChild(avatarImage);
    container.appendChild(avatarWrapper);

    const identityElement = document.createElement('div');
    identityElement.className = 'profile-card-identity';

    // Имя
    const nameElement = document.createElement('h2');
    nameElement.className = 'profile-card-name';
    nameElement.textContent = fullName || profile.user_email || 'Пользователь';
    identityElement.appendChild(nameElement);

    // Идентификатор
    if (profile.user_profile_identifier) {
        const identifierElement = document.createElement('p');
        identifierElement.className = 'profile-card-handle';
        identifierElement.textContent = '@' + profile.user_profile_identifier;
        identityElement.appendChild(identifierElement);
    }
    container.appendChild(identityElement);

    const detailsElement = document.createElement('div');
    detailsElement.className = 'profile-card-details';

    if (profile.user_status) {
        appendProfileCardLine(detailsElement, 'book-open', profile.user_status);
    }

    if (profile.user_location) {
        appendProfileCardLine(detailsElement, 'map-pin', profile.user_location);
    }

    if (profile.user_bio) {
        appendProfileCardLine(detailsElement, 'scroll-text', profile.user_bio);
    }

    // Дата регистрации
    if (profile.time_created) {
        appendProfileCardLine(detailsElement, 'calendar', 'На сайте с ' + Utils.formatDate(profile.time_created));
    }

    if (detailsElement.childElementCount > 0) {
        container.appendChild(detailsElement);
    }

    appendProfileCardStats(container, profile.summary || {});

    appendProfileNavigationActions(container, profile);

    // Кнопка «Редактировать» (только свой профиль)
    if (pageState.isOwnProfile) {
        const editButton = document.createElement('button');
        editButton.className = 'btn btn-primary btn-block';
        editButton.id = 'edit-profile-button';
        const editIcon = document.createElement('i');
        editIcon.setAttribute('data-lucide', 'pencil');
        editButton.appendChild(editIcon);
        const editText = document.createElement('span');
        editText.textContent = 'Редактировать профиль';
        editButton.appendChild(editText);
        editButton.addEventListener('click', ProfilePage.handleToggleEdit);
        container.appendChild(editButton);

        // Показываем настройки приватности
        const privacySection = Utils.getElement('privacy-settings');
        Utils.showElement(privacySection);
        ProfilePage.renderPrivacySettings();
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function appendProfileNavigationActions(container, profile) {
    const actions = document.createElement('div');
    actions.className = 'profile-card-actions';
    const summary = profile.summary || {};

    if (pageState.isOwnProfile || !isTruthyFlag(profile.is_library_hidden)) {
        const libraryLink = document.createElement('a');
        libraryLink.className = 'btn btn-primary btn-block';
        libraryLink.href = pageState.isOwnProfile ? PAGE_URL.LIBRARY : PAGE_URL.LIBRARY + '?user_id=' + profile.id;
        appendProfileActionIcon(libraryLink, 'library', 'Библиотека (' + formatProfileActionCount(summary.books_count) + ')');
        actions.appendChild(libraryLink);
    }

    if (pageState.isOwnProfile || !isTruthyFlag(profile.is_collections_hidden)) {
        const collectionsLink = document.createElement('a');
        collectionsLink.className = 'btn btn-primary btn-block';
        collectionsLink.href = pageState.isOwnProfile ? PAGE_URL.COLLECTIONS : PAGE_URL.COLLECTIONS + '?user_id=' + profile.id;
        appendProfileActionIcon(collectionsLink, 'folder', 'Коллекции (' + formatProfileActionCount(summary.collections_count) + ')');
        actions.appendChild(collectionsLink);
    }

    if (actions.childElementCount > 0) {
        container.appendChild(actions);
    }
}

function formatProfileActionCount(value) {
    const count = Number(value);
    return Number.isFinite(count) ? Utils.formatNumber(count) : '0';
}

function isTruthyFlag(value) {
    return value === 1 || value === true || value === '1';
}

function appendProfileActionIcon(link, iconName, label) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    link.appendChild(icon);
    const text = document.createElement('span');
    text.textContent = label;
    link.appendChild(text);
}

function appendProfileCardLine(container, iconName, text) {
    const line = document.createElement('p');
    line.className = 'profile-card-joined profile-card-line';
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    line.appendChild(icon);
    const span = document.createElement('span');
    span.textContent = text;
    line.appendChild(span);
    container.appendChild(line);
}

function appendProfileCardStats(container, summary) {
    const stats = document.createElement('div');
    stats.className = 'profile-card-stats';
    appendProfileStat(stats, summary.friends_count, 'Друзей');
    appendProfileStat(stats, summary.publications_count, 'Публикаций');
    appendProfileStat(stats, summary.clubs_count, 'Клубов');
    if (stats.childElementCount > 0) {
        container.appendChild(stats);
    }
}

function appendProfileStat(container, value, label) {
    if (value === null || value === undefined) return;
    const stat = document.createElement('div');
    stat.className = 'profile-stat';

    const valueElement = document.createElement('div');
    valueElement.className = 'profile-stat-value';
    valueElement.textContent = String(value);
    stat.appendChild(valueElement);

    const labelElement = document.createElement('div');
    labelElement.className = 'profile-stat-label';
    labelElement.textContent = label;
    stat.appendChild(labelElement);

    container.appendChild(stat);
}

function renderProfileDefaultAvatar(avatarWrapper) {
    Utils.clearChildren(avatarWrapper);
    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(null);
    img.alt = '';
    avatarWrapper.appendChild(img);
}

//  5. РЕНДЕРИНГ: РАСТЕНИЕ  //

function renderPlant() {
    renderPlantHeader();

    const container = Utils.getElement('profile-plant');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    // Если растение скрыто (чужой профиль, настройка приватности)
    if (pageState.plantHidden) {
        const hiddenMessage = document.createElement('p');
        hiddenMessage.className = 'muted-text';
        hiddenMessage.textContent = 'Растение скрыто';
        container.appendChild(hiddenMessage);
        return;
    }

    // Если данных нет
    if (!pageState.plant) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'muted-text';
        emptyMessage.textContent = 'Данные о растении недоступны';
        container.appendChild(emptyMessage);
        return;
    }

    const plant = pageState.plant;
    const stage = plant.stage || plant.plant_current_stage || PLANT_STAGE.SEED;
    const sessionCount = Number(plant.session_count_completed || plant.plant_total_sessions || 0);

    // Определяем следующую стадию
    const stageOrder = ['seed', 'sprout', 'young_plant', 'adult_plant', 'flowering', 'oak'];
    const currentIndex = stageOrder.indexOf(stage);
    const computedNextStage = currentIndex >= 0 && currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : null;
    const nextStage = plant.next_stage || computedNextStage;
    const computedSessionsToNext = nextStage ? (PLANT_STAGE_THRESHOLDS[nextStage] - sessionCount) : null;
    const sessionsToNext = plant.sessions_to_next !== null && plant.sessions_to_next !== undefined
        ? Number(plant.sessions_to_next)
        : computedSessionsToNext;

    const plantElement = renderPlantDisplay({
        stage: stage,
        imageUrl: plant.image_url || PLANT_IMAGE_URLS[stage],
        sessionCount: sessionCount,
        nextStage: nextStage,
        sessionsToNext: sessionsToNext > 0 ? sessionsToNext : 0,
        compact: true,
    });

    container.appendChild(plantElement);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderPlantHeader() {
    const titleElement = Utils.getElement('profile-plant-title');
    const linkElement = Utils.getElement('profile-plant-link');

    if (titleElement) {
        titleElement.textContent = pageState.isOwnProfile ? 'Ваш спутник' : 'Спутник читателя';
    }

    if (pageState.isOwnProfile) {
        Utils.showElement(linkElement);
    } else {
        Utils.hideElement(linkElement);
    }
}

//  6. РЕНДЕРИНГ: СТАТИСТИКА  //

function renderStats() {
    const container = Utils.getElement('profile-stats');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    // Если статистика скрыта (чужой профиль, настройка приватности)
    if (pageState.statsHidden) {
        const hiddenMessage = document.createElement('p');
        hiddenMessage.className = 'muted-text';
        hiddenMessage.textContent = 'Статистика скрыта';
        container.appendChild(hiddenMessage);
        return;
    }

    // Если данных нет
    if (!pageState.stats) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'muted-text';
        emptyMessage.textContent = 'Данные статистики недоступны';
        container.appendChild(emptyMessage);
        return;
    }

    const data = pageState.stats;

    const cards = [
        {
            label: 'Книг прочитано',
            value: String(data.books_finished || 0),
            icon: 'book-open',
            iconClass: 'stat-card-icon-books',
        },
        {
            label: 'Страниц',
            value: Utils.formatNumber(data.total_pages || 0),
            icon: 'file-text',
            iconClass: 'stat-card-icon-pages',
        },
        {
            label: 'Часов',
            value: String(Math.round((data.total_minutes || 0) / MINUTES_PER_HOUR)),
            icon: 'clock',
            iconClass: 'stat-card-icon-hours',
        },
        {
            label: 'Сессий',
            value: String(data.total_sessions || 0),
            icon: 'timer',
            iconClass: 'stat-card-icon-sessions',
        },
    ];

    const columns = document.createElement('div');
    columns.className = 'stat-cards';

    cards.forEach(function (card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'stat-card';

        const iconElement = document.createElement('div');
        iconElement.className = 'stat-card-icon ' + card.iconClass;

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', card.icon);
        iconElement.appendChild(icon);

        const valueElement = document.createElement('div');
        valueElement.className = 'stat-card-value';
        valueElement.textContent = card.value;

        const labelElement = document.createElement('div');
        labelElement.className = 'stat-card-label';
        labelElement.textContent = card.label;

        cardElement.appendChild(iconElement);
        cardElement.appendChild(valueElement);
        cardElement.appendChild(labelElement);
        columns.appendChild(cardElement);
    });

    container.appendChild(columns);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  7. РЕНДЕРИНГ: ПУБЛИКАЦИИ  //

function renderPublications() {
    const container = Utils.getElement('profile-publications');
    const paginationContainer = Utils.getElement('publications-pagination');
    const totalCountBadge = Utils.getElement('publications-count');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    // Обновляем счётчик
    if (totalCountBadge) {
        if (pageState.publicationsTotalCount > 0) {
            totalCountBadge.textContent = '(' + pageState.publicationsTotalCount + ')';
        } else {
            totalCountBadge.textContent = '';
        }
    }

    // Показываем форму создания публикации (только свой профиль)
    if (pageState.isOwnProfile) {
        const formSection = Utils.getElement('publication-form-section');
        Utils.showElement(formSection);
    }

    if (pageState.publications.length === 0) {
        if (typeof renderEmptyState === 'function') {
            container.appendChild(renderEmptyState({
                message: pageState.isOwnProfile
                    ? 'У вас пока нет публикаций'
                    : 'У пользователя нет публикаций',
                iconName: 'newspaper',
            }));
        }
    } else {
        const currentUserId = pageState.currentUser.id;

        pageState.publications.forEach(function (publication) {
            const card = renderPublicationCard(publication, currentUserId, {
                onDelete: ProfilePage.handleDeletePublication,
                onToggleComments: ProfilePage.handleToggleComments,
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

    container.appendChild(renderPagination({
        currentPage: pageState.publicationsPage,
        totalPages: pageState.publicationsTotalPages,
        onPageChange: function (newPage) {
            const userId = pageState.isOwnProfile ? null : pageState.profileUser.id;
            loadPublications(userId, newPage, true);
        },
        options: {
            totalCount: pageState.publicationsTotalCount,
            perPage: PROFILE_PUBLICATIONS_PER_PAGE,
            label: 'публикаций',
        },
    }));
}

//  8. РЕНДЕРИНГ: КОММЕНТАРИИ  //

function renderComments(publicationId, payload) {
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
            const commentElement = renderComment(comment, currentUserId, ProfilePage.handleDeleteComment);
            container.appendChild(commentElement);
        });
    }

    renderCommentsPagination(publicationId, payload, container);

    // Форма добавления комментария
    const form = renderCommentForm(publicationId, ProfilePage.handleCreateComment);
    container.appendChild(form);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderCommentsPagination(publicationId, payload, container) {
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
            loadComments(publicationId, newPage, true);
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
    scrollToElementTop(Utils.getElement('profile-publications'));
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

//  9. РЕНДЕРИНГ: ВЫБОР КНИГИ  //

function renderPublicationBookSearch() {
    const container = Utils.getElement('publication-book-search');

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

function destroy() {}

Object.assign(ProfilePage, {
    state: pageState,
    init: initProfilePage,
    destroy: destroy,
    loadProfileData: loadProfileData,
    loadPublications: loadPublications,
    loadComments: loadComments,
    renderProfileCard: renderProfileCard,
    renderPublications: renderPublications,
    renderPublicationBookSearch: renderPublicationBookSearch,
});
})();
