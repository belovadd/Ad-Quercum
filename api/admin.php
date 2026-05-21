<?php

// 1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/admin_service.php';

//  2. МАРШРУТИЗАЦИЯ 

route_action([
    // Статистика (admin + moderator)
    'get_statistics'         => 'handle_get_statistics',
    'get_recent_activity'    => 'handle_get_recent_activity',

    // Пользователи (только admin)
    'get_users'              => 'handle_get_users',
    'get_user'               => 'handle_get_user',
    'update_role'            => 'handle_update_role',
    'update_user'            => 'handle_update_user_by_admin',
    'block_user'             => 'handle_block_user',
    'unblock_user'           => 'handle_unblock_user',
    'upload_user_avatar'     => 'handle_upload_user_avatar',
    'remove_user_avatar'     => 'handle_remove_user_avatar',
    'delete_user'            => 'handle_delete_user',

    // Модерация произведений (admin + moderator) //
    'get_pending_books'      => 'handle_get_pending_books',
    'get_all_books'          => 'handle_get_all_books',
    'get_book'               => 'handle_get_book_admin',
    'approve_book'           => 'handle_approve_book',
    'reject_book'            => 'handle_reject_book',
    'merge_book'             => 'handle_merge_book',
    'list_duplicates'        => 'handle_list_duplicates',
    'search_books_for_merge' => 'handle_search_books_for_merge',

    // Модерация изданий (admin + moderator)
    'get_pending_editions'   => 'handle_get_pending_editions',
    'get_all_editions'       => 'handle_get_all_editions',
    'get_edition'            => 'handle_get_edition_admin',
    'approve_edition'        => 'handle_approve_edition',
    'reject_edition'         => 'handle_reject_edition',
]);

//  3. ОБРАБОТЧИКИ — СТАТИСТИКА //

function handle_get_statistics(): void {
    require_method('GET');
    require_moderator();

    $admin_service = new AdminService();
    $stats = $admin_service->get_statistics();

    send_success_response($stats, 'OK');
}

function handle_get_recent_activity(): void {
    require_method('GET');
    require_moderator();

    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : ADMIN_RECENT_ACTIVITY_DEFAULT_LIMIT;

    $admin_service = new AdminService();
    $activity = $admin_service->get_recent_activity($limit);

    send_success_response($activity, 'OK');
}

//  4. ОБРАБОТЧИКИ — ПОЛЬЗОВАТЕЛИ //

function handle_get_users(): void {
    require_method('GET');
    require_admin();

    $query = trim($_GET['query'] ?? '');
    $filters = [];

    if (!empty($_GET['role']) && in_array($_GET['role'], USER_ROLES, true)) {
        $filters['role'] = $_GET['role'];
    }

    if (isset($_GET['is_blocked'])) {
        $filters['is_blocked'] = (bool) $_GET['is_blocked'];
    }

    $pagination = validate_pagination();

    $admin_service = new AdminService();
    $results = $admin_service->get_users(
        $query !== '' ? $query : null,
        $filters,
        $pagination['page'],
        $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_get_user(): void {
    require_method('GET');
    require_admin();

    $user_id = filter_var($_GET['user_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->get_user($user_id);
        send_success_response($user, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_update_role(): void {
    require_method('POST');
    $admin_id = require_admin();

    $input = get_json_input();
    $user_id = filter_var($input['user_id'] ?? 0, FILTER_VALIDATE_INT);
    $role = trim($input['role'] ?? '');

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    if (empty($role)) {
        send_error_response('Роль не указана', 400);
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->update_user_role($admin_id, $user_id, $role);
        send_success_response($user, 'Роль обновлена');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_block_user(): void {
    require_method('POST');
    $admin_id = require_admin();

    $input = get_json_input();
    $user_id = filter_var($input['user_id'] ?? 0, FILTER_VALIDATE_INT);
    $reason  = isset($input['reason']) ? trim((string) $input['reason']) : '';
    if ($reason === '') { $reason = null; }
    if ($reason !== null && mb_strlen($reason) > MAX_BLOCK_REASON_LENGTH) {
        send_error_response('Причина блокировки слишком длинная (макс. ' . MAX_BLOCK_REASON_LENGTH . ' символов)', 422);
    }

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->block_user($admin_id, $user_id, $reason);
        send_success_response($user, 'Пользователь заблокирован');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_update_user_by_admin(): void {
    require_method('POST');
    require_admin();

    $input = get_json_input();
    $user_id = filter_var($input['user_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    $allowed_fields = ['user_name_first', 'user_name_last', 'user_email', 'user_profile_identifier'];
    $data = [];
    foreach ($allowed_fields as $field) {
        if (array_key_exists($field, $input)) {
            $value = $input[$field];
            if ($value === '' && $field === 'user_profile_identifier') {
                $value = null;
            }
            $data[$field] = $value;
        }
    }
    if (array_key_exists('is_profile_hidden', $input)) {
        $data['is_profile_hidden'] = $input['is_profile_hidden'] ? 1 : 0;
    }
    if (array_key_exists('is_library_hidden', $input)) {
        $data['is_library_hidden'] = $input['is_library_hidden'] ? 1 : 0;
    }
    if (array_key_exists('is_collections_hidden', $input)) {
        $data['is_collections_hidden'] = $input['is_collections_hidden'] ? 1 : 0;
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->update_user_by_admin($user_id, $data);
        send_success_response($user, 'Пользователь обновлён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_unblock_user(): void {
    require_method('POST');
    require_admin();

    $input = get_json_input();
    $user_id = filter_var($input['user_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->unblock_user($user_id);
        send_success_response($user, 'Пользователь разблокирован');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_upload_user_avatar(): void {
    require_method('POST');
    require_admin();

    $user_id = filter_var($_POST['user_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    if (!isset($_FILES['avatar'])) {
        send_error_response('Файл аватара не передан', 400);
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->upload_user_avatar($user_id, $_FILES['avatar']);
        send_success_response($user, 'Аватар обновлён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_remove_user_avatar(): void {
    require_method('POST');
    require_admin();

    $input = get_json_input();
    $user_id = filter_var($input['user_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    try {
        $admin_service = new AdminService();
        $user = $admin_service->remove_user_avatar($user_id);
        send_success_response($user, 'Аватар удалён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_delete_user(): void {
    require_method('POST');
    $admin_id = require_admin();

    $input = get_json_input();
    $user_id = filter_var($input['user_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    try {
        $admin_service = new AdminService();
        $admin_service->delete_user($admin_id, $user_id);
        send_success_response(null, 'Пользователь удалён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_get_pending_books(): void {
    require_method('GET');
    require_moderator();

    $pagination = validate_pagination();

    $admin_service = new AdminService();
    $results = $admin_service->get_pending_books(
        $pagination['page'], $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_get_all_books(): void {
    require_method('GET');
    require_moderator();

    $query = trim($_GET['query'] ?? '');
    $filters = [];

    if (!empty($_GET['moderation_status'])
        && in_array($_GET['moderation_status'], BOOK_MODERATION_STATUSES, true)) {
        $filters['moderation_status'] = $_GET['moderation_status'];
    }

    $pagination = validate_pagination();

    $admin_service = new AdminService();
    $results = $admin_service->get_all_books(
        $query !== '' ? $query : null,
        $filters,
        $pagination['page'],
        $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_get_book_admin(): void {
    require_method('GET');
    require_moderator();

    $book_id = filter_var($_GET['book_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($book_id === false || $book_id < 1) {
        send_error_response('Некорректный ID произведения', 400);
    }

    try {
        $admin_service = new AdminService();
        $book = $admin_service->get_book($book_id);
        send_success_response($book, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_approve_book(): void {
    require_method('POST');
    require_moderator();

    $input = get_json_input();
    $book_id = filter_var($input['book_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($book_id === false || $book_id < 1) {
        send_error_response('Некорректный ID произведения', 400);
    }

    try {
        $admin_service = new AdminService();
        $book = $admin_service->approve_book($book_id);
        send_success_response($book, 'Произведение одобрено');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_reject_book(): void {
    require_method('POST');
    require_moderator();

    $input = get_json_input();
    $book_id = filter_var($input['book_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($book_id === false || $book_id < 1) {
        send_error_response('Некорректный ID произведения', 400);
    }

    try {
        $admin_service = new AdminService();
        $book = $admin_service->reject_book($book_id);
        send_success_response($book, 'Произведение отклонено');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_merge_book(): void {
    require_method('POST');
    require_moderator();

    $input = get_json_input();
    $source_id = filter_var($input['source_book_id'] ?? 0, FILTER_VALIDATE_INT);
    $target_id = filter_var($input['target_book_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($source_id === false || $source_id < 1) {
        send_error_response('Некорректный ID произведения-дубликата', 400);
    }

    if ($target_id === false || $target_id < 1) {
        send_error_response('Некорректный ID произведения-оригинала', 400);
    }

    try {
        $admin_service = new AdminService();
        $result = $admin_service->merge_book($source_id, $target_id);
        send_success_response($result, 'Произведения объединены');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_list_duplicates(): void {
    require_method('GET');
    require_moderator();

    $pagination = validate_pagination();

    $admin_service = new AdminService();
    $results = $admin_service->list_duplicates(
        $pagination['page'],
        $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_search_books_for_merge(): void {
    require_method('GET');
    require_moderator();

    $query = trim($_GET['query'] ?? '');
    $exclude = filter_var($_GET['exclude'] ?? 0, FILTER_VALIDATE_INT);

    if (empty($query)) {
        send_error_response('Поисковый запрос не указан', 400);
    }

    if ($exclude === false || $exclude < 1) {
        send_error_response('Некорректный ID произведения для исключения', 400);
    }

    $admin_service = new AdminService();
    $results = $admin_service->search_books_for_merge($query, $exclude);

    send_success_response($results, 'OK');
}

//  6. ОБРАБОТЧИКИ — МОДЕРАЦИЯ ИЗДАНИЙ //

function handle_get_pending_editions(): void {
    require_method('GET');
    require_moderator();

    $pagination = validate_pagination();

    $admin_service = new AdminService();
    $results = $admin_service->get_pending_editions(
        $pagination['page'], $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_get_all_editions(): void {
    require_method('GET');
    require_moderator();

    $query = trim($_GET['query'] ?? '');
    $filters = [];

    if (!empty($_GET['moderation_status'])
        && in_array($_GET['moderation_status'], EDITION_MODERATION_STATUSES, true)) {
        $filters['moderation_status'] = $_GET['moderation_status'];
    }

    if (!empty($_GET['language'])) {
        $filters['language'] = trim($_GET['language']);
    }

    if (!empty($_GET['type']) && in_array($_GET['type'], EDITION_TYPES, true)) {
        $filters['type'] = $_GET['type'];
    }

    $pagination = validate_pagination();

    $admin_service = new AdminService();
    $results = $admin_service->get_all_editions(
        $query !== '' ? $query : null,
        $filters,
        $pagination['page'],
        $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_get_edition_admin(): void {
    require_method('GET');
    require_moderator();

    $edition_id = filter_var($_GET['edition_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($edition_id === false || $edition_id < 1) {
        send_error_response('Некорректный ID издания', 400);
    }

    try {
        $admin_service = new AdminService();
        $edition = $admin_service->get_edition($edition_id);
        send_success_response($edition, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_approve_edition(): void {
    require_method('POST');
    require_moderator();

    $input = get_json_input();
    $edition_id = filter_var($input['edition_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($edition_id === false || $edition_id < 1) {
        send_error_response('Некорректный ID издания', 400);
    }

    try {
        $admin_service = new AdminService();
        $edition = $admin_service->approve_edition($edition_id);
        send_success_response($edition, 'Издание одобрено');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        send_error_response($message, 422);
    }
}

function handle_reject_edition(): void {
    require_method('POST');
    require_moderator();

    $input = get_json_input();
    $edition_id = filter_var($input['edition_id'] ?? 0, FILTER_VALIDATE_INT);

    if ($edition_id === false || $edition_id < 1) {
        send_error_response('Некорректный ID издания', 400);
    }

    try {
        $admin_service = new AdminService();
        $edition = $admin_service->reject_edition($edition_id);
        send_success_response($edition, 'Издание отклонено');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}