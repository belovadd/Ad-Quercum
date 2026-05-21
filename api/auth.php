<?php
/**
 *  API: Контроллер аутентификации и пользователей.
 *
 *  НАЗНАЧЕНИЕ:
 *   Обрабатывает регистрацию, вход, выход, проверку сессии и профильные
 *   действия пользователя, сохраняя HTTP-слой внутри контроллера.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/auth_service.php';

// 2. МАРШРУТИЗАЦИЯ  //

route_action([
    'register'       => 'handle_register',
    'verify_email'   => 'handle_verify_email',
    'login'          => 'handle_login',
    'logout'         => 'handle_logout',
    'check_session'  => 'handle_check_session',
    'get_profile'    => 'handle_get_profile',
    'update_profile' => 'handle_update_profile',
    'change_password' => 'handle_change_password',
    'upload_avatar'  => 'handle_upload_avatar',
    'search_users'   => 'handle_search_users',
]);

//  3. ОБРАБОТЧИКИ //

function handle_register(): void {
    require_method('POST');

    $input = get_json_input();
    $errors = [];

    $email = validate_email($input, $errors);
    $password = validate_password($input, $errors);
    $terms_accepted = filter_var($input['terms_accepted'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $personal_data_accepted = filter_var($input['personal_data_accepted'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if (!$terms_accepted) {
        $errors['terms_accepted'] = 'Необходимо принять пользовательское соглашение';
    }

    if (!$personal_data_accepted) {
        $errors['personal_data_accepted'] = 'Необходимо дать согласие на обработку персональных данных';
    }

    // user_profile_identifier — опциональное поле (handle, например "bookworm42")
    $user_profile_identifier = isset($input['user_profile_identifier'])
        ? trim((string) $input['user_profile_identifier']) : '';
    if ($user_profile_identifier !== '' && !preg_match('/^[A-Za-z0-9_]{3,30}$/', $user_profile_identifier)) {
        $errors['user_profile_identifier'] = 'Идентификатор: латиница, цифры и подчёркивания, 3-30 символов';
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $auth_service = new AuthService();
        $user = $auth_service->register(
            $email, $password,
            $user_profile_identifier !== '' ? $user_profile_identifier : null,
            build_email_verification_url()
        );
        send_success_response($user, 'Регистрация успешна', 201);
    } catch (RuntimeException $exception) {
        if ($exception->getMessage() === ERROR_EMAIL_VERIFICATION_SEND_FAILED) {
            send_error_response('Внутренняя ошибка', 500);
        }
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_verify_email(): void {
    require_method('GET');

    $token = trim((string) ($_GET['token'] ?? ''));
    if ($token === '') {
        send_error_response('Токен подтверждения обязателен', 422);
    }

    try {
        $auth_service = new AuthService();
        $user = $auth_service->verify_email($token);
        send_success_response($user, 'Email подтверждён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_login(): void {
    require_method('POST');

    $input = get_json_input();
    $errors = [];

    $email = validate_email($input, $errors);
    $password = $input['password'] ?? '';

    if ($password === '') {
        $errors['password'] = 'Пароль обязателен';
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $auth_service = new AuthService();
        $user = $auth_service->login($email, $password);

        // Возвращаем CSRF-токен при успешном логине.
        $session = $auth_service->get_current_session();
        $response_data = $user;
        $response_data['csrf_token'] = $session['csrf_token'] ?? '';

        send_success_response($response_data, 'Вход выполнен');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 401);
    }
}

function handle_logout(): void {
    require_method('POST');

    $auth_service = new AuthService();
    $auth_service->logout();

    send_success_response(null, 'Выход выполнен');
}

function handle_check_session(): void {
    require_method('GET');

    $auth_service = new AuthService();
    $session = $auth_service->get_current_session();

    send_success_response($session, 'OK');
}

function handle_get_profile(): void {
    require_method('GET');

    $auth_service = new AuthService();

    $target_user_id = isset($_GET['user_id']) ? (int) $_GET['user_id'] : null;
    $current_user_id = get_current_user_id();

    try {
        // Свой профиль
        if ($target_user_id === null || $target_user_id === $current_user_id) {
            if ($current_user_id === null) {
                send_error_response('Необходима авторизация', 401);
            }
            $profile = $auth_service->get_profile($current_user_id);
            send_success_response($profile, 'OK');
        }

        // Чужой публичный профиль
        $profile = $auth_service->get_public_profile($target_user_id);
        send_success_response($profile, 'OK');
    } catch (RuntimeException $exception) {
        $status_code = $exception->getMessage() === 'Профиль скрыт' ? 403 : 404;
        send_error_response($exception->getMessage(), $status_code);
    }
}

function handle_update_profile(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $data = [];

    // Необязательные поля профиля
    if (array_key_exists('user_name_first', $input)) {
        $data['user_name_first'] = validate_optional_string($input, 'user_name_first', MAX_NAME_LENGTH, $errors);
    }

    if (array_key_exists('user_name_last', $input)) {
        $data['user_name_last'] = validate_optional_string($input, 'user_name_last', MAX_NAME_LENGTH, $errors);
    }

    if (array_key_exists('user_profile_identifier', $input)) {
        $data['user_profile_identifier'] = validate_optional_string(
            $input, 'user_profile_identifier', MAX_PROFILE_IDENTIFIER_LENGTH, $errors
        );
    }

    if (array_key_exists('user_bio', $input)) {
        $data['user_bio'] = validate_optional_text($input, 'user_bio', $errors, MAX_PROFILE_BIO_LENGTH);
    }

    if (array_key_exists('user_location', $input)) {
        $data['user_location'] = validate_optional_string($input, 'user_location', MAX_PROFILE_LOCATION_LENGTH, $errors);
    }

    if (array_key_exists('user_status', $input)) {
        $data['user_status'] = validate_optional_string($input, 'user_status', MAX_PROFILE_STATUS_LENGTH, $errors);
    }

    // Булевые поля приватности
    if (array_key_exists('is_profile_hidden', $input)) {
        $data['is_profile_hidden'] = $input['is_profile_hidden'] ? 1 : 0;
    }

    if (array_key_exists('is_library_hidden', $input)) {
        $data['is_library_hidden'] = $input['is_library_hidden'] ? 1 : 0;
    }

    if (array_key_exists('is_collections_hidden', $input)) {
        $data['is_collections_hidden'] = $input['is_collections_hidden'] ? 1 : 0;
    }

    if (array_key_exists('is_stats_hidden', $input)) {
        $data['is_stats_hidden'] = $input['is_stats_hidden'] ? 1 : 0;
    }

    if (array_key_exists('is_plant_hidden', $input)) {
        $data['is_plant_hidden'] = $input['is_plant_hidden'] ? 1 : 0;
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    if (empty($data)) {
        send_error_response('Нет данных для обновления', 400);
    }

    try {
        $auth_service = new AuthService();
        $profile = $auth_service->update_profile($user_id, $data);
        send_success_response($profile, 'Профиль обновлён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_change_password(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $current_password = (string) ($input['current_password'] ?? '');
    $new_password = (string) ($input['new_password'] ?? '');
    $confirm_password = (string) ($input['confirm_password'] ?? '');

    if ($current_password === '') {
        $errors['current_password'] = 'Текущий пароль обязателен';
    }

    if ($new_password === '') {
        $errors['new_password'] = 'Новый пароль обязателен';
    } elseif (mb_strlen($new_password) < MIN_PASSWORD_LENGTH) {
        $errors['new_password'] = 'Минимальная длина пароля: ' . MIN_PASSWORD_LENGTH . ' символов';
    } elseif (mb_strlen($new_password) > MAX_PASSWORD_LENGTH) {
        $errors['new_password'] = 'Максимальная длина пароля: ' . MAX_PASSWORD_LENGTH . ' символов';
    }

    if ($confirm_password === '') {
        $errors['confirm_password'] = 'Повторите новый пароль';
    } elseif ($new_password !== $confirm_password) {
        $errors['confirm_password'] = 'Пароли не совпадают';
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $auth_service = new AuthService();
        $auth_service->change_password($user_id, $current_password, $new_password);
        send_success_response(null, 'Пароль обновлён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_upload_avatar(): void {
    require_method('POST');
    $user_id = require_authentication();

    if (!isset($_FILES['avatar'])) {
        send_error_response('Файл аватара не передан', 400);
    }

    try {
        $auth_service = new AuthService();
        $profile = $auth_service->upload_avatar($user_id, $_FILES['avatar']);
        send_success_response($profile, 'Аватар обновлён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_search_users(): void {
    require_method('GET');
    $user_id = require_authentication();

    $query = trim($_GET['query'] ?? '');
    $pagination = validate_pagination();

    $auth_service = new AuthService();
    $results = $auth_service->search_users(
        $query,
        $pagination['page'],
        $pagination['per_page'],
        $user_id
    );

    send_success_response($results, 'OK');
}

function build_email_verification_url(): string {
    return rtrim(APP_BASE_URL, '/') . WEB_ROOT . '/api/auth.php?action=verify_email';
}
