/**
 *  СТРАНИЦА: Админ — редактирование пользователя 
 *
 * НАЗНАЧЕНИЕ:
 *   Полный UI редактирования профиля пользователя админом.
 *   Данные → форма; сохранение через AdminService.updateUser/updateRole/blockUser/unblockUser;
 *   удаление через AdminService.deleteUser.
 *   URL страницы: `admin-user-edit.html?user_id=N`.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ //

const pageState = {
    userId: null,
    user: null,
    isSaving: false,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initAdminUserEditPage() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    if (user.user_role !== 'admin') {
        Notification.error('Доступ только для администраторов');
        PageRouter.open(PAGE_URL.INDEX);
        return;
    }

    initNavigation(user);

    const rawUserId = Utils.getUrlParam('user_id');
    const parsedId = parseInt(rawUserId, 10);
    if (!parsedId || parsedId < 1) {
        Notification.error('Не указан пользователь');
        PageRouter.open(PAGE_URL.ADMIN_USERS);
        return;
    }
    pageState.userId = parsedId;

    await loadUser();
    setupEventListeners();
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadUser() {
    try {
        const data = await AdminService.getUser(pageState.userId);
        pageState.user = data;
        fillForm(data);
    } catch (error) {
        Notification.error('Не удалось загрузить пользователя: ' + (error.message || ''));
    }
}

//  4. ЗАПОЛНЕНИЕ ФОРМЫ  //

function fillForm(userData) {
    if (!userData) return;

    const firstNameEl = Utils.getElement('first-name-input');
    const lastNameEl = Utils.getElement('last-name-input');
    const profileIdEl = Utils.getElement('profile-identifier-input');
    const emailEl = Utils.getElement('email-input');
    const profileHiddenToggle = Utils.getElement('profile-hidden-toggle');

    if (firstNameEl) firstNameEl.value = Utils.safeText(userData.user_name_first, '');
    if (lastNameEl) lastNameEl.value = Utils.safeText(userData.user_name_last, '');
    if (profileIdEl) profileIdEl.value = Utils.safeText(userData.user_profile_identifier, '');
    if (emailEl) emailEl.value = Utils.safeText(userData.user_email, '');

    // Роль: радиокнопки.
    const role = Utils.safeText(userData.user_role, 'user');
    const roleRadios = document.querySelectorAll('input[name="user_role"]');
    roleRadios.forEach(function (radio) {
        radio.checked = (radio.value === role);
    });

    // Статус: чекбокс is-blocked инвертированный.
    const isBlocked = normalizeBoolean(userData.is_blocked);
    const statusToggle = Utils.getElement('status-toggle');
    if (statusToggle) {
        statusToggle.checked = !isBlocked;
    }
    if (profileHiddenToggle) {
        profileHiddenToggle.checked = normalizeBoolean(userData.is_profile_hidden);
    }

    // Блок-причина.
    const blockReasonInput = Utils.getElement('block-reason-input');
    if (blockReasonInput) {
        blockReasonInput.value = Utils.safeText(userData.user_blocked_reason, '');
    }

    updateStatusUI(!isBlocked);
    updateAvatarRemoveButton(userData);

    // Заголовок и breadcrumb.
    const fullName = (Utils.safeText(userData.user_name_first, '') + ' '
        + Utils.safeText(userData.user_name_last, '')).trim();
    const displayName = fullName !== ''
        ? fullName
        : Utils.safeText(userData.user_profile_identifier, Utils.safeText(userData.user_email, 'Пользователь'));

    const breadcrumb = Utils.getElement('breadcrumb-user-name');
    if (breadcrumb) breadcrumb.textContent = displayName;

    const title = Utils.getElement('page-title');
    if (title) title.textContent = displayName;

    renderAvatarPreview(userData, displayName);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function updateAvatarRemoveButton(userData) {
    const avatarRemove = Utils.getElement('avatar-remove-button');
    if (!avatarRemove) return;

    avatarRemove.classList.toggle('is-hidden', !userData.user_avatar_path);
}

function renderAvatarPreview(userData, displayName) {
    const avatarPreview = Utils.getElement('avatar-preview');
    if (!avatarPreview) return;

    Utils.clearChildren(avatarPreview);

    if (!userData.user_avatar_path) {
        avatarPreview.classList.add('is-empty');
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'user');
        avatarPreview.appendChild(icon);
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
        return;
    }

    avatarPreview.classList.remove('is-empty');
    const img = document.createElement('img');
    img.src = userData.user_avatar_path;
    img.alt = displayName;
    img.className = 'avatar-preview-img';
    avatarPreview.appendChild(img);
}

function updateStatusUI(isActive) {
    const indicator = Utils.getElement('status-indicator');
    const statusText = Utils.getElement('status-text');
    const reasonWrap = Utils.getElement('block-reason-wrap');

    if (indicator) {
        indicator.classList.toggle('is-active', !!isActive);
        indicator.classList.toggle('is-blocked', !isActive);
    }
    if (statusText) {
        statusText.textContent = isActive ? 'Активен' : 'Заблокирован';
    }
    if (reasonWrap) {
        if (isActive) {
            reasonWrap.classList.add('is-hidden');
        } else {
            reasonWrap.classList.remove('is-hidden');
        }
    }
}

function normalizeBoolean(value) {
    return value === true || value === 1 || value === '1';
}

//  5. СБОР ДАННЫХ И ВАЛИДАЦИЯ  //

function collectFormData() {
    const firstNameEl = Utils.getElement('first-name-input');
    const lastNameEl = Utils.getElement('last-name-input');
    const profileIdEl = Utils.getElement('profile-identifier-input');
    const emailEl = Utils.getElement('email-input');
    const statusToggle = Utils.getElement('status-toggle');
    const profileHiddenToggle = Utils.getElement('profile-hidden-toggle');
    const blockReasonInput = Utils.getElement('block-reason-input');

    const profile = {
        user_name_first: firstNameEl ? firstNameEl.value.trim() : '',
        user_name_last: lastNameEl ? lastNameEl.value.trim() : '',
        user_profile_identifier: profileIdEl ? profileIdEl.value.trim() : '',
        user_email: emailEl ? emailEl.value.trim() : '',
        is_profile_hidden: profileHiddenToggle ? profileHiddenToggle.checked : false,
    };

    let role = 'user';
    const checked = document.querySelector('input[name="user_role"]:checked');
    if (checked) role = checked.value;

    const isActive = statusToggle ? !!statusToggle.checked : true;
    const blockReason = blockReasonInput ? blockReasonInput.value.trim() : '';

    return { profile, role, isActive, blockReason };
}

//  6. ОБРАБОТЧИКИ  //

function handleStatusToggleChange() {
    const statusToggle = Utils.getElement('status-toggle');
    if (!statusToggle) return;
    updateStatusUI(statusToggle.checked);
}

async function handleSave() {
    if (pageState.isSaving) return;
    if (!pageState.user) {
        Notification.error('Данные пользователя не загружены');
        return;
    }

    const form = collectFormData();
    pageState.isSaving = true;

    try {
        // 1) Обновление основных полей.
        const profileChanged = (
            form.profile.user_name_first !== Utils.safeText(pageState.user.user_name_first, '')
            || form.profile.user_name_last !== Utils.safeText(pageState.user.user_name_last, '')
            || form.profile.user_profile_identifier !== Utils.safeText(pageState.user.user_profile_identifier, '')
            || form.profile.user_email !== Utils.safeText(pageState.user.user_email, '')
            || form.profile.is_profile_hidden !== normalizeBoolean(pageState.user.is_profile_hidden)
        );
        if (profileChanged) {
            await AdminService.updateUser(pageState.userId, form.profile);
        }

        // 2) Обновление роли.
        const currentRole = Utils.safeText(pageState.user.user_role, 'user');
        if (form.role !== currentRole) {
            await AdminService.updateRole(pageState.userId, form.role);
        }

        // 3) Обновление статуса блокировки.
        const wasBlocked = normalizeBoolean(pageState.user.is_blocked);
        const willBeBlocked = !form.isActive;

        if (willBeBlocked && !wasBlocked) {
            await AdminService.blockUser(pageState.userId, form.blockReason || null);
        } else if (!willBeBlocked && wasBlocked) {
            await AdminService.unblockUser(pageState.userId);
        } else if (willBeBlocked && wasBlocked) {
            // Если изменилась причина — повторный block_user (бэкенд idempotent).
            const oldReason = Utils.safeText(pageState.user.user_blocked_reason, '');
            if (form.blockReason !== oldReason) {
                await AdminService.blockUser(pageState.userId, form.blockReason || null);
            }
        }

        Notification.success('Изменения сохранены');
        await loadUser();
    } catch (error) {
        Notification.error('Не удалось сохранить: ' + (error.message || ''));
    } finally {
        pageState.isSaving = false;
    }
}

async function handleDelete() {
    const confirmed = await AppConfirm.ask({
        title: 'Удалить пользователя',
        message: 'Удалить пользователя? Действие необратимо.',
        confirmLabel: 'Удалить',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        await AdminService.deleteUser(pageState.userId);
        Notification.success('Пользователь удалён');
        PageRouter.open(PAGE_URL.ADMIN_USERS);
    } catch (error) {
        Notification.error('Не удалось удалить: ' + (error.message || ''));
    }
}

function handleAvatarUpload() {
    const input = Utils.getElement('avatar-file-input');
    if (input) input.click();
}

async function handleAvatarFileChange() {
    const input = Utils.getElement('avatar-file-input');
    if (!input || !input.files || input.files.length === 0) return;

    try {
        const userData = await AdminService.uploadUserAvatar(pageState.userId, input.files[0]);
        pageState.user = userData;
        fillForm(userData);
        Notification.success('Аватар обновлён');
    } catch (error) {
        Notification.error('Не удалось загрузить аватар: ' + (error.message || ''));
    } finally {
        input.value = '';
    }
}

async function handleAvatarRemove() {
    if (!pageState.user || !pageState.user.user_avatar_path) {
        Notification.info('У пользователя нет загруженного аватара');
        return;
    }

    const confirmed = await AppConfirm.ask({
        title: 'Удалить аватар',
        message: 'Удалить аватар пользователя?',
        confirmLabel: 'Удалить',
        isDanger: true,
    });
    if (!confirmed) return;

    try {
        const userData = await AdminService.removeUserAvatar(pageState.userId);
        pageState.user = userData;
        fillForm(userData);
        Notification.success('Аватар удалён');
    } catch (error) {
        Notification.error('Не удалось удалить аватар: ' + (error.message || ''));
    }
}

// 7. ПРИВЯЗКА СОБЫТИЙ  //

function setupEventListeners() {
    const statusToggle = Utils.getElement('status-toggle');
    if (statusToggle) {
        statusToggle.addEventListener('change', handleStatusToggleChange);
    }

    const saveButton = Utils.getElement('save-button');
    if (saveButton) {
        saveButton.addEventListener('click', handleSave);
    }

    const deleteButton = Utils.getElement('delete-user-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', handleDelete);
    }

    const avatarUpload = Utils.getElement('avatar-upload-button');
    if (avatarUpload) {
        avatarUpload.addEventListener('click', handleAvatarUpload);
    }

    const avatarInput = Utils.getElement('avatar-file-input');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarFileChange);
    }

    const avatarRemove = Utils.getElement('avatar-remove-button');
    if (avatarRemove) {
        avatarRemove.addEventListener('click', handleAvatarRemove);
    }
}

//  8. ЗАПУСК  //

function destroy() {}

PageRegistry.register('admin-user-edit', {
    init: initAdminUserEditPage,
    destroy: destroy,
});
})();
