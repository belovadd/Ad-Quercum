<?php
/**
 * API: Контроллер произведений и изданий — двухшаговое создание, автокомплит,
 * редактирование, модерация и работа с оценками.
 *
 * НАЗНАЧЕНИЕ:
 *   Принимает запросы каталога, карточки произведения и формы добавления,
 *   проверяет входные параметры и передаёт доменные операции в BookService.
 *
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/book_service.php';

//  2. МАРШРУТИЗАЦИЯ  //

route_action([
    'autocomplete'         => 'handle_autocomplete',
    'get'                  => 'handle_get_book',
    'get_reviews'          => 'handle_get_book_reviews',
    'create_book'          => 'handle_create_book',
    'update_book'          => 'handle_update_book',
    'delete_book'          => 'handle_delete_book',
    'create_edition'       => 'handle_create_edition',
    'update_edition'       => 'handle_update_edition',
    'delete_edition'       => 'handle_delete_edition',
    'upload_edition_cover' => 'handle_upload_edition_cover',
    'update_status'        => 'handle_update_book_status',
    'rate'                 => 'handle_rate_book',
    'delete_review'        => 'handle_delete_book_review',
]);

// 3. ВНУТРЕННИЕ ХЕЛПЕРЫ ВАЛИДАЦИИ  //

function extract_book_fields(array $input, bool $required, array &$errors): array {
    $data = [];

    if ($required || array_key_exists('book_title', $input)) {
        $data['book_title'] = validate_required_string(
            $input, 'book_title', MAX_BOOK_TITLE_LENGTH, $errors
        );
    }

    if ($required || array_key_exists('book_author', $input)) {
        $data['book_author'] = validate_required_string(
            $input, 'book_author', MAX_BOOK_AUTHOR_LENGTH, $errors
        );
    }

    if (array_key_exists('book_genre', $input)) {
        $data['book_genre'] = validate_optional_string(
            $input, 'book_genre', MAX_BOOK_GENRE_LENGTH, $errors
        );
    }

    if (array_key_exists('book_year_published', $input)) {
        $data['book_year_published'] = validate_optional_int(
            $input, 'book_year_published',
            MIN_BOOK_YEAR_PUBLISHED, MAX_BOOK_YEAR_PUBLISHED, $errors
        );
    }

    if (array_key_exists('book_original_language', $input)) {
        $data['book_original_language'] = validate_optional_string(
            $input, 'book_original_language', MAX_EDITION_LANGUAGE_LENGTH, $errors
        );
    }

    if (array_key_exists('book_description', $input)) {
        $data['book_description'] = validate_optional_text(
            $input, 'book_description', $errors, MAX_BOOK_DESCRIPTION_LENGTH
        );
    }

    return $data;
}


function extract_edition_fields(array $input, array &$errors): array {
    $data = [];

    if (array_key_exists('edition_isbn', $input)) {
        $isbn = validate_optional_string(
            $input, 'edition_isbn', MAX_EDITION_ISBN_LENGTH, $errors
        );
        // Без жёсткой ISBN-валидации (10/13 + контрольная сумма):
        // пользователь может ввести с дефисами или префиксом «ISBN».
        $data['edition_isbn'] = $isbn !== null ? trim($isbn) : null;
    }

    if (array_key_exists('edition_language', $input)) {
        $data['edition_language'] = validate_optional_string(
            $input, 'edition_language', MAX_EDITION_LANGUAGE_LENGTH, $errors
        );
    }

    if (array_key_exists('edition_translator', $input)) {
        $data['edition_translator'] = validate_optional_string(
            $input, 'edition_translator', MAX_EDITION_TRANSLATOR_LENGTH, $errors
        );
    }

    if (array_key_exists('edition_publisher', $input)) {
        $data['edition_publisher'] = validate_optional_string(
            $input, 'edition_publisher', MAX_EDITION_PUBLISHER_LENGTH, $errors
        );
    }

    if (array_key_exists('edition_series', $input)) {
        $data['edition_series'] = validate_optional_string(
            $input, 'edition_series', MAX_EDITION_SERIES_LENGTH, $errors
        );
    }

    if (array_key_exists('edition_pages', $input)) {
        $data['edition_pages'] = validate_optional_int(
            $input, 'edition_pages', MIN_EDITION_PAGES, MAX_EDITION_PAGES, $errors
        );
    }

    if (array_key_exists('edition_type', $input)) {
        // edition_type — необязательный enum; используем validate_optional_string
        // и затем сверяем со списком EDITION_TYPES.
        $type = validate_optional_string($input, 'edition_type', 32, $errors);
        if ($type !== null && !in_array($type, EDITION_TYPES, true)) {
            $errors['edition_type'] = 'Недопустимый тип издания';
        } else {
            $data['edition_type'] = $type;
        }
    }

    return $data;
}

//  4. ОБРАБОТЧИКИ — ЧТЕНИЕ И АВТОКОМПЛИТ  //

function handle_autocomplete(): void {
    require_method('GET');
    $user_id = require_authentication();

    $query = trim($_GET['query'] ?? '');

    $book_service = new BookService();
    $items = $book_service->search_autocomplete($query, $user_id);

    send_success_response([
        'items' => $items,
        'query' => $query,
    ], 'OK');
}

function handle_get_book(): void {
    require_method('GET');
    $user_id = require_authentication();
    $user_role = get_current_user_role();

    $book_id = filter_var($_GET['book_id'] ?? '', FILTER_VALIDATE_INT);

    if ($book_id === false || $book_id < 1) {
        send_error_response('Некорректный ID произведения', 400);
    }

    try {
        $book_service = new BookService();
        $result = $book_service->get_book_with_editions($book_id, $user_id, $user_role);
        send_success_response($result, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_get_book_reviews(): void {
    require_method('GET');
    $user_id = require_authentication();

    $book_id = filter_var($_GET['book_id'] ?? '', FILTER_VALIDATE_INT);

    if ($book_id === false || $book_id < 1) {
        send_error_response('Некорректный ID произведения', 400);
    }

    $pagination = validate_pagination();

    try {
        $book_service = new BookService();
        $results = $book_service->get_book_reviews(
            $book_id, $pagination['page'], $pagination['per_page'], $user_id
        );
        send_success_response($results, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

//  5. ОБРАБОТЧИКИ — ПРОИЗВЕДЕНИЯ //

function handle_create_book(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $book_data    = extract_book_fields($input, true, $errors);
    $edition_data = extract_edition_fields($input, $errors);
    $library_id   = array_key_exists('library_id', $input) && $input['library_id'] !== null
        ? validate_required_int($input, 'library_id', 1, PHP_INT_MAX, $errors)
        : null;

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $result = $book_service->create_book_with_first_edition(
            $user_id, $book_data, $edition_data, $library_id
        );
        send_success_response($result, 'Произведение и издание добавлены', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    } catch (Throwable $exception) {
        error_log('books.create_book: ' . $exception->getMessage());
        send_error_response('Не удалось добавить книгу', 500);
    }
}

function handle_update_book(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $book_id   = validate_required_int($input, 'book_id', 1, PHP_INT_MAX, $errors);
    $book_data = extract_book_fields($input, false, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    if (empty($book_data)) {
        send_error_response('Нет данных для обновления', 400);
    }

    try {
        $book_service = new BookService();
        $book = $book_service->update_book($user_id, $book_id, $book_data);
        send_success_response($book, 'Произведение обновлено');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Произведение не найдено' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_delete_book(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $book_id = validate_required_int($input, 'book_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $book_service->delete_book($user_id, $book_id);
        send_success_response(null, 'Произведение удалено');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Произведение не найдено' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

//  🧱 6. ОБРАБОТЧИКИ — ИЗДАНИЯ //

function handle_create_edition(): void {
    require_method('POST');
    $user_id = require_authentication();
    $user_role = get_current_user_role();

    $input  = get_json_input();
    $errors = [];

    $book_id      = validate_required_int($input, 'book_id', 1, PHP_INT_MAX, $errors);
    $edition_data = extract_edition_fields($input, $errors);
    $library_id   = array_key_exists('library_id', $input) && $input['library_id'] !== null
        ? validate_required_int($input, 'library_id', 1, PHP_INT_MAX, $errors)
        : null;

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $result = $book_service->create_edition_for_book(
            $user_id, $book_id, $edition_data, $library_id, $user_role
        );
        send_success_response($result, 'Издание добавлено', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    } catch (Throwable $exception) {
        error_log('books.create_edition: ' . $exception->getMessage());
        send_error_response('Не удалось добавить издание', 500);
    }
}

function handle_update_edition(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $edition_id   = validate_required_int($input, 'edition_id', 1, PHP_INT_MAX, $errors);
    $edition_data = extract_edition_fields($input, $errors);
    $remove_cover = false;

    if (array_key_exists('remove_edition_cover', $input)) {
        $remove_cover = filter_var(
            $input['remove_edition_cover'],
            FILTER_VALIDATE_BOOLEAN,
            FILTER_NULL_ON_FAILURE
        );

        if ($remove_cover === null) {
            $errors['remove_edition_cover'] = 'Некорректный признак удаления обложки';
            $remove_cover = false;
        }
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    if (empty($edition_data) && !$remove_cover) {
        send_error_response('Нет данных для обновления', 400);
    }

    try {
        $book_service = new BookService();
        $edition = $book_service->update_edition(
            $user_id, $edition_id, $edition_data, $remove_cover
        );
        send_success_response($edition, 'Издание обновлено');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Издание не найдено' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_delete_edition(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input  = get_json_input();
    $errors = [];

    $edition_id = validate_required_int($input, 'edition_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $book_service->delete_edition($user_id, $edition_id);
        send_success_response(null, 'Издание удалено');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Издание не найдено' ? 404 : 403;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_upload_edition_cover(): void {
    require_method('POST');
    $user_id = require_authentication();

    $edition_id = filter_var($_POST['edition_id'] ?? '', FILTER_VALIDATE_INT);

    if ($edition_id === false || $edition_id < 1) {
        send_error_response('Некорректный ID издания', 400);
    }

    if (!isset($_FILES['edition_cover'])) {
        send_error_response('Файл обложки не загружен', 400);
    }

    try {
        $book_service = new BookService();
        $edition = $book_service->upload_edition_cover(
            $user_id, $edition_id, $_FILES['edition_cover']
        );
        send_success_response($edition, 'Обложка загружена');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

// 🧱 7. ОБРАБОТЧИКИ — СТАТУС И ОЦЕНКИ  //

function handle_update_book_status(): void {
    require_method('POST');
    $user_id = require_authentication();
    $user_role = get_current_user_role();

    $input  = get_json_input();
    $errors = [];

    $book_id = validate_required_int($input, 'book_id', 1, PHP_INT_MAX, $errors);
    $status  = validate_enum($input, 'book_status', BOOK_STATUSES, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $book = $book_service->update_book_status($user_id, $book_id, $status, $user_role);
        send_success_response($book, 'Статус обновлён');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_rate_book(): void {
    require_method('POST');
    $user_id = require_authentication();
    $user_role = get_current_user_role();

    $input  = get_json_input();
    $errors = [];

    $book_id = validate_required_int($input, 'book_id', 1, PHP_INT_MAX, $errors);
    $score   = array_key_exists('rate_score', $input)
        ? validate_optional_int($input, 'rate_score', MIN_RATE_SCORE, MAX_RATE_SCORE, $errors)
        : null;
    $review  = array_key_exists('rate_review', $input)
        ? validate_optional_text($input, 'rate_review', $errors)
        : null;
    $notes   = array_key_exists('rate_notes', $input)
        ? validate_optional_text($input, 'rate_notes', $errors)
        : null;

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $book = $book_service->rate_book($user_id, $book_id, $score, $review, $notes, $user_role);
        send_success_response($book, 'Оценка сохранена');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}

function handle_delete_book_review(): void {
    require_method('POST');
    $user_id = require_authentication();
    $user_role = get_current_user_role();

    $input  = get_json_input();
    $errors = [];

    $book_id = validate_required_int($input, 'book_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $book_service = new BookService();
        $book = $book_service->delete_book_review($user_id, $book_id, $user_role);
        send_success_response($book, 'Рецензия удалена');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 404);
    }
}
