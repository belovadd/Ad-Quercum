<?php
/**
 * API: Контроллер клубов — CRUD, участники, поиск, публикации, комментарии.
 *
 * НАЗНАЧЕНИЕ:
 *   Обслуживает страницы клубов: создание и редактирование клуба, состав
 *   участников, ленту публикаций, комментарии и поиск клубов.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/club_service.php';

//  2. МАРШРУТИЗАЦИЯ  //

route_action([
    'create'               => 'handle_create_club',
    'get'                  => 'handle_get_club',
    'update'               => 'handle_update_club',
    'delete'               => 'handle_delete_club',
    'upload_image'         => 'handle_upload_image',
    'join'                 => 'handle_join_club',
    'request_join'         => 'handle_request_join_club',
    'get_join_requests'    => 'handle_get_join_requests',
    'accept_join_request'  => 'handle_accept_join_request',
    'reject_join_request'  => 'handle_reject_join_request',
    'cancel_join_request'  => 'handle_cancel_join_request',
    'get_my_join_requests' => 'handle_get_my_join_requests',
    'leave'                => 'handle_leave_club',
    'remove_member'        => 'handle_remove_member',
    'change_role'          => 'handle_change_role',
    'get_members'          => 'handle_get_members',
    'get_my_clubs'         => 'handle_get_my_clubs',
    'get_all'              => 'handle_get_all_clubs',
    'search'               => 'handle_search_clubs',
    'create_publication'   => 'handle_create_club_publication',
    'get_publications'     => 'handle_get_club_publications',
    'delete_publication'   => 'handle_delete_club_publication',
    'create_comment'       => 'handle_create_club_comment',
    'get_comments'         => 'handle_get_club_comments',
    'delete_comment'       => 'handle_delete_club_comment',
]);

//  3. ОБРАБОТЧИКИ: КЛУБЫ, УЧАСТНИКИ И ПОИСК  //

function handle_create_club(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_name = validate_required_string($input, 'club_name', MAX_CLUB_NAME_LENGTH, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    $club_description = validate_optional_text($input, 'club_description', $errors, MAX_CLUB_DESCRIPTION_LENGTH);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    $is_public = isset($input['is_public']) ? (bool) $input['is_public'] : true;

    try {
        $club_service = new ClubService();
        $club = $club_service->create_club($user_id, $club_name, $club_description, $is_public);
        send_success_response($club, 'Клуб создан', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

function handle_get_club(): void {
    require_method('GET');
    $user_id = require_authentication();

    $club_id = filter_var($_GET['club_id'] ?? '', FILTER_VALIDATE_INT);

    if ($club_id === false || $club_id < 1) {
        send_error_response('Некорректный ID клуба', 400);
    }

    try {
        $club_service = new ClubService();
        $club = $club_service->get_club($club_id, $user_id);
        send_success_response($club, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Нет доступа к этому клубу' ? 403 : 404;
        send_error_response($message, $code);
    }
}

function handle_update_club(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    $data = [];

    if (array_key_exists('club_name', $input)) {
        $data['club_name'] = validate_required_string($input, 'club_name', MAX_CLUB_NAME_LENGTH, $errors);
    }

    if (array_key_exists('club_description', $input)) {
        $data['club_description'] = validate_optional_text($input, 'club_description', $errors, MAX_CLUB_DESCRIPTION_LENGTH);
    }

    if (array_key_exists('is_public', $input)) {
        $data['is_public'] = $input['is_public'] ? 1 : 0;
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    if (empty($data)) {
        send_error_response('Нет данных для обновления', 400);
    }

    try {
        $club_service = new ClubService();
        $club = $club_service->update_club($club_id, $user_id, $data);
        send_success_response($club, 'Клуб обновлён');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Клуб не найден' ? 404 : 403;
        send_error_response($message, $code);
    }
}

function handle_delete_club(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->delete_club($club_id, $user_id);
        send_success_response(null, 'Клуб удалён');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Клуб не найден' ? 404 : 403;
        send_error_response($message, $code);
    }
}

function handle_upload_image(): void {
    require_method('POST');
    $user_id = require_authentication();

    $club_id = filter_var($_POST['club_id'] ?? '', FILTER_VALIDATE_INT);

    if ($club_id === false || $club_id < 1) {
        send_error_response('Некорректный ID клуба', 400);
    }

    if (!isset($_FILES['club_image'])) {
        send_error_response('Файл изображения не передан', 400);
    }

    try {
        $club_service = new ClubService();
        $club = $club_service->upload_club_image($club_id, $user_id, $_FILES['club_image']);
        send_success_response($club, 'Изображение загружено');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = str_contains($message, 'Нет прав') ? 403 : 422;
        send_error_response($message, $code);
    }
}

function handle_join_club(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->join_club($club_id, $user_id);
        send_success_response(null, 'Вы вступили в клуб');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Клуб не найден' ? 404 : 400;
        send_error_response($message, $code);
    }
}

function handle_request_join_club(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $request = $club_service->request_join_club($club_id, $user_id);
        send_success_response($request, 'Заявка отправлена', 201);
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Клуб не найден' ? 404 : 400;
        send_error_response($message, $code);
    }
}

function handle_get_join_requests(): void {
    require_method('GET');
    $user_id = require_authentication();

    $club_id = filter_var($_GET['club_id'] ?? '', FILTER_VALIDATE_INT);

    if ($club_id === false || $club_id < 1) {
        send_error_response('Некорректный ID клуба', 400);
    }

    try {
        $club_service = new ClubService();
        $requests = $club_service->get_join_requests($club_id, $user_id);
        send_success_response($requests, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Клуб не найден' ? 404 : 403;
        send_error_response($message, $code);
    }
}

function handle_get_my_join_requests(): void {
    require_method('GET');
    $user_id = require_authentication();

    $club_service = new ClubService();
    $requests = $club_service->get_user_join_requests($user_id);
    send_success_response($requests, 'OK');
}

function handle_accept_join_request(): void {
    require_method('POST');
    $actor_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $request_id = validate_required_int($input, 'request_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->accept_join_request($request_id, $actor_id);
        send_success_response(null, 'Заявка принята');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Заявка не найдена' || $message === 'Клуб не найден') {
            $code = 404;
        } elseif (str_contains($message, 'Нет прав')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_reject_join_request(): void {
    require_method('POST');
    $actor_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $request_id = validate_required_int($input, 'request_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->reject_join_request($request_id, $actor_id);
        send_success_response(null, 'Заявка отклонена');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Заявка не найдена' || $message === 'Клуб не найден') {
            $code = 404;
        } elseif (str_contains($message, 'Нет прав')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_cancel_join_request(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $request_id = validate_required_int($input, 'request_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->cancel_join_request($request_id, $user_id);
        send_success_response(null, 'Заявка отменена');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Заявка не найдена' ? 404 : 400;

        if (str_contains($message, 'Нет прав')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_leave_club(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->leave_club($club_id, $user_id);
        send_success_response(null, 'Вы покинули клуб');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Клуб не найден' ? 404 : 400;
        send_error_response($message, $code);
    }
}

function handle_remove_member(): void {
    require_method('POST');
    $actor_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);
    $target_user_id = validate_required_int($input, 'user_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->remove_member($club_id, $target_user_id, $actor_id);
        send_success_response(null, 'Участник исключён');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Клуб не найден') {
            $code = 404;
        } elseif (str_contains($message, 'Нет прав') || str_contains($message, 'Вы можете исключать')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_change_role(): void {
    require_method('POST');
    $actor_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);
    $target_user_id = validate_required_int($input, 'user_id', 1, PHP_INT_MAX, $errors);
    $role = validate_enum($input, 'role', [CLUB_ROLE_MEMBER, CLUB_ROLE_MODERATOR], $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->change_member_role($club_id, $target_user_id, $role, $actor_id);
        send_success_response(null, 'Роль изменена');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Клуб не найден') {
            $code = 404;
        } elseif (str_contains($message, 'Только создатель')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_get_members(): void {
    require_method('GET');
    $user_id = require_authentication();

    $club_id = filter_var($_GET['club_id'] ?? '', FILTER_VALIDATE_INT);

    if ($club_id === false || $club_id < 1) {
        send_error_response('Некорректный ID клуба', 400);
    }

    $pagination = validate_pagination();

    try {
        $club_service = new ClubService();
        $members = $club_service->get_members(
            $club_id, $user_id,
            $pagination['page'], $pagination['per_page']
        );
        send_success_response($members, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Нет доступа к этому клубу' ? 403 : 404;
        send_error_response($message, $code);
    }
}

function handle_get_my_clubs(): void {
    require_method('GET');
    $user_id = require_authentication();

    $pagination = validate_pagination();

    $club_service = new ClubService();
    $clubs = $club_service->get_user_clubs(
        $user_id,
        $pagination['page'], $pagination['per_page']
    );

    send_success_response($clubs, 'OK');
}

function handle_get_all_clubs(): void {
    require_method('GET');
    $user_id = require_authentication();

    $filter = trim($_GET['filter'] ?? CLUB_CATALOG_FILTER_ALL);
    $query = trim($_GET['query'] ?? '');
    $pagination = validate_pagination();

    try {
        $club_service = new ClubService();
        $clubs = $club_service->get_catalog_clubs(
            $user_id,
            $filter,
            $query,
            $pagination['page'], $pagination['per_page']
        );

        send_success_response($clubs, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

function handle_search_clubs(): void {
    require_method('GET');
    $user_id = require_authentication();

    $query = trim($_GET['query'] ?? '');

    if ($query === '') {
        send_error_response('Поисковый запрос не указан', 400);
    }

    $pagination = validate_pagination();

    $club_service = new ClubService();
    $results = $club_service->search_clubs(
        $query,
        $user_id,
        $pagination['page'], $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

//  4. ОБРАБОТЧИКИ: КЛУБНЫЕ ПУБЛИКАЦИИ  //

function handle_create_club_publication(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $club_id = validate_required_int($input, 'club_id', 1, PHP_INT_MAX, $errors);
    $publication_text = validate_required_text($input, 'publication_text', $errors, MAX_PUBLICATION_TEXT_LENGTH);
    $book_id = validate_optional_int($input, 'book_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $publication = $club_service->create_club_publication($user_id, $club_id, $publication_text, $book_id);
        send_success_response($publication, 'Публикация создана', 201);
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Клуб не найден' || $message === 'Книга не найдена') {
            $code = 404;
        } elseif (str_contains($message, 'участником клуба') || str_contains($message, 'своей полки')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_get_club_publications(): void {
    require_method('GET');
    $user_id = require_authentication();

    $club_id = filter_var($_GET['club_id'] ?? '', FILTER_VALIDATE_INT);

    if ($club_id === false || $club_id < 1) {
        send_error_response('Некорректный ID клуба', 400);
    }

    $pagination = validate_pagination();

    try {
        $club_service = new ClubService();
        $result = $club_service->get_club_publications(
            $user_id, $club_id,
            $pagination['page'], $pagination['per_page']
        );
        send_success_response($result, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Нет доступа к этому клубу' ? 403 : 404;
        send_error_response($message, $code);
    }
}

function handle_delete_club_publication(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $publication_id = validate_required_int($input, 'publication_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->delete_club_publication($user_id, $publication_id);
        send_success_response(null, 'Публикация удалена');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Публикация не найдена') {
            $code = 404;
        } elseif (str_contains($message, 'только свою')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

//  5. ОБРАБОТЧИКИ: КЛУБНЫЕ КОММЕНТАРИИ  //

function handle_create_club_comment(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $publication_id = validate_required_int($input, 'publication_id', 1, PHP_INT_MAX, $errors);
    $comment_text = validate_required_text($input, 'comment_text', $errors, MAX_COMMENT_TEXT_LENGTH);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $comment = $club_service->create_club_comment($user_id, $publication_id, $comment_text);
        send_success_response($comment, 'Комментарий добавлен', 201);
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Публикация не найдена') {
            $code = 404;
        } elseif (str_contains($message, 'не являетесь участником')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}


function handle_get_club_comments(): void {
    require_method('GET');
    require_authentication();

    $publication_id = filter_var($_GET['publication_id'] ?? '', FILTER_VALIDATE_INT);

    if ($publication_id === false || $publication_id < 1) {
        send_error_response('Не указан ID публикации', 400);
    }

    $pagination = validate_pagination();

    $club_service = new ClubService();
    $result = $club_service->get_club_comments($publication_id, $pagination['page'], $pagination['per_page']);

    send_success_response($result, 'OK');
}

function handle_delete_club_comment(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $comment_id = validate_required_int($input, 'comment_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $club_service = new ClubService();
        $club_service->delete_club_comment($user_id, $comment_id);
        send_success_response(null, 'Комментарий удалён');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Комментарий не найден') {
            $code = 404;
        } elseif (str_contains($message, 'только свой')) {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}
