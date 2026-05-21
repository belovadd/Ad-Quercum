/**
 *  СТРАНИЦА (продолжение): Клуб — обработчики событий и привязка 
 *
 * НАЗНАЧЕНИЕ:
 *   Логически продолжает `club.js`. Обработчики UI-событий (CRUD клуба,
 *   изображение, участники, публикации, комментарии) и привязка слушателей.
 *   Совместно с `club.js` работает через явный namespace `ClubPage`.
 */

(function () {
'use strict';

const ClubPage = window.ClubPage;
const pageState = ClubPage.state;
const loadClub = ClubPage.loadClub;
const loadJoinRequests = ClubPage.loadJoinRequests;
const loadMembers = ClubPage.loadMembers;
const loadPublications = ClubPage.loadPublications;
const loadPublicationComments = ClubPage.loadPublicationComments;


//  10. ОБРАБОТЧИКИ  //

async function handleUpdateClub(event) {
    event.preventDefault();

    const nameInput = Utils.getElement('edit-club-name');
    const descriptionInput = Utils.getElement('edit-club-description');
    const publicCheckbox = Utils.getElement('edit-club-public');

    const isCreator = pageState.currentUserRole === CLUB_ROLE.CREATOR;
    const clubName = nameInput ? nameInput.value.trim() : '';

    if (isCreator && !clubName) {
        Notification.error('Введите название клуба');
        return;
    }

    const payload = {
        club_description: descriptionInput ? (descriptionInput.value.trim() || null) : null,
    };

    if (isCreator) {
        payload.club_name = clubName;
        payload.is_public = publicCheckbox ? publicCheckbox.checked : true;
    }

    try {
        await ClubService.updateClub(pageState.clubId, payload);

        Notification.success('Клуб обновлён');
        handleToggleEdit();
        await loadClub();
    } catch (error) {
        Notification.error(error.message || 'Не удалось обновить клуб');
    }
}

async function handleDeleteClub() {
    const confirmed = await AppConfirm.ask({
        title: 'Удалить клуб',
        message: 'Вы уверены, что хотите удалить этот клуб? Это действие необратимо.',
        confirmLabel: 'Удалить',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await ClubService.deleteClub(pageState.clubId);
        Notification.success('Клуб удалён');
        PageRouter.open(PAGE_URL.CLUBS);
    } catch (error) {
        Notification.error(error.message || 'Не удалось удалить клуб');
    }
}

async function handleUploadImage(event) {
    event.preventDefault();

    const fileInput = Utils.getElement('club-image-input');
    const fileNameDisplay = Utils.getElement('club-image-filename');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        Notification.error('Выберите файл');
        return;
    }

    try {
        await ClubService.uploadImage(pageState.clubId, fileInput.files[0]);
        Notification.success('Изображение загружено');
        fileInput.value = '';
        if (fileNameDisplay) fileNameDisplay.textContent = 'Файл не выбран';
        handleToggleUpload();
        await loadClub();
    } catch (error) {
        Notification.error(error.message || 'Не удалось загрузить изображение');
    }
}

async function handleJoinClub() {
    try {
        await ClubService.joinClub(pageState.clubId);
        Notification.success('Вы вступили в клуб');
        await loadClub();
    } catch (error) {
        Notification.error(error.message || 'Не удалось вступить в клуб');
    }
}

async function handleLeaveClub() {
    const confirmed = await AppConfirm.ask({
        title: 'Покинуть клуб',
        message: 'Вы уверены, что хотите покинуть клуб?',
        confirmLabel: 'Покинуть',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await ClubService.leaveClub(pageState.clubId);
        Notification.success('Вы покинули клуб');
        await loadClub();
    } catch (error) {
        Notification.error(error.message || 'Не удалось покинуть клуб');
    }
}

async function handleRemoveMember(userId) {
    const confirmed = await AppConfirm.ask({
        title: 'Исключить участника',
        message: 'Исключить этого участника?',
        confirmLabel: 'Исключить',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await ClubService.removeMember(pageState.clubId, userId);
        Notification.success('Участник исключён');
        await loadMembers();
    } catch (error) {
        Notification.error(error.message || 'Не удалось исключить участника');
    }
}

async function handleChangeRole(userId, newRole) {
    try {
        await ClubService.changeRole(pageState.clubId, userId, newRole);
        Notification.success('Роль изменена');
        await loadMembers();
    } catch (error) {
        Notification.error(error.message || 'Не удалось изменить роль');
    }
}

async function handleAcceptJoinRequest(requestId) {
    try {
        await ClubService.acceptJoinRequest(requestId);
        Notification.success('Заявка принята');
        await loadClub();
    } catch (error) {
        Notification.error(error.message || 'Не удалось принять заявку');
    }
}

async function handleRejectJoinRequest(requestId) {
    const confirmed = await AppConfirm.ask({
        title: 'Отклонить заявку',
        message: 'Отклонить эту заявку на вступление?',
        confirmLabel: 'Отклонить',
        cancelLabel: 'Отмена',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await ClubService.rejectJoinRequest(requestId);
        Notification.success('Заявка отклонена');
        await loadJoinRequests();
    } catch (error) {
        Notification.error(error.message || 'Не удалось отклонить заявку');
    }
}

function handleToggleEdit() {
    const section = Utils.getElement('edit-club-section');

    if (!section) {
        return;
    }

    const isHidden = section.classList.contains('is-hidden');

    if (isHidden && pageState.club) {
        // Заполняем форму текущими данными
        const nameInput = Utils.getElement('edit-club-name');
        const descriptionInput = Utils.getElement('edit-club-description');
        const publicCheckbox = Utils.getElement('edit-club-public');
        const nameField = nameInput ? nameInput.closest('.form-field') : null;
        const publicField = publicCheckbox ? publicCheckbox.closest('.form-field') : null;
        const isCreator = pageState.currentUserRole === CLUB_ROLE.CREATOR;

        if (nameInput) {
            nameInput.value = pageState.club.club_name || '';
            nameInput.required = isCreator;
        }

        if (descriptionInput) {
            descriptionInput.value = pageState.club.club_description || '';
        }

        if (publicCheckbox) {
            publicCheckbox.checked = Number(pageState.club.is_public) === 1;
        }

        if (nameField) {
            nameField.classList.toggle('is-hidden', !isCreator);
        }

        if (publicField) {
            publicField.classList.toggle('is-hidden', !isCreator);
        }

        section.classList.remove('is-hidden');
    } else {
        section.classList.add('is-hidden');
    }
}

function handleToggleUpload() {
    const section = Utils.getElement('upload-image-section');

    if (!section) {
        return;
    }

    if (section.classList.contains('is-hidden')) {
        section.classList.remove('is-hidden');
    } else {
        section.classList.add('is-hidden');
    }
}

async function handleCreatePublication() {
    const textInput = Utils.getElement('club-publication-text');

    if (!textInput) {
        return;
    }

    const text = textInput.value.trim();

    if (text === '') {
        Notification.error('Введите текст публикации');
        return;
    }

    if (text.length > MAX_PUBLICATION_TEXT_LENGTH) {
        Notification.error('Текст публикации слишком длинный (максимум ' + MAX_PUBLICATION_TEXT_LENGTH + ' символов)');
        return;
    }

    const bookId = pageState.selectedPublicationBook
        ? Number(pageState.selectedPublicationBook.id)
        : null;

    try {
        await ClubService.createClubPublication(pageState.clubId, text, bookId);
        Notification.success('Публикация создана');

        textInput.value = '';
        pageState.selectedPublicationBook = null;
        if (ClubPage.renderPublicationBookSearch) {
            ClubPage.renderPublicationBookSearch();
        }

        // Перезагружаем публикации на первую страницу
        await loadPublications(1);
    } catch (error) {
        Notification.error(error.message || 'Не удалось создать публикацию');
    }
}

async function handleDeletePublication(publicationId) {
    const confirmed = await AppConfirm.ask({
        title: 'Удалить публикацию',
        message: 'Удалить эту публикацию?',
        confirmLabel: 'Удалить',
        cancelLabel: 'Отмена',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await ClubService.deleteClubPublication(publicationId);
        Notification.success('Публикация удалена');
        await loadPublications();
    } catch (error) {
        Notification.error(error.message || 'Не удалось удалить публикацию');
    }
}

async function handleToggleComments(publicationId) {
    const container = Utils.getElement('comments-' + publicationId);

    if (!container) {
        return;
    }

    container.classList.remove('is-hidden');
    pageState.openComments[publicationId] = true;
    await loadPublicationComments(publicationId, 'last');
}

async function handleCreateComment(publicationId, text) {
    try {
        await ClubService.createClubComment(publicationId, text);
        Notification.success('Комментарий добавлен');

        // Обновляем счётчик комментариев в списке публикаций
        await loadPublications();
    } catch (error) {
        Notification.error(error.message || 'Не удалось добавить комментарий');
    }
}

async function handleDeleteComment(commentId, publicationId) {
    const confirmed = await AppConfirm.ask({
        title: 'Удалить комментарий',
        message: 'Удалить этот комментарий?',
        confirmLabel: 'Удалить',
        cancelLabel: 'Отмена',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await ClubService.deleteClubComment(commentId);
        Notification.success('Комментарий удалён');

        // Перезагружаем публикации (для обновления счётчиков)
        await loadPublications();

    } catch (error) {
        Notification.error(error.message || 'Не удалось удалить комментарий');
    }
}

//  11. ПРИВЯЗКА СОБЫТИЙ  //

function bindEvents() {
    const editForm = Utils.getElement('edit-club-form');
    const cancelEditButton = Utils.getElement('cancel-edit-button');
    const uploadForm = Utils.getElement('upload-image-form');
    const cancelUploadButton = Utils.getElement('cancel-upload-button');
    const toggleMembersButton = Utils.getElement('toggle-members-button');

    if (editForm) {
        editForm.addEventListener('submit', handleUpdateClub);
    }

    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', handleToggleEdit);
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUploadImage);
    }

    if (cancelUploadButton) {
        cancelUploadButton.addEventListener('click', handleToggleUpload);
    }

    if (toggleMembersButton && ClubPage.toggleMembersPanel) {
        toggleMembersButton.addEventListener('click', ClubPage.toggleMembersPanel);
    }

    // Отображение имени выбранного файла рядом с полем загрузки.
    const fileInput = Utils.getElement('club-image-input');
    const fileNameDisplay = Utils.getElement('club-image-filename');
    const chooseFileButton = Utils.getElement('club-image-choose-button');

    if (fileInput && chooseFileButton) {
        chooseFileButton.addEventListener('click', function () {
            fileInput.click();
        });
    }

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = fileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = 'Файл не выбран';
            }
        });
    }

    // Кнопка публикации в клубе
    const publishButton = Utils.getElement('club-publish-button');

    if (publishButton) {
        publishButton.addEventListener('click', handleCreatePublication);
    }

    // Ctrl+Enter в textarea публикации для быстрой отправки
    const publicationTextInput = Utils.getElement('club-publication-text');

    if (publicationTextInput) {
        publicationTextInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey && event.key === 'Enter') {
                handleCreatePublication();
            }
        });
    }
}

//  12. ЗАПУСК  //

Object.assign(ClubPage, {
    bindEvents: bindEvents,
    handleUpdateClub: handleUpdateClub,
    handleDeleteClub: handleDeleteClub,
    handleUploadImage: handleUploadImage,
    handleJoinClub: handleJoinClub,
    handleLeaveClub: handleLeaveClub,
    handleRemoveMember: handleRemoveMember,
    handleChangeRole: handleChangeRole,
    handleAcceptJoinRequest: handleAcceptJoinRequest,
    handleRejectJoinRequest: handleRejectJoinRequest,
    handleToggleEdit: handleToggleEdit,
    handleToggleUpload: handleToggleUpload,
    handleCreatePublication: handleCreatePublication,
    handleDeletePublication: handleDeletePublication,
    handleToggleComments: handleToggleComments,
    handleCreateComment: handleCreateComment,
    handleDeleteComment: handleDeleteComment,
});

PageRegistry.register('club', {
    init: ClubPage.init,
    destroy: ClubPage.destroy,
});
})();
