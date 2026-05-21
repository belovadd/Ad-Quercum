/**
 *  СТРАНИЦА: Логика регистрации — валидация формы, отправка, обработка ошибок 
 *
 * НАЗНАЧЕНИЕ:
 *   Проверяет гостевой доступ, валидирует регистрационную форму, отправляет
 *   данные в AuthService и показывает ошибки полей в едином формате.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

let isSubmitting = false;

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    syncPasswordHints();

    // Если уже авторизован — редирект на библиотеку
    const session = await AuthGuard.requireGuest();
    if (!session) return;

    const form = Utils.getElement('register-form');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
}

//  3. ОБРАБОТЧИКИ СОБЫТИЙ  //

async function handleFormSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    // Сброс ошибок
    clearErrors();

    const email = Utils.getElement('email').value.trim();
    const password = Utils.getElement('password').value;
    const profileIdentifierInput = Utils.getElement('profile-identifier');
    const profileIdentifier = profileIdentifierInput ? profileIdentifierInput.value.trim() : '';
    const termsAcceptedInput = Utils.getElement('terms-accepted');
    const personalDataAcceptedInput = Utils.getElement('personal-data-accepted');
    const termsAccepted = termsAcceptedInput ? termsAcceptedInput.checked : false;
    const personalDataAccepted = personalDataAcceptedInput ? personalDataAcceptedInput.checked : false;

    // Клиентская валидация
    let hasErrors = false;

    if (!email) {
        showFieldError('email', 'Email обязателен');
        hasErrors = true;
    }

    if (!password) {
        showFieldError('password', 'Пароль обязателен');
        hasErrors = true;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
        showFieldError('password', 'Минимум ' + MIN_PASSWORD_LENGTH + ' символов');
        hasErrors = true;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
        showFieldError('password', 'Максимум ' + MAX_PASSWORD_LENGTH + ' символов');
        hasErrors = true;
    }

    if (!termsAccepted) {
        showFieldError('terms-accepted', 'Нужно принять пользовательское соглашение');
        hasErrors = true;
    }

    if (!personalDataAccepted) {
        showFieldError('personal-data-accepted', 'Нужно дать согласие на обработку персональных данных');
        hasErrors = true;
    }

    if (hasErrors) return;

    // Отправка
    isSubmitting = true;
    setButtonLoading(true);

    try {
        const data = await AuthService.register(email, password, profileIdentifier || null, termsAccepted, personalDataAccepted);
        if (data && data.email_verification_required) {
            Notification.info('Письмо подтверждения отправлено на email');
            PageRouter.open(PAGE_URL.LOGIN);
            return;
        }

        Notification.success('Регистрация успешна!');
        PageRouter.open(PAGE_URL.LIBRARY);
    } catch (error) {
        handleServerErrors(error);
    } finally {
        isSubmitting = false;
        setButtonLoading(false);
    }
}

//  4. РАБОТА С ОШИБКАМИ //

function showFieldError(fieldId, message) {
    Utils.showFieldError(fieldId, message);
}

function clearErrors() {
    Utils.clearFormErrors();
}

function syncPasswordHints() {
    const passwordInput = Utils.getElement('password');
    const passwordHint = Utils.getElement('password-hint');

    if (passwordInput) {
        passwordInput.placeholder = 'Минимум ' + MIN_PASSWORD_LENGTH + ' символов';
        passwordInput.minLength = MIN_PASSWORD_LENGTH;
        passwordInput.maxLength = MAX_PASSWORD_LENGTH;
    }

    if (passwordHint) {
        passwordHint.textContent = 'Не менее ' + MIN_PASSWORD_LENGTH + ' символов, буквы и цифры';
    }
}

function handleServerErrors(error) {
    if (error.errors) {
        // Ошибки валидации по полям
        for (const [field, message] of Object.entries(error.errors)) {
            // Маппинг серверных полей на клиентские ID
            const fieldMap = {
                user_email: 'email',
                password: 'password',
                user_profile_identifier: 'profile-identifier',
                terms_accepted: 'terms-accepted',
                personal_data_accepted: 'personal-data-accepted',
            };
            const fieldId = fieldMap[field] || field;
            showFieldError(fieldId, message);
        }
    } else {
        // Общая ошибка
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
        setSubmitButtonContent(button, isLoading ? 'loader-circle' : 'user-plus', isLoading ? 'Регистрация...' : 'Создать аккаунт');
    }
}

function setSubmitButtonContent(button, iconName, label) {
    Utils.setIconText(button, iconName, label);
}

//  5. ЗАПУСК  //

function destroy() {}

PageRegistry.register('register', {
    init: init,
    destroy: destroy,
});
})();
