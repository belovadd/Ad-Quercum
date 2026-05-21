<?php
/**
 * СЕРВИС: StatisticsService — Бизнес-логика статистики чтения 
 *
 * НАЗНАЧЕНИЕ:
 * Агрегация данных для страницы статистики: сводка, разбивка по дням,
 * прогресс целей, статистика по книгам и жанрам.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/reading_repository.php';
require_once __DIR__ . '/../repositories/book_repository.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС StatisticsService  //

class StatisticsService {

    private ReadingRepository $_reading_repository;
    private BookRepository $_book_repository;

    public function __construct() {
        $this->_reading_repository = new ReadingRepository();
        $this->_book_repository = new BookRepository();
    }

    // СВОДКА //

    public function get_overview(int $user_id): array {
        $total_seconds = $this->_reading_repository->sum_total_reading_seconds($user_id);
        $total_sessions = $this->_reading_repository->count_completed_sessions($user_id);
        $avg_seconds = $this->_reading_repository->avg_session_duration_seconds($user_id);
        $streak_days = $this->_reading_repository->count_reading_streak_days($user_id);

        $books_finished = $this->_book_repository->count_user_books(
            $user_id, null, ['status' => BOOK_STATUS_FINISHED]
        );
        $books_finished_year = $this->_book_repository->count_user_finished_books_for_year(
            $user_id, (int) date('Y')
        );
        $books_reading = $this->_book_repository->count_user_books(
            $user_id, null, ['status' => BOOK_STATUS_READING]
        );
        $total_pages = $this->_book_repository->sum_user_finished_pages($user_id);

        return [
            'total_minutes'       => (int) floor($total_seconds / SECONDS_PER_MINUTE),
            'total_sessions'      => $total_sessions,
            'avg_session_minutes' => (int) floor($avg_seconds / SECONDS_PER_MINUTE),
            'current_streak_days' => $streak_days,
            'books_finished'      => $books_finished,
            'books_finished_year' => $books_finished_year,
            'books_reading'       => $books_reading,
            'total_pages'         => $total_pages,
        ];
    }

    //  РАЗБИВКА ПО ДНЯМ //

    public function get_daily_breakdown(int $user_id, string $from, string $to): array {
        $raw_data = $this->_reading_repository->sum_reading_minutes_by_day($user_id, $from, $to);

        // Индексируем по дате для быстрого доступа
        $data_by_date = [];

        foreach ($raw_data as $row) {
            $data_by_date[$row['date']] = (int) $row['total_minutes'];
        }

        // Заполняем все дни в диапазоне
        $result = [];
        $current_date = new DateTime($from);
        $end_date = new DateTime($to);

        while ($current_date <= $end_date) {
            $date_string = $current_date->format('Y-m-d');

            $result[] = [
                'date'          => $date_string,
                'total_minutes' => $data_by_date[$date_string] ?? 0,
            ];

            $current_date->modify('+1 day');
        }

        return $result;
    }

    // ПРОГРЕСС ЦЕЛЕЙ  //

    public function get_goal_progress(int $user_id): array {
        $result = [];

        foreach (GOAL_TYPES as $goal_type) {
            $period_start = $this->get_current_period_start($goal_type);
            $period_end = $this->get_current_period_end($goal_type);

            $goal = $this->_reading_repository->find_reading_goal($user_id, $goal_type, $period_start);

            if ($goal === null) {
                continue;
            }

            $target_minutes = (int) $goal['goal_target_minutes'];
            $actual_minutes = $this->_reading_repository->sum_reading_minutes_in_period(
                $user_id, $period_start, $period_end
            );

            $percentage = $target_minutes > 0
                ? min(100, (int) floor($actual_minutes / $target_minutes * 100))
                : 0;

            $result[] = [
                'goal_type'      => $goal_type,
                'target_minutes' => $target_minutes,
                'actual_minutes' => $actual_minutes,
                'percentage'     => $percentage,
                'period_start'   => $period_start,
                'period_end'     => $period_end,
            ];
        }

        return $result;
    }

    // СТАТИСТИКА ПО КНИГАМ  //

    public function get_book_stats(int $user_id): array {
        return $this->_reading_repository->sum_reading_minutes_by_book($user_id);
    }

    //  СТАТИСТИКА ПО ЖАНРАМ  //

    public function get_genre_stats(int $user_id): array {
        return $this->_reading_repository->sum_reading_minutes_by_genre($user_id);
    }

    //  ВСПОМОГАТЕЛЬНЫЕ ПРИВАТНЫЕ МЕТОДЫ  //

    private function get_current_period_start(string $goal_type): string {
        switch ($goal_type) {
            case GOAL_TYPE_DAILY:
                return date('Y-m-d');

            case GOAL_TYPE_WEEKLY:
                // Понедельник текущей недели
                return date('Y-m-d', strtotime('monday this week'));

            case GOAL_TYPE_MONTHLY:
                return date('Y-m-01');

            case GOAL_TYPE_YEARLY:
                return date('Y-01-01');

            default:
                return date('Y-m-d');
        }
    }

    private function get_current_period_end(string $goal_type): string {
        switch ($goal_type) {
            case GOAL_TYPE_DAILY:
                return date('Y-m-d');

            case GOAL_TYPE_WEEKLY:
                // Воскресенье текущей недели
                return date('Y-m-d', strtotime('sunday this week'));

            case GOAL_TYPE_MONTHLY:
                return date('Y-m-t');

            case GOAL_TYPE_YEARLY:
                return date('Y-12-31');

            default:
                return date('Y-m-d');
        }
    }
}
