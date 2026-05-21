<?php
/**
 * Контроллер коллекций — CRUD коллекций, управление изданиями на полке,
 * поиск по полке пользователя.
 *
 * НАЗНАЧЕНИЕ:
 *   Обрабатывает коллекции пользователя и публичные подборки, добавление
 *   конкретных изданий на полку и поиск по пользовательской библиотеке.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/library_service.php';

//  2. МАРШРУТИЗАЦИЯ  //

route_action([
    'create'         => 'handle_create_library',
    'get_all'        => 'handle_get_all_libraries',
    'get_public'     => 'handle_get_public_libraries',
    'get'            => 'handle_get_library',
    'get_edition_collections' => 'handle_get_edition_collections',
    'update'         => 'handle_update_library',
    'delete'         => 'handle_delete_library',
    'add_edition'       => 'handle_add_edition',
    'remove_edition'    => 'handle_remove_edition',
    'remove_from_shelf' => 'handle_remove_from_shelf',
    'search'            => 'handle_search_library',
    'search_public'     => 'handle_search_public_library',
    'search_catalog'    => 'handle_search_catalog',
]);

//  3. ОБРАБОТЧИКИ — КОЛЛЕКЦИИ //

function handle_create_library(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $data = [];
    $data['library_name'] = validate_required_string(
        $input, 'library_name', MAX_LIBRARY_NAME_LENGTH, $errors
    );
    $data['library_description'] = validate_optional_text(
        $input, 'library_description', $errors, MAX_LIBRARY_DESCRIPTION_LENGTH
    );

    if (array_key_exists('is_private', $input)) {
        $data['is_private'] = $input['is_private'] ? 1 : 0;
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $library_service = new LibraryService();
        $library = $library_service->create_library($user_id, $data);
        send_success_response($library, 'Коллекция создана', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

function handle_get_all_libraries(): void {
    require_method('GET');
    $user_id = require_authentication();

    $library_service = new LibraryService();
    $libraries = $library_service->get_user_libraries($user_id);

    send_success_response($libraries, 'OK');
}

function handle_get_public_libraries(): void {
    require_method('GET');
    require_authentication();

    $target_user_id = filter_var($_GET['user_id'] ?? '', FILTER_VALIDATE_INT);

    if ($target_user_id === false || $target_user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    try {
        $library_service = new LibraryService();
        $libraries = $library_service->get_public_libraries($target_user_id);
        send_success_response($libraries, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Пользователь не найден' ? 404 : 403;
        send_error_response($message, $code);
    }
}

function handle_get_library(): void {
    require_method('GET');
    $user_id = require_authentication();

    $library_id = filter_var($_GET['library_id'] ?? '', FILTER_VALIDATE_INT);

    if ($library_id === false || $library_id < 1) {
        send_error_response('Некорректный ID коллекции', 400);
    }

    $pagination = validate_pagination();

    try {
        $library_service = new LibraryService();
        $library = $library_service->get_library(
            $user_id, $library_id,
            $pagination['page'], $pagination['per_page']
        );
        send_success_response($library, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = in_array($message, ['Нет доступа к этой коллекции', 'Профиль скрыт', 'Коллекции скрыты'], true)
            ? 403
            : 404;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_update_library(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $library_id = validate_required_int($input, 'library_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    $data = [];

    if (array_key_exists('library_name', $input)) {
        $data['library_name'] = validate_required_string(
            $input, 'library_name', MAX_LIBRARY_NAME_LENGTH, $errors
        );
    }

    if (array_key_exists('library_description', $input)) {
        $data['library_description'] = validate_optional_text(
            $input, 'library_description', $errors, MAX_LIBRARY_DESCRIPTION_LENGTH
        );
    }

    if (array_key_exists('is_private', $input)) {
        $data['is_private'] = $input['is_private'] ? 1 : 0;
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    if (empty($data)) {
        send_error_response('Нет данных для обновления', 400);
    }

    try {
        $library_service = new LibraryService();
        $library = $library_service->update_library($user_id, $library_id, $data);
        send_success_response($library, 'Коллекция обновлена');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Коллекция не найдена' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_delete_library(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $library_id = validate_required_int($input, 'library_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $library_service = new LibraryService();
        $library_service->delete_library($user_id, $library_id);
        send_success_response(null, 'Коллекция удалена');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Коллекция не найдена' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

//  4. ОБРАБОТЧИКИ — ИЗДАНИЯ В КОЛЛЕКЦИЯХ //

function handle_add_edition(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $library_id = null;
    if (array_key_exists('library_id', $input) && $input['library_id'] !== null) {
        $library_id = validate_required_int($input, 'library_id', 1, PHP_INT_MAX, $errors);
    }
    $edition_id = validate_required_int($input, 'edition_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $library_service = new LibraryService();
        if ($library_id === null) {
            $library_service->add_edition_to_shelf($user_id, $edition_id);
            send_success_response(null, 'Издание добавлено на полку');
            return;
        }

        $library = $library_service->add_edition_to_library($user_id, $library_id, $edition_id);
        send_success_response($library, 'Издание добавлено в коллекцию');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = 400;

        if ($message === 'Коллекция не найдена' || $message === 'Издание не найдено') {
            $code = 404;
        } elseif ($message === 'Нет прав для изменения этой коллекции') {
            $code = 403;
        }

        send_error_response($message, $code);
    }
}

function handle_get_edition_collections(): void {
    require_method('GET');
    $user_id = require_authentication();

    $edition_id = filter_var($_GET['edition_id'] ?? '', FILTER_VALIDATE_INT);
    if ($edition_id === false || $edition_id < 1) {
        send_error_response('Некорректный ID издания', 400);
    }

    try {
        $library_service = new LibraryService();
        $collections = $library_service->get_edition_collections($user_id, $edition_id);
        send_success_response($collections, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Издание не найдено' ? 404 : 403;
        send_error_response($message, $code);
    }
}

function handle_remove_edition(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $library_id = validate_required_int($input, 'library_id', 1, PHP_INT_MAX, $errors);
    $edition_id = validate_required_int($input, 'edition_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $library_service = new LibraryService();
        $library_service->remove_edition_from_library($user_id, $library_id, $edition_id);
        send_success_response(null, 'Издание удалено из коллекции');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Коллекция не найдена' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_remove_from_shelf(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $edition_id = validate_required_int($input, 'edition_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $library_service = new LibraryService();
        $library_service->remove_edition_from_shelf($user_id, $edition_id);
        send_success_response(null, 'Издание снято с полки');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

//  5. ОБРАБОТЧИК — ПОИСК ПО ПОЛКЕ //

function handle_search_library(): void {
    require_method('GET');
    $user_id = require_authentication();

    $query = trim($_GET['query'] ?? '');
    $filters = [];

    if (!empty($_GET['status'])) {
        if (in_array($_GET['status'], BOOK_STATUSES, true)) {
            $filters['status'] = $_GET['status'];
        }
    }

    if (!empty($_GET['genre'])) {
        $filters['genre'] = trim($_GET['genre']);
    }

    if (!empty($_GET['language'])) {
        $filters['language'] = trim($_GET['language']);
    }

    $pagination = validate_pagination();

    $library_service = new LibraryService();
    $results = $library_service->search_user_library(
        $user_id,
        $query !== '' ? $query : null,
        $filters,
        $pagination['page'],
        $pagination['per_page']
    );

    send_success_response($results, 'OK');
}

function handle_search_public_library(): void {
    require_method('GET');
    require_authentication();

    $target_user_id = filter_var($_GET['user_id'] ?? '', FILTER_VALIDATE_INT);

    if ($target_user_id === false || $target_user_id < 1) {
        send_error_response('Некорректный ID пользователя', 400);
    }

    $query = trim($_GET['query'] ?? '');
    $filters = [];

    if (!empty($_GET['status']) && in_array($_GET['status'], BOOK_STATUSES, true)) {
        $filters['status'] = $_GET['status'];
    }

    if (!empty($_GET['genre'])) {
        $filters['genre'] = trim($_GET['genre']);
    }

    if (!empty($_GET['language'])) {
        $filters['language'] = trim($_GET['language']);
    }

    $pagination = validate_pagination();

    try {
        $library_service = new LibraryService();
        $results = $library_service->search_public_user_library(
            $target_user_id,
            $query !== '' ? $query : null,
            $filters,
            $pagination['page'],
            $pagination['per_page']
        );
        send_success_response($results, 'OK');
    } catch (RuntimeException $exception) {
        $message = $exception->getMessage();
        $code = $message === 'Пользователь не найден' ? 404 : 403;
        send_error_response($message, $code);
    }
}

function handle_search_catalog(): void {
    require_method('GET');
    $user_id = require_authentication();

    $query = trim($_GET['query'] ?? '');
    $filters = [];

    if (!empty($_GET['status']) && in_array($_GET['status'], BOOK_STATUSES, true)) {
        $filters['status'] = $_GET['status'];
    }

    if (!empty($_GET['genre'])) {
        $filters['genre'] = trim($_GET['genre']);
    }

    if (!empty($_GET['language'])) {
        $filters['language'] = trim($_GET['language']);
    }

    $pagination = validate_pagination();

    $library_service = new LibraryService();
    $results = $library_service->search_catalog(
        $user_id,
        $query !== '' ? $query : null,
        $filters,
        $pagination['page'],
        $pagination['per_page']
    );

    send_success_response($results, 'OK');
}
