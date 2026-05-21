<?php
/**
 *  API: Контроллер таймера — сессии, растение, настройки, цели.
 *
 * НАЗНАЧЕНИЕ:
 *   Управляет HTTP-точками таймера чтения, растением, историей сессий,
 *   настройками помодоро и пользовательскими целями.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/timer_service.php';
require_once __DIR__ . '/../services/auth_service.php';

//  2. МАРШРУТИЗАЦИЯ  //

route_action([
    'start'             => 'handle_start_session',
    'pause'             => 'handle_pause_session',
    'resume'            => 'handle_resume_session',
    'complete'          => 'handle_complete_session',
    'cancel'            => 'handle_cancel_session',
    'get_active'        => 'handle_get_active_session',
    'get_history'       => 'handle_get_session_history',
    'get_settings'      => 'handle_get_settings',
    'update_settings'   => 'handle_update_settings',
    'get_plant'         => 'handle_get_plant',
    'get_plant_history' => 'handle_get_plant_history',
    'set_goal'          => 'handle_set_goal',
    'get_goals'         => 'handle_get_goals',
    'add_note'          => 'handle_add_reading_note',
    'list_session_notes' => 'handle_list_session_notes',
    'list_user_notes'   => 'handle_list_user_notes',
    'delete_note'       => 'handle_delete_reading_note',
]);

//  3. ОБРАБОТЧИКИ: СЕССИИ  //

function handle_start_session(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $duration = validate_required_int($input, 'duration', MIN_WORK_DURATION, MAX_WORK_DURATION, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    $book_id = null;

    if (!empty($input['book_id'])) {
        $book_id = filter_var($input['book_id'], FILTER_VALIDATE_INT);

        if ($book_id === false || $book_id < 1) {
            send_error_response('Некорректный ID книги', 400);
        }
    }

    $is_pomodoro = !empty($input['is_pomodoro']);

    try {
        $timer_service = new TimerService();
        $session = $timer_service->start_session($user_id, $duration, $book_id, $is_pomodoro);
        send_success_response($session, 'Сессия начата', 201);
    } catch (RuntimeException $exception) {
        $code = str_contains($exception->getMessage(), 'своей полки') ? 403 : 400;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_pause_session(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $session_id = validate_required_int($input, 'session_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $timer_service = new TimerService();
        $session = $timer_service->pause_session($user_id, $session_id);
        send_success_response($session, 'Сессия приостановлена');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Сессия не найдена' ? 404 : 400;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_resume_session(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $session_id = validate_required_int($input, 'session_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $timer_service = new TimerService();
        $session = $timer_service->resume_session($user_id, $session_id);
        send_success_response($session, 'Сессия возобновлена');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Сессия не найдена' ? 404 : 400;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_complete_session(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $session_id = validate_required_int($input, 'session_id', 1, PHP_INT_MAX, $errors);
    $actual_duration = validate_required_int($input, 'actual_duration', 0, MAX_WORK_DURATION * 2, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $timer_service = new TimerService();
        $result = $timer_service->complete_session($user_id, $session_id, $actual_duration);
        send_success_response($result, 'Сессия завершена');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Сессия не найдена' ? 404 : 400;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_cancel_session(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $session_id = validate_required_int($input, 'session_id', 1, PHP_INT_MAX, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    try {
        $timer_service = new TimerService();
        $session = $timer_service->cancel_session($user_id, $session_id);
        send_success_response($session, 'Сессия отменена');
    } catch (RuntimeException $exception) {
        $code = $exception->getMessage() === 'Сессия не найдена' ? 404 : 400;
        send_error_response($exception->getMessage(), $code);
    }
}

function handle_get_active_session(): void {
    require_method('GET');
    $user_id = require_authentication();

    $timer_service = new TimerService();
    $session = $timer_service->get_active_session($user_id);

    send_success_response($session, 'OK');
}

function handle_get_session_history(): void {
    require_method('GET');
    $user_id = require_authentication();

    $pagination = validate_pagination();

    $timer_service = new TimerService();
    $history = $timer_service->get_session_history($user_id, $pagination['page'], $pagination['per_page']);

    send_success_response($history, 'OK');
}

//  4. ОБРАБОТЧИКИ: НАСТРОЙКИ  //

function handle_get_settings(): void {
    require_method('GET');
    $user_id = require_authentication();

    $timer_service = new TimerService();
    $settings = $timer_service->get_timer_settings($user_id);

    send_success_response($settings, 'OK');
}

function handle_update_settings(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];
    $data = [];

    if (array_key_exists('setting_work_duration', $input)) {
        $data['setting_work_duration'] = validate_required_int(
            $input, 'setting_work_duration', MIN_WORK_DURATION, MAX_WORK_DURATION, $errors
        );
    }

    if (array_key_exists('setting_short_break', $input)) {
        $data['setting_short_break'] = validate_required_int(
            $input, 'setting_short_break', MIN_SHORT_BREAK, MAX_SHORT_BREAK, $errors
        );
    }

    if (array_key_exists('setting_long_break', $input)) {
        $data['setting_long_break'] = validate_required_int(
            $input, 'setting_long_break', MIN_LONG_BREAK, MAX_LONG_BREAK, $errors
        );
    }

    if (array_key_exists('setting_pomodoro_before_long_break', $input)) {
        $data['setting_pomodoro_before_long_break'] = validate_required_int(
            $input, 'setting_pomodoro_before_long_break',
            MIN_POMODORO_BEFORE_LONG_BREAK, MAX_POMODORO_BEFORE_LONG_BREAK, $errors
        );
    }

    if (array_key_exists('is_sound_enabled', $input)) {
        $data['is_sound_enabled'] = $input['is_sound_enabled'] ? 1 : 0;
    }

    if (array_key_exists('is_lo_fi_enabled', $input)) {
        $data['is_lo_fi_enabled'] = $input['is_lo_fi_enabled'] ? 1 : 0;
    }

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    if (empty($data)) {
        send_error_response('Нет данных для обновления', 400);
    }

    try {
        $timer_service = new TimerService();
        $settings = $timer_service->update_timer_settings($user_id, $data);
        send_success_response($settings, 'Настройки обновлены');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

//  5. ОБРАБОТЧИКИ: РАСТЕНИЕ  //

function handle_get_plant(): void {
    require_method('GET');
    $current_user_id = require_authentication();

    $target_user_id = isset($_GET['user_id']) ? (int) $_GET['user_id'] : $current_user_id;

    // Чужое растение — проверяем приватность
    if ($target_user_id !== $current_user_id) {
        $auth_service = new AuthService();

        try {
            $target_profile = $auth_service->get_profile($target_user_id);
        } catch (RuntimeException $exception) {
            send_error_response('Пользователь не найден', 404);
        }

        if (!empty($target_profile['is_plant_hidden'])) {
            send_error_response('Растение скрыто', 403);
        }
    }

    $timer_service = new TimerService();
    $plant = $timer_service->get_plant_state($target_user_id);

    send_success_response($plant, 'OK');
}

function handle_get_plant_history(): void {
    require_method('GET');
    $user_id = require_authentication();

    $timer_service = new TimerService();
    $history = $timer_service->get_plant_history($user_id);

    send_success_response($history, 'OK');
}

//  6. ОБРАБОТЧИКИ: ЦЕЛИ //

function handle_set_goal(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $errors = [];

    $goal_type = validate_enum($input, 'goal_type', GOAL_TYPES, $errors);
    $target_minutes = validate_required_int(
        $input, 'goal_target_minutes', MIN_GOAL_TARGET_MINUTES, MAX_GOAL_TARGET_MINUTES, $errors
    );
    $period_start = validate_required_string($input, 'goal_period_start', 10, $errors);

    if (!empty($errors)) {
        send_error_response('Ошибка валидации', 422, $errors);
    }

    // Валидация формата даты
    $date = date_create_from_format('Y-m-d', $period_start);

    if ($date === false) {
        send_error_response('Некорректный формат даты (ожидается YYYY-MM-DD)', 422, [
            'goal_period_start' => 'Некорректный формат даты',
        ]);
    }

    try {
        $timer_service = new TimerService();
        $goal = $timer_service->set_reading_goal($user_id, $goal_type, $target_minutes, $period_start);
        send_success_response($goal, 'Цель установлена', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

function handle_get_goals(): void {
    require_method('GET');
    $user_id = require_authentication();

    $timer_service = new TimerService();
    $goals = $timer_service->get_reading_goals($user_id);

    send_success_response($goals, 'OK');
}

//  7. ОБРАБОТЧИКИ: ЗАМЕТКИ ЧТЕНИЯ  //

function handle_add_reading_note(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $session_id = isset($input['session_id']) ? (int) $input['session_id'] : null;
    $book_id    = isset($input['book_id'])    ? (int) $input['book_id']    : null;
    $note_type  = isset($input['note_type']) ? trim((string) $input['note_type']) : NOTE_TYPE_THOUGHT;
    $note_text  = isset($input['note_text']) ? (string) $input['note_text'] : '';
    $note_page  = isset($input['note_page']) ? (int) $input['note_page']  : null;

    try {
        $timer_service = new TimerService();
        $note = $timer_service->create_reading_note(
            $user_id, $session_id, $book_id, $note_type, $note_text, $note_page
        );
        send_success_response($note, 'Заметка создана', 201);
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

function handle_list_session_notes(): void {
    require_method('GET');
    $user_id = require_authentication();

    $session_id = isset($_GET['session_id']) ? (int) $_GET['session_id'] : 0;
    if ($session_id < 1) {
        send_error_response('Некорректный session_id', 422);
    }

    try {
        $timer_service = new TimerService();
        $notes = $timer_service->list_session_notes($user_id, $session_id);
        send_success_response($notes, 'OK');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}

function handle_list_user_notes(): void {
    require_method('GET');
    $user_id = require_authentication();

    $book_id  = isset($_GET['book_id']) ? (int) $_GET['book_id'] : null;
    $page     = isset($_GET['page'])    ? max(1, (int) $_GET['page']) : PAGINATION_DEFAULT_PAGE;
    $per_page = isset($_GET['per_page']) ? (int) $_GET['per_page'] : NOTES_PER_PAGE;
    $per_page = max(1, min($per_page, PAGINATION_MAX_PER_PAGE));

    $timer_service = new TimerService();
    $payload = $timer_service->list_user_notes($user_id, $book_id, $page, $per_page);
    send_success_response($payload, 'OK');
}

function handle_delete_reading_note(): void {
    require_method('POST');
    $user_id = require_authentication();

    $input = get_json_input();
    $note_id = isset($input['note_id']) ? (int) $input['note_id'] : 0;
    if ($note_id < 1) {
        send_error_response('Некорректный note_id', 422);
    }

    try {
        $timer_service = new TimerService();
        $timer_service->delete_reading_note($user_id, $note_id);
        send_success_response(null, 'Заметка удалена');
    } catch (RuntimeException $exception) {
        send_error_response($exception->getMessage(), 400);
    }
}
