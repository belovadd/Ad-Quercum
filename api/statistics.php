<?php
/**
 * API: Контроллер статистики — сводка, активность по дням, цели, книги, жанры.
 *
 * НАЗНАЧЕНИЕ:
 *   Отдаёт статистику чтения для личного кабинета и страницы аналитики:
 *   обзор, дневную активность, цели, книги и жанровое распределение.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/session.php';
require_once __DIR__ . '/../core/request_handler.php';
require_once __DIR__ . '/../core/response_builder.php';
require_once __DIR__ . '/../core/input_validator.php';
require_once __DIR__ . '/../services/statistics_service.php';
require_once __DIR__ . '/../services/auth_service.php';

// 2. МАРШРУТИЗАЦИЯ  //

route_action([
    'get_overview' => 'handle_get_overview',
    'get_daily'    => 'handle_get_daily',
    'get_goals'    => 'handle_get_goals',
    'get_books'    => 'handle_get_books',
    'get_genres'   => 'handle_get_genres',
]);

//  3. ОБРАБОТЧИКИ //

function handle_get_overview(): void {
    require_method('GET');
    $current_user_id = require_authentication();

    $target_user_id = resolve_statistics_user_id($current_user_id);

    $statistics_service = new StatisticsService();
    $overview = $statistics_service->get_overview($target_user_id);

    send_success_response($overview, 'OK');
}

function handle_get_daily(): void {
    require_method('GET');
    $user_id = require_authentication();

    // Если задан days — пересчитываем from/to относительно сегодня (heatmap год по умолчанию).
    $days_param = isset($_GET['days']) ? (int) $_GET['days'] : 0;
    if ($days_param > 0) {
        $days = max(1, min($days_param, STATISTICS_DAYS_MAX));
        $from = date('Y-m-d', strtotime('-' . ($days - 1) . ' days'));
        $to   = date('Y-m-d');
    } else {
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-' . (STATISTICS_DAYS_DEFAULT - 1) . ' days'));
        $to   = $_GET['to']   ?? date('Y-m-d');
    }

    // Валидация формата дат
    $from_date = date_create_from_format('Y-m-d', $from);
    $to_date = date_create_from_format('Y-m-d', $to);

    if ($from_date === false || $to_date === false) {
        send_error_response('Некорректный формат даты (ожидается YYYY-MM-DD)', 422);
    }

    $statistics_service = new StatisticsService();
    $daily = $statistics_service->get_daily_breakdown($user_id, $from, $to);

    send_success_response($daily, 'OK');
}

function handle_get_goals(): void {
    require_method('GET');
    $user_id = require_authentication();

    $statistics_service = new StatisticsService();
    $goals = $statistics_service->get_goal_progress($user_id);

    send_success_response($goals, 'OK');
}

function handle_get_books(): void {
    require_method('GET');
    $current_user_id = require_authentication();

    $target_user_id = resolve_statistics_user_id($current_user_id);

    $statistics_service = new StatisticsService();
    $books = $statistics_service->get_book_stats($target_user_id);

    send_success_response($books, 'OK');
}

function handle_get_genres(): void {
    require_method('GET');
    $current_user_id = require_authentication();

    $target_user_id = resolve_statistics_user_id($current_user_id);

    $statistics_service = new StatisticsService();
    $genres = $statistics_service->get_genre_stats($target_user_id);

    send_success_response($genres, 'OK');
}

//  4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ  //

function resolve_statistics_user_id(int $current_user_id): int {
    $target_user_id = isset($_GET['user_id']) ? (int) $_GET['user_id'] : $current_user_id;

    // Своя статистика — без ограничений
    if ($target_user_id === $current_user_id) {
        return $current_user_id;
    }

    // Чужая статистика — проверяем приватность
    $auth_service = new AuthService();

    try {
        $target_profile = $auth_service->get_profile($target_user_id);
    } catch (RuntimeException $exception) {
        send_error_response('Пользователь не найден', 404);
    }

    if (!empty($target_profile['is_stats_hidden'])) {
        send_error_response('Статистика скрыта', 403);
    }

    return $target_user_id;
}
