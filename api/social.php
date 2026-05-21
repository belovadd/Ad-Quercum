<?php
/**
 *  API: Контроллер публикаций, комментариев и сообщений.
 *
 * НАЗНАЧЕНИЕ:
 *   Обслуживает публикации пользователей, комментарии и личные сообщения, оставляя
 *   в контроллере только HTTP-ввод, проверки и JSON-ответы.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/social_service.php';

//  2. МАРШРУТИЗАЦИЯ  //

route_action([
    'create_publication'     => 'handle_create_publication',
    'get_publication'        => 'handle_get_publication',
    'get_user_publications'  => 'handle_get_user_publications',
    'delete_publication'     => 'handle_delete_publication',
    'create_comment'         => 'handle_create_comment',
    'get_comments'           => 'handle_get_comments',
    'delete_comment'         => 'handle_delete_comment',
    'send_message'           => 'handle_send_message',
    'get_conversations'      => 'handle_get_conversations',
    'get_messages'           => 'handle_get_messages',
    'mark_read'              => 'handle_mark_read',
    'get_unread_count'       => 'handle_get_unread_count',
]);

//  3. ОБРАБОТЧИКИ: ПУБЛИКАЦИИ  //

function handle_create_publication(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $publication_text = validate_required_text($input, 'publication_text', $errors, MAX_PUBLICATION_TEXT_LENGTH);
    $book_id = validate_optional_int($input, 'book_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $social_service = new SocialService();
        $publication = $social_service->create_publication($user_id, $publication_text, $book_id);
        send_success_response($publication, 'Публикация создана', 201);
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Книга не найдена' ? 404 : 422;
        if (str_contains($message, 'своей полки')) {
            $code = 403;
        }
        send_error_response($message, $code);
    }
}

function handle_get_publication(): void {
    require_method('GET');
    require_authentication();

    $publication_id = filter_var($_GET['publication_id'] ?? '', FILTER_VALIDATE_INT);

    if ($publication_id === false || $publication_id < 1) {
        send_error_response('Не указан ID публикации', 400);
    }

    try {
        $social_service = new SocialService();
        $publication = $social_service->get_publication($publication_id);
        send_success_response($publication, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_get_user_publications(): void {
    require_method('GET');
    require_authentication();

    $user_id = filter_var($_GET['user_id'] ?? '', FILTER_VALIDATE_INT);

    if ($user_id === false || $user_id < 1) {
        send_error_response('Не указан ID пользователя', 400);
    }

    $pagination = validate_pagination();

    $social_service = new SocialService();
    $result = $social_service->get_user_publications($user_id, $pagination['page'], $pagination['per_page']);

    send_success_response($result, 'OK');
}

function handle_delete_publication(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $publication_id = validate_required_int($input, 'publication_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $social_service = new SocialService();
        $social_service->delete_publication($user_id, $publication_id);
        send_success_response(null, 'Публикация удалена');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

//  4. ОБРАБОТЧИКИ: КОММЕНТАРИИ  //

function handle_create_comment(): void {
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
        $social_service = new SocialService();
        $comment = $social_service->create_comment($user_id, $publication_id, $comment_text);
        send_success_response($comment, 'Комментарий добавлен', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_get_comments(): void {
    require_method('GET');
    require_authentication();

    $publication_id = filter_var($_GET['publication_id'] ?? '', FILTER_VALIDATE_INT);

    if ($publication_id === false || $publication_id < 1) {
        send_error_response('Не указан ID публикации', 400);
    }

    $pagination = validate_pagination();

    $social_service = new SocialService();
    $result = $social_service->get_comments($publication_id, $pagination['page'], $pagination['per_page']);

    send_success_response($result, 'OK');
}

function handle_delete_comment(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $comment_id = validate_required_int($input, 'comment_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $social_service = new SocialService();
        $social_service->delete_comment($user_id, $comment_id);
        send_success_response(null, 'Комментарий удалён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

//  5. ОБРАБОТЧИКИ: СООБЩЕНИЯ  //

function handle_send_message(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $receiver_id = validate_required_int($input, 'receiver_id', 1, PHP_INT_MAX, $errors);
    $message_text = validate_required_text($input, 'message_text', $errors, MAX_MESSAGE_TEXT_LENGTH);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $social_service = new SocialService();
        $message = $social_service->send_message($user_id, $receiver_id, $message_text);
        send_success_response($message, 'Сообщение отправлено', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_get_conversations(): void {
    require_method('GET');
    $user_id = require_authentication();

    $social_service = new SocialService();
    $conversations = $social_service->get_conversations($user_id);

    send_success_response($conversations, 'OK');
}

function handle_get_messages(): void {
    require_method('GET');
    $user_id = require_authentication();

    $partner_id = filter_var($_GET['partner_id'] ?? '', FILTER_VALIDATE_INT);

    if ($partner_id === false || $partner_id < 1) {
        send_error_response('Не указан ID собеседника', 400);
    }

    $pagination = validate_pagination();

    $social_service = new SocialService();
    $result = $social_service->get_messages($user_id, $partner_id, $pagination['page'], $pagination['per_page']);

    send_success_response($result, 'OK');
}

function handle_mark_read(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $partner_id = validate_required_int($input, 'partner_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    $social_service = new SocialService();
    $social_service->mark_messages_read($user_id, $partner_id);

    send_success_response(null, 'Сообщения прочитаны');
}

function handle_get_unread_count(): void {
    require_method('GET');
    $user_id = require_authentication();

    $social_service = new SocialService();
    $count = $social_service->get_unread_count($user_id);

    send_success_response(['unread_count' => $count], 'OK');
}
