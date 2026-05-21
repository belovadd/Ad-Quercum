/**
 *  СТРАНИЦА (продолжение): Профиль — обработчики событий и привязка
 *
 * НАЗНАЧЕНИЕ:
 *   Логически продолжает `profile.js`: заполняет формы редактирования и
 *   приватности, содержит обработчики UI-событий и привязку слушателей к DOM.
 *   Совместно с `profile.js` работает через явный namespace `ProfilePage`.
 */

(function () {
'use strict';

const ProfilePage = window.ProfilePage;
const pageState = ProfilePage.state;
const loadProfileData = ProfilePage.loadProfileData;
const loadPublications = ProfilePage.loadPublications;
const loadComments = ProfilePage.loadComments;
const renderProfileCard = ProfilePage.renderProfileCard;
const renderPublications = ProfilePage.renderPublications;
const baseDestroy = ProfilePage.destroy;


// 10. РЕНДЕРИНГ: ФОРМА РЕДАКТИРОВАНИЯ  //

function renderEditForm() {
    if (!pageState.profileUser) {
        return;
    }

    const profile = pageState.profileUser;

    const firstNameInput = Utils.getElement('edit-first-name');
    const lastNameInput = Utils.getElement('edit-last-name');
    const identifierInput = Utils.getElement('edit-identifier');
    const locationInput = Utils.getElement('edit-location');
    const statusInput = Utils.getElement('edit-status');
    const bioInput = Utils.getElement('edit-bio');
    const avatarInput = Utils.getElement('edit-avatar');
    const avatarFilename = Utils.getElement('edit-avatar-filename');
    const currentPasswordInput = Utils.getElement('edit-current-password');
    const newPasswordInput = Utils.getElement('edit-new-password');
    const confirmPasswordInput = Utils.getElement('edit-confirm-password');

    if (firstNameInput) {
        firstNameInput.value = profile.user_name_first || '';
    }

    if (lastNameInput) {
        lastNameInput.value = profile.user_name_last || '';
    }

    if (identifierInput) {
        identifierInput.value = profile.user_profile_identifier || '';
    }

    if (locationInput) {
        locationInput.value = profile.user_location || '';
    }

    if (statusInput) {
        statusInput.value = profile.user_status || '';
    }

    if (bioInput) {
        bioInput.value = profile.user_bio || '';
    }

    if (avatarInput) {
        avatarInput.value = '';
    }

    if (avatarFilename) {
        avatarFilename.textContent = 'Файл не выбран';
    }

    [currentPasswordInput, newPasswordInput, confirmPasswordInput].forEach(function (input) {
        if (input) {
            input.value = '';
            input.classList.remove('is-error');
        }
    });
    clearPasswordErrors();
}

//  11. РЕНДЕРИНГ: ПРИВАТНОСТЬ  //

function renderPrivacySettings() {
    if (!pageState.profileUser) {
        return;
    }

    const profile = pageState.profileUser;

    const statsCheckbox = Utils.getElement('toggle-stats-hidden');
    const libraryCheckbox = Utils.getElement('toggle-library-hidden');
    const collectionsCheckbox = Utils.getElement('toggle-collections-hidden');
    const plantCheckbox = Utils.getElement('toggle-plant-hidden');

    if (statsCheckbox) {
        statsCheckbox.checked = (profile.is_stats_hidden === 1 || profile.is_stats_hidden === true || profile.is_stats_hidden === '1');
    }

    if (libraryCheckbox) {
        libraryCheckbox.checked = (profile.is_library_hidden === 1 || profile.is_library_hidden === true || profile.is_library_hidden === '1');
    }

    if (collectionsCheckbox) {
        collectionsCheckbox.checked = (profile.is_collections_hidden === 1 || profile.is_collections_hidden === true || profile.is_collections_hidden === '1');
    }

    if (plantCheckbox) {
        plantCheckbox.checked = (profile.is_plant_hidden === 1 || profile.is_plant_hidden === true || profile.is_plant_hidden === '1');
    }
}

//  12. ОБРАБОТЧИКИ  //

function handleToggleEdit() {
    if (pageState.isEditing) {
        closeProfileEditModal();
        return;
    }

    openProfileEditModal();
}

function openProfileEditModal() {
    const modal = Utils.getElement('edit-profile-modal');

    if (!modal) {
        return;
    }

    pageState.isEditing = true;
    renderEditForm();
    Utils.showElement(modal);

    const firstNameInput = Utils.getElement('edit-first-name');
    if (firstNameInput) {
        firstNameInput.focus();
    }
}

function closeProfileEditModal() {
    pageState.isEditing = false;
    const modal = Utils.getElement('edit-profile-modal');
    Utils.hideElement(modal);
}

function handleEditModalBackdropClick(event) {
    if (event.target === event.currentTarget) {
        closeProfileEditModal();
    }
}

function handleEditModalKeydown(event) {
    if (event.key === 'Escape' && pageState.isEditing) {
        closeProfileEditModal();
    }
}

async function handleSaveProfile() {
    const firstNameInput = Utils.getElement('edit-first-name');
    const lastNameInput = Utils.getElement('edit-last-name');
    const identifierInput = Utils.getElement('edit-identifier');
    const locationInput = Utils.getElement('edit-location');
    const statusInput = Utils.getElement('edit-status');
    const bioInput = Utils.getElement('edit-bio');
    const avatarInput = Utils.getElement('edit-avatar');

    try {
        const passwordData = getPasswordChangeData();
        if (!validatePasswordChange(passwordData)) {
            return;
        }

        if (passwordData.shouldChange) {
            await AuthService.changePassword(
                passwordData.currentPassword,
                passwordData.newPassword,
                passwordData.confirmPassword
            );
        }

        // Обновляем текстовые данные профиля
        const profileData = {
            user_name_first: firstNameInput ? firstNameInput.value.trim() : '',
            user_name_last: lastNameInput ? lastNameInput.value.trim() : '',
            user_profile_identifier: identifierInput ? identifierInput.value.trim() : '',
            user_location: locationInput ? locationInput.value.trim() : '',
            user_status: statusInput ? statusInput.value.trim() : '',
            user_bio: bioInput ? bioInput.value.trim() : '',
        };

        await AuthService.updateProfile(profileData);

        // Загружаем аватар, если выбран файл
        if (avatarInput && avatarInput.files && avatarInput.files.length > 0) {
            await AuthService.uploadAvatar(avatarInput.files[0]);
        }

        Notification.success(passwordData.shouldChange ? 'Профиль и пароль обновлены' : 'Профиль обновлён');

        // Перезагружаем данные профиля
        await loadProfileData(null);

        closeProfileEditModal();

        // Обновляем навигацию с новым именем
        const session = await AuthGuard.checkAuth();
        if (session.is_authenticated) {
            pageState.currentUser = session.user;
            initNavigation(session.user);
        }
    } catch (error) {
        showPasswordServerError(error);
        Notification.error(error.message || 'Не удалось обновить профиль');
    }
}

function getPasswordChangeData() {
    const currentPasswordInput = Utils.getElement('edit-current-password');
    const newPasswordInput = Utils.getElement('edit-new-password');
    const confirmPasswordInput = Utils.getElement('edit-confirm-password');

    const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
    const newPassword = newPasswordInput ? newPasswordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';

    return {
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword,
        shouldChange: currentPassword !== '' || newPassword !== '' || confirmPassword !== '',
    };
}

function validatePasswordChange(passwordData) {
    clearPasswordErrors();

    if (!passwordData.shouldChange) {
        return true;
    }

    let isValid = true;

    if (!passwordData.currentPassword) {
        showPasswordFieldError('current', 'Введите текущий пароль');
        isValid = false;
    }

    if (!passwordData.newPassword) {
        showPasswordFieldError('new', 'Введите новый пароль');
        isValid = false;
    } else if (passwordData.newPassword.length < MIN_PASSWORD_LENGTH) {
        showPasswordFieldError('new', 'Минимум ' + MIN_PASSWORD_LENGTH + ' символов');
        isValid = false;
    } else if (passwordData.newPassword.length > MAX_PASSWORD_LENGTH) {
        showPasswordFieldError('new', 'Максимум ' + MAX_PASSWORD_LENGTH + ' символов');
        isValid = false;
    }

    if (!passwordData.confirmPassword) {
        showPasswordFieldError('confirm', 'Повторите новый пароль');
        isValid = false;
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
        showPasswordFieldError('confirm', 'Пароли не совпадают');
        isValid = false;
    }

    return isValid;
}

function showPasswordServerError(error) {
    const errors = error && error.errors ? error.errors : {};

    if (errors.current_password) {
        showPasswordFieldError('current', errors.current_password);
    }
    if (errors.new_password) {
        showPasswordFieldError('new', errors.new_password);
    }
    if (errors.confirm_password) {
        showPasswordFieldError('confirm', errors.confirm_password);
    }

    if (!errors.current_password && !errors.new_password && !errors.confirm_password) {
        const message = error && error.message ? error.message : '';
        if (message.indexOf('Текущий пароль') !== -1) {
            showPasswordFieldError('current', message);
        } else if (message.indexOf('Новый пароль') !== -1) {
            showPasswordFieldError('new', message);
        }
    }
}

function showPasswordFieldError(field, message) {
    const inputMap = {
        current: 'edit-current-password',
        new: 'edit-new-password',
        confirm: 'edit-confirm-password',
    };
    const errorMap = {
        current: 'edit-current-password-error',
        new: 'edit-new-password-error',
        confirm: 'edit-confirm-password-error',
    };

    const input = Utils.getElement(inputMap[field]);
    const error = Utils.getElement(errorMap[field]);

    if (input) {
        input.classList.add('is-error');
    }
    if (error) {
        error.textContent = message;
    }
}

function clearPasswordErrors() {
    ['current', 'new', 'confirm'].forEach(function (field) {
        showPasswordFieldError(field, '');
    });

    ['edit-current-password', 'edit-new-password', 'edit-confirm-password'].forEach(function (id) {
        const input = Utils.getElement(id);
        if (input) {
            input.classList.remove('is-error');
        }
    });
}

function handleCancelEdit() {
    closeProfileEditModal();
}

async function handleSavePrivacy() {
    const statsCheckbox = Utils.getElement('toggle-stats-hidden');
    const libraryCheckbox = Utils.getElement('toggle-library-hidden');
    const collectionsCheckbox = Utils.getElement('toggle-collections-hidden');
    const plantCheckbox = Utils.getElement('toggle-plant-hidden');

    try {
        const privacyData = {
            is_stats_hidden: statsCheckbox ? statsCheckbox.checked : false,
            is_library_hidden: libraryCheckbox ? libraryCheckbox.checked : false,
            is_collections_hidden: collectionsCheckbox ? collectionsCheckbox.checked : false,
            is_plant_hidden: plantCheckbox ? plantCheckbox.checked : false,
        };

        await AuthService.updateProfile(privacyData);
        Notification.success('Настройки приватности сохранены');

        // Перезагружаем профиль для обновления данных
        await loadProfileData(null);
    } catch (error) {
        Notification.error(error.message || 'Не удалось сохранить настройки приватности');
    }
}

async function handlePublish() {
    const textInput = Utils.getElement('publication-text');

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
        await SocialService.createPublication(text, bookId);
        Notification.success('Публикация создана');

        textInput.value = '';
        pageState.selectedPublicationBook = null;
        if (ProfilePage.renderPublicationBookSearch) {
            ProfilePage.renderPublicationBookSearch();
        }

        // Перезагружаем публикации на первую страницу
        await loadPublications(null, 1);
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
        await SocialService.deletePublication(publicationId);
        Notification.success('Публикация удалена');

        const userId = pageState.isOwnProfile ? null : pageState.profileUser.id;
        await loadPublications(userId);
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
    await loadComments(publicationId, 'last');
}

async function handleCreateComment(publicationId, text) {
    try {
        await SocialService.createComment(publicationId, text);
        Notification.success('Комментарий добавлен');

        // Обновляем публикации для обновления счётчиков
        const userId = pageState.isOwnProfile ? null : pageState.profileUser.id;
        await loadPublications(userId);
    } catch (error) {
        Notification.error(error.message || 'Не удалось добавить комментарий');
    }
}

async function handleDeleteComment(commentId) {
    const confirmed = await AppConfirm.ask({
        title: 'Удалить комментарий',
        message: 'Удалить этот комментарий?',
        confirmLabel: 'Удалить',
        cancelLabel: 'Отмена',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await SocialService.deleteComment(commentId);
        Notification.success('Комментарий удалён');

        // Перезагружаем публикации (для обновления счётчиков)
        const userId = pageState.isOwnProfile ? null : pageState.profileUser.id;
        await loadPublications(userId);

    } catch (error) {
        Notification.error(error.message || 'Не удалось удалить комментарий');
    }
}

//  13. ПРИВЯЗКА СОБЫТИЙ  //

function bindEvents() {
    const editProfileModal = Utils.getElement('edit-profile-modal');
    if (editProfileModal) {
        editProfileModal.addEventListener('click', handleEditModalBackdropClick);
    }

    const closeEditModalButton = Utils.getElement('close-edit-modal-button');
    if (closeEditModalButton) {
        closeEditModalButton.addEventListener('click', closeProfileEditModal);
    }

    const avatarInput = Utils.getElement('edit-avatar');
    const avatarChooseButton = Utils.getElement('edit-avatar-choose-button');
    const avatarFilename = Utils.getElement('edit-avatar-filename');

    if (avatarInput && avatarChooseButton) {
        avatarChooseButton.addEventListener('click', function () {
            avatarInput.click();
        });
    }

    if (avatarInput && avatarFilename) {
        avatarInput.addEventListener('change', function () {
            avatarFilename.textContent = avatarInput.files.length > 0
                ? avatarInput.files[0].name
                : 'Файл не выбран';
        });
    }

    document.removeEventListener('keydown', handleEditModalKeydown);
    document.addEventListener('keydown', handleEditModalKeydown);

    // Кнопка сохранения профиля
    const saveProfileButton = Utils.getElement('save-profile-button');
    if (saveProfileButton) {
        saveProfileButton.addEventListener('click', handleSaveProfile);
    }

    // Кнопка отмены редактирования
    const cancelEditButton = Utils.getElement('cancel-edit-button');
    if (cancelEditButton) {
        cancelEditButton.addEventListener('click', handleCancelEdit);
    }

    // Кнопка сохранения приватности
    const savePrivacyButton = Utils.getElement('save-privacy-button');
    if (savePrivacyButton) {
        savePrivacyButton.addEventListener('click', handleSavePrivacy);
    }

    // Кнопка публикации
    const publishButton = Utils.getElement('publish-button');
    if (publishButton) {
        publishButton.addEventListener('click', handlePublish);
    }

    // Ctrl+Enter в textarea для быстрой публикации
    const textInput = Utils.getElement('publication-text');
    if (textInput) {
        textInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey && event.key === 'Enter') {
                handlePublish();
            }
        });
    }
}

function destroy() {
    document.removeEventListener('keydown', handleEditModalKeydown);
    closeProfileEditModal();

    if (typeof baseDestroy === 'function') {
        baseDestroy();
    }
}

//  14. ЗАПУСК  //

Object.assign(ProfilePage, {
    bindEvents: bindEvents,
    destroy: destroy,
    renderEditForm: renderEditForm,
    renderPrivacySettings: renderPrivacySettings,
    handleToggleEdit: handleToggleEdit,
    handleSaveProfile: handleSaveProfile,
    handleCancelEdit: handleCancelEdit,
    handleSavePrivacy: handleSavePrivacy,
    handlePublish: handlePublish,
    handleDeletePublication: handleDeletePublication,
    handleToggleComments: handleToggleComments,
    handleCreateComment: handleCreateComment,
    handleDeleteComment: handleDeleteComment,
});

PageRegistry.register('profile', {
    init: ProfilePage.init,
    destroy: ProfilePage.destroy,
});
})();
