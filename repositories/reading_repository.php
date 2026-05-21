<?php
/**
 *  РЕПОЗИТОРИЙ: ReadingRepository — SQL-запросы к reading_sessions, timer_settings, reading_goals 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с сессиями чтения, настройками таймера и целями чтения.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС ReadingRepository  //

class ReadingRepository {

    private PDO $_database;

    public function __construct() {
        $this->_database = get_database_connection();
    }

    // СЕССИИ: ВСТАВКА  //

    public function insert_session(int $user_id, array $data): int {
        $statement = $this->_database->prepare(
            'INSERT INTO reading_sessions (user_id, book_id, session_duration_planned, session_status, is_pomodoro)
             VALUES (:user_id, :book_id, :session_duration_planned, :session_status, :is_pomodoro)'
        );

        $statement->execute([
            'user_id'                  => $user_id,
            'book_id'                  => $data['book_id'] ?? null,
            'session_duration_planned' => $data['session_duration_planned'],
            'session_status'           => SESSION_STATUS_ACTIVE,
            'is_pomodoro'              => $data['is_pomodoro'] ? 1 : 0,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  СЕССИИ: ПОИСК //

    public function find_session_by_id(int $session_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT rs.id, rs.user_id, rs.book_id, rs.session_duration_planned,
                    rs.session_duration_actual, rs.session_status, rs.is_pomodoro,
                    rs.pomodoro_count, rs.time_started, rs.time_finished,
                    rs.time_created, b.book_title, b.book_author,
                    (
                        SELECT e.edition_cover_path
                        FROM library_books lb
                        JOIN book_editions e ON e.id = lb.edition_id
                        WHERE lb.user_id = rs.user_id
                          AND e.book_id = rs.book_id
                          AND e.edition_cover_path IS NOT NULL
                          AND e.edition_cover_path <> \'\'
                        ORDER BY lb.time_created DESC
                        LIMIT 1
                    ) AS edition_cover_path
             FROM reading_sessions rs
             LEFT JOIN books b ON b.id = rs.book_id
             WHERE rs.id = :session_id'
        );

        $statement->execute(['session_id' => $session_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_active_session_by_user(int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT rs.id, rs.user_id, rs.book_id, rs.session_duration_planned,
                    rs.session_duration_actual, rs.session_status, rs.is_pomodoro,
                    rs.pomodoro_count, rs.time_started, rs.time_finished,
                    rs.time_created, b.book_title, b.book_author,
                    (
                        SELECT e.edition_cover_path
                        FROM library_books lb
                        JOIN book_editions e ON e.id = lb.edition_id
                        WHERE lb.user_id = rs.user_id
                          AND e.book_id = rs.book_id
                          AND e.edition_cover_path IS NOT NULL
                          AND e.edition_cover_path <> \'\'
                        ORDER BY lb.time_created DESC
                        LIMIT 1
                    ) AS edition_cover_path
             FROM reading_sessions rs
             LEFT JOIN books b ON b.id = rs.book_id
             WHERE rs.user_id = :user_id
               AND rs.session_status IN (:status_active, :status_paused)
             ORDER BY rs.time_started DESC
             LIMIT 1'
        );

        $statement->execute([
            'user_id'       => $user_id,
            'status_active' => SESSION_STATUS_ACTIVE,
            'status_paused' => SESSION_STATUS_PAUSED,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_user_sessions(int $user_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT rs.id, rs.user_id, rs.book_id, rs.session_duration_planned,
                    rs.session_duration_actual, rs.session_status, rs.is_pomodoro,
                    rs.pomodoro_count, rs.time_started, rs.time_finished, rs.time_created,
                    b.book_title
             FROM reading_sessions rs
             LEFT JOIN books b ON b.id = rs.book_id
             WHERE rs.user_id = :user_id
             ORDER BY rs.time_started DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('user_id', $user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    // СЕССИИ: ПОДСЧЁТ  //

    public function count_user_sessions(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as total
             FROM reading_sessions
             WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    public function count_completed_sessions(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as total
             FROM reading_sessions
             WHERE user_id = :user_id
               AND session_status = :status'
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => SESSION_STATUS_COMPLETED,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    // СЕССИИ: ОБНОВЛЕНИЕ  //

    public function update_session_status(int $session_id, string $status): bool {
        $set_finished = in_array($status, [SESSION_STATUS_COMPLETED, SESSION_STATUS_CANCELLED], true);

        $sql = 'UPDATE reading_sessions SET session_status = :status';

        if ($set_finished) {
            $sql .= ', time_finished = NOW()';
        }

        $sql .= ' WHERE id = :session_id';

        $statement = $this->_database->prepare($sql);

        return $statement->execute([
            'session_id' => $session_id,
            'status'     => $status,
        ]);
    }

    public function update_session_actual_duration(int $session_id, int $actual_duration): bool {
        $statement = $this->_database->prepare(
            'UPDATE reading_sessions
             SET session_duration_actual = :actual_duration
             WHERE id = :session_id'
        );

        return $statement->execute([
            'session_id'      => $session_id,
            'actual_duration' => $actual_duration,
        ]);
    }

    // НАСТРОЙКИ ТАЙМЕРА  //

    public function find_timer_settings(int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, setting_work_duration, setting_short_break,
                    setting_long_break, setting_pomodoro_before_long_break,
                    is_sound_enabled, is_lo_fi_enabled, time_created, time_updated
             FROM timer_settings
             WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function insert_timer_settings(int $user_id): int {
        $statement = $this->_database->prepare(
            'INSERT INTO timer_settings (user_id)
             VALUES (:user_id)'
        );

        $statement->execute(['user_id' => $user_id]);

        return (int) $this->_database->lastInsertId();
    }

    public function update_timer_settings(int $user_id, array $settings): bool {
        $fields = [];
        $params = ['user_id' => $user_id];

        $allowed = [
            'setting_work_duration',
            'setting_short_break',
            'setting_long_break',
            'setting_pomodoro_before_long_break',
            'is_sound_enabled',
            'is_lo_fi_enabled',
        ];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $settings)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $settings[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE timer_settings SET ' . implode(', ', $fields) . ' WHERE user_id = :user_id';
        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    //  ЦЕЛИ ЧТЕНИЯ  //

    public function insert_reading_goal(int $user_id, array $data): int {
        $statement = $this->_database->prepare(
            'INSERT INTO reading_goals (user_id, goal_type, goal_target_minutes, goal_period_start)
             VALUES (:user_id, :goal_type, :goal_target_minutes, :goal_period_start)
             ON DUPLICATE KEY UPDATE goal_target_minutes = VALUES(goal_target_minutes)'
        );

        $statement->execute([
            'user_id'              => $user_id,
            'goal_type'            => $data['goal_type'],
            'goal_target_minutes'  => $data['goal_target_minutes'],
            'goal_period_start'    => $data['goal_period_start'],
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function find_reading_goal(int $user_id, string $goal_type, string $period_start): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, goal_type, goal_target_minutes,
                    goal_period_start, time_created, time_updated
             FROM reading_goals
             WHERE user_id = :user_id
               AND goal_type = :goal_type
               AND goal_period_start = :goal_period_start'
        );

        $statement->execute([
            'user_id'           => $user_id,
            'goal_type'         => $goal_type,
            'goal_period_start' => $period_start,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_user_reading_goals(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, goal_type, goal_target_minutes,
                    goal_period_start, time_created, time_updated
             FROM reading_goals
             WHERE user_id = :user_id
             ORDER BY goal_period_start DESC'
        );

        $statement->execute(['user_id' => $user_id]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function sum_reading_minutes_in_period(int $user_id, string $from, string $to): int {
        $statement = $this->_database->prepare(
            'SELECT COALESCE(SUM(FLOOR(session_duration_actual / ' . SECONDS_PER_MINUTE . ')), 0) as total_minutes
             FROM reading_sessions
             WHERE user_id = :user_id
               AND session_status = :status
               AND DATE(time_finished) >= :date_from
               AND DATE(time_finished) <= :date_to'
        );

        $statement->execute([
            'user_id'   => $user_id,
            'status'    => SESSION_STATUS_COMPLETED,
            'date_from' => $from,
            'date_to'   => $to,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total_minutes'];
    }

    //  СТАТИСТИКА  //

    public function sum_total_reading_seconds(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COALESCE(SUM(session_duration_actual), 0) as total_seconds
             FROM reading_sessions
             WHERE user_id = :user_id
               AND session_status = :status'
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => SESSION_STATUS_COMPLETED,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total_seconds'];
    }

    public function avg_session_duration_seconds(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COALESCE(FLOOR(AVG(session_duration_actual)), 0) as avg_seconds
             FROM reading_sessions
             WHERE user_id = :user_id
               AND session_status = :status'
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => SESSION_STATUS_COMPLETED,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['avg_seconds'];
    }

    public function sum_reading_minutes_by_day(int $user_id, string $from, string $to): array {
        $statement = $this->_database->prepare(
            'SELECT DATE(time_finished) as date,
                    COALESCE(SUM(FLOOR(session_duration_actual / ' . SECONDS_PER_MINUTE . ')), 0) as total_minutes
             FROM reading_sessions
             WHERE user_id = :user_id
               AND session_status = :status
               AND DATE(time_finished) >= :date_from
               AND DATE(time_finished) <= :date_to
             GROUP BY DATE(time_finished)
             ORDER BY date ASC'
        );

        $statement->execute([
            'user_id'   => $user_id,
            'status'    => SESSION_STATUS_COMPLETED,
            'date_from' => $from,
            'date_to'   => $to,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function sum_reading_minutes_by_book(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT rs.book_id, b.book_title, b.book_author,
                    COALESCE(SUM(FLOOR(rs.session_duration_actual / ' . SECONDS_PER_MINUTE . ')), 0) as total_minutes
             FROM reading_sessions rs
             JOIN books b ON b.id = rs.book_id
             WHERE rs.user_id = :user_id
               AND rs.session_status = :status
               AND rs.book_id IS NOT NULL
             GROUP BY rs.book_id, b.book_title, b.book_author
             ORDER BY total_minutes DESC
             LIMIT ' . STATISTICS_TOP_BOOKS_LIMIT
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => SESSION_STATUS_COMPLETED,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function sum_reading_minutes_by_genre(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT b.book_genre,
                    COUNT(DISTINCT rs.book_id) as book_count,
                    COALESCE(SUM(FLOOR(rs.session_duration_actual / ' . SECONDS_PER_MINUTE . ')), 0) as total_minutes
             FROM reading_sessions rs
             JOIN books b ON b.id = rs.book_id
             WHERE rs.user_id = :user_id
               AND rs.session_status = :status
               AND rs.book_id IS NOT NULL
               AND b.book_genre IS NOT NULL
               AND b.book_genre != ""
             GROUP BY b.book_genre
             ORDER BY total_minutes DESC'
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => SESSION_STATUS_COMPLETED,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_reading_streak_days(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT DATE(time_finished) as session_date
             FROM reading_sessions
             WHERE user_id = :user_id
               AND session_status = :status
             ORDER BY session_date DESC'
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => SESSION_STATUS_COMPLETED,
        ]);

        $dates = $statement->fetchAll(PDO::FETCH_COLUMN);

        if (empty($dates)) {
            return 0;
        }

        $streak = 0;
        $expected_date = date('Y-m-d');

        // Если сегодня ещё не читали — начинаем отсчёт со вчера
        if ($dates[0] !== $expected_date) {
            $expected_date = date('Y-m-d', strtotime('-1 day'));
        }

        foreach ($dates as $session_date) {
            if ($session_date === $expected_date) {
                $streak++;
                $expected_date = date('Y-m-d', strtotime($expected_date . ' -1 day'));
            } else {
                break;
            }
        }

        return $streak;
    }

    //  3. ЗАМЕТКИ ЧТЕНИЯ  //

    public function insert_reading_note(
        int $user_id,
        ?int $session_id,
        ?int $book_id,
        string $note_type,
        string $note_text,
        ?int $note_page
    ): int {
        $statement = $this->_database->prepare(
            'INSERT INTO reading_notes
                (user_id, session_id, book_id, note_type, note_text, note_page)
             VALUES (:user_id, :session_id, :book_id, :note_type, :note_text, :note_page)'
        );
        $statement->execute([
            'user_id'    => $user_id,
            'session_id' => $session_id,
            'book_id'    => $book_id,
            'note_type'  => $note_type,
            'note_text'  => $note_text,
            'note_page'  => $note_page,
        ]);
        return (int) $this->_database->lastInsertId();
    }

    public function find_reading_note_by_id(int $note_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, session_id, book_id, note_type, note_text, note_page, time_created
             FROM reading_notes WHERE id = :note_id'
        );
        $statement->execute(['note_id' => $note_id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function find_reading_notes_by_session(int $session_id): array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, session_id, book_id, note_type, note_text, note_page, time_created
             FROM reading_notes WHERE session_id = :session_id ORDER BY time_created ASC'
        );
        $statement->execute(['session_id' => $session_id]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find_reading_notes_by_user(int $user_id, ?int $book_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;
        $sql = 'SELECT id, user_id, session_id, book_id, note_type, note_text, note_page, time_created
                FROM reading_notes WHERE user_id = :user_id';
        $params = ['user_id' => $user_id];

        if ($book_id !== null) {
            $sql .= ' AND book_id = :book_id';
            $params['book_id'] = $book_id;
        }

        $sql .= ' ORDER BY time_created DESC LIMIT :limit OFFSET :offset';

        $statement = $this->_database->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value, PDO::PARAM_INT);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_reading_notes_by_user(int $user_id, ?int $book_id): int {
        $sql = 'SELECT COUNT(*) AS cnt FROM reading_notes WHERE user_id = :user_id';
        $params = ['user_id' => $user_id];
        if ($book_id !== null) {
            $sql .= ' AND book_id = :book_id';
            $params['book_id'] = $book_id;
        }
        $statement = $this->_database->prepare($sql);
        $statement->execute($params);
        return (int) ($statement->fetchColumn() ?: 0);
    }

    public function delete_reading_note(int $note_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM reading_notes WHERE id = :note_id'
        );
        return $statement->execute(['note_id' => $note_id]);
    }
}
