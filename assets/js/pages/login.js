/**
 *  СТРАНИЦА: Логика входа — валидация, аутентификация, редирект
 *
 * НАЗНАЧЕНИЕ:
 *   Проверяет гостевой доступ, валидирует форму входа, отправляет данные
 *   в AuthService, показывает cookie-уведомление и перенаправляет пользователя
 *   после успешной авторизации.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

let isSubmitting = false;

//  2. ИНИЦИАЛИЗАЦИЯ //

async function init() {
    initCookieNotice();

    // Если уже авторизован — редирект на библиотеку
    const session = await AuthGuard.requireGuest();
    if (!session) return;

    const form = Utils.getElement('login-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

//  3. ОБРАБОТЧИКИ СОБЫТИЙ  //

async function handleFormSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    clearErrors();

    const email = Utils.getElement('email').value.trim();
    const password = Utils.getElement('password').value;

    // Клиентская валидация
    let hasErrors = false;

    if (!email) {
        showFieldError('email', 'Email обязателен');
        hasErrors = true;
    }

    if (!password) {
        showFieldError('password', 'Пароль обязателен');
        hasErrors = true;
    }

    if (hasErrors) return;

    // Отправка
    isSubmitting = true;
    setButtonLoading(true);

    try {
        const data = await AuthService.login(email, password);

        // Обновление CSRF-токена после логина
        if (data.csrf_token) {
            ApiClient.setCsrfToken(data.csrf_token);
        }

        Notification.success('Вход выполнен!');
        PageRouter.open(PAGE_URL.LIBRARY);
    } catch (error) {
        handleServerErrors(error);
    } finally {
        isSubmitting = false;
        setButtonLoading(false);
    }
}

//  4. COOKIE-УВЕДОМЛЕНИЕ  //

function initCookieNotice() {
    const notice = Utils.getElement('cookie-notice');
    const closeButton = Utils.getElement('cookie-notice-close');

    if (!notice || !closeButton || isCookieNoticeClosed()) return;

    notice.hidden = false;
    closeButton.addEventListener('click', handleCookieNoticeClose);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function handleCookieNoticeClose() {
    const notice = Utils.getElement('cookie-notice');

    saveCookieNoticeClosed();

    if (notice) {
        notice.classList.add('is-hiding');
        window.setTimeout(function () {
            notice.hidden = true;
            notice.classList.remove('is-hiding');
        }, UI_TRANSITION_HIDE_DELAY_MS);
    }
}

function isCookieNoticeClosed() {
    try {
        return localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === 'true';
    } catch (error) {
        return false;
    }
}

function saveCookieNoticeClosed() {
    try {
        localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, 'true');
    } catch (error) {
        // localStorage недоступен — уведомление закроется только в текущей сессии.
    }
}

//  5. РАБОТА С ОШИБКАМИ  //

function showFieldError(fieldId, message) {
    Utils.showFieldError(fieldId, message);
}

function clearErrors() {
    Utils.clearFormErrors();
}

function handleServerErrors(error) {
    if (error.errors) {
        for (const [field, message] of Object.entries(error.errors)) {
            const fieldMap = {
                user_email: 'email',
                password: 'password',
            };
            const fieldId = fieldMap[field] || field;
            showFieldError(fieldId, message);
        }
    } else {
        const formError = Utils.getElement('form-error');
        if (formError) {
            formError.textContent = error.message;
            Utils.showElement(formError);
        }
    }
}

function setButtonLoading(isLoading) {
    const button = Utils.getElement('submit-button');
    if (button) {
        button.disabled = isLoading;
        setSubmitButtonContent(button, isLoading ? 'loader-circle' : 'log-in', isLoading ? 'Вход...' : 'Войти');
    }
}

function setSubmitButtonContent(button, iconName, label) {
    Utils.setIconText(button, iconName, label);
}

//  6. ЗАПУСК  //

function destroy() {
    const closeButton = Utils.getElement('cookie-notice-close');

    if (closeButton) {
        closeButton.removeEventListener('click', handleCookieNoticeClose);
    }
}

PageRegistry.register('login', {
    init: init,
    destroy: destroy,
});
})();
