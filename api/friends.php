<?php
/**
 *  API: Контроллер системы дружбы.
 *
 * НАЗНАЧЕНИЕ:
 *   Принимает запросы на дружбу, подтверждение, отклонение, отмену и получение
 *   списков друзей, входящих и исходящих заявок.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/friend_service.php';

//  2. МАРШРУТИЗАЦИЯ  //

route_action([
    'send_request'   => 'handle_send_request',
    'accept_request' => 'handle_accept_request',
    'reject_request' => 'handle_reject_request',
    'cancel_request' => 'handle_cancel_request',
    'remove_friend'  => 'handle_remove_friend',
    'get_friends'    => 'handle_get_friends',
    'get_incoming'   => 'handle_get_incoming',
    'get_outgoing'   => 'handle_get_outgoing',
    'get_status'     => 'handle_get_status',
]);

//  3. ОБРАБОТЧИКИ: ЗАПРОСЫ ДРУЖБЫ  //

function handle_send_request(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $receiver_id = validate_required_int($input, 'receiver_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $friend_service = new FriendService();
        $request = $friend_service->send_request($user_id, $receiver_id);
        send_success_response($request, 'Запрос дружбы отправлен', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_accept_request(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $request_id = validate_required_int($input, 'request_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $friend_service = new FriendService();
        $friend_service->accept_request($user_id, $request_id);
        send_success_response(null, 'Запрос дружбы принят');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_reject_request(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $request_id = validate_required_int($input, 'request_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $friend_service = new FriendService();
        $friend_service->reject_request($user_id, $request_id);
        send_success_response(null, 'Запрос дружбы отклонён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

function handle_cancel_request(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $request_id = validate_required_int($input, 'request_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $friend_service = new FriendService();
        $friend_service->cancel_request($user_id, $request_id);
        send_success_response(null, 'Запрос дружбы отменён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

//  4. ОБРАБОТЧИКИ: УПРАВЛЕНИЕ ДРУЖБОЙ  //

function handle_remove_friend(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $friend_id = validate_required_int($input, 'friend_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $friend_service = new FriendService();
        $friend_service->remove_friend($user_id, $friend_id);
        send_success_response(null, 'Друг удалён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 422);
    }
}

// 5. ОБРАБОТЧИКИ: ПОЛУЧЕНИЕ ДАННЫХ //

function handle_get_friends(): void {
    require_method('GET');
    $user_id = require_authentication();

    $pagination = validate_pagination();

    $friend_service = new FriendService();
    $result = $friend_service->get_friends($user_id, $pagination['page'], $pagination['per_page']);

    send_success_response($result, 'OK');
}

function handle_get_incoming(): void {
    require_method('GET');
    $user_id = require_authentication();

    $friend_service = new FriendService();
    $requests = $friend_service->get_incoming_requests($user_id);

    send_success_response($requests, 'OK');
}

function handle_get_outgoing(): void {
    require_method('GET');
    $user_id = require_authentication();

    $friend_service = new FriendService();
    $requests = $friend_service->get_outgoing_requests($user_id);

    send_success_response($requests, 'OK');
}

function handle_get_status(): void {
    require_method('GET');
    $user_id = require_authentication();

    $other_user_id = filter_var($_GET['user_id'] ?? '', FILTER_VALIDATE_INT);

    if ($other_user_id === false || $other_user_id < 1) {
        send_error_response('Не указан ID пользователя', 400);
    }

    $friend_service = new FriendService();
    $status = $friend_service->get_friendship_status($user_id, $other_user_id);

    send_success_response($status, 'OK');
}
