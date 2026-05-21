<?php
/**
 * СЕРВИС: TimerService — Бизнес-логика таймера, растения и целей чтения 
 *
 * НАЗНАЧЕНИЕ:
 * Управление сессиями чтения (старт, пауза, завершение, отмена),
 * автоматический рост растения на основе завершённых сессий,
 * настройки таймера, цели чтения.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/reading_repository.php';
require_once __DIR__ . '/../repositories/plant_repository.php';
require_once __DIR__ . '/../repositories/book_repository.php';
require_once __DIR__ . '/../repositories/library_repository.php';
require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/../core/pagination_helper.php';

//  2. КЛАСС TimerService  //

class TimerService {

    private ReadingRepository $_reading_repository;
    private PlantRepository $_plant_repository;
    private BookRepository $_book_repository;
    private LibraryRepository $_library_repository;

    public function __construct() {
        $this->_reading_repository = new ReadingRepository();
        $this->_plant_repository = new PlantRepository();
        $this->_book_repository = new BookRepository();
        $this->_library_repository = new LibraryRepository();
    }

    // СЕССИИ: УПРАВЛЕНИЕ  //

    public function start_session(int $user_id, int $duration, ?int $book_id, bool $is_pomodoro): array {
        $active = $this->_reading_repository->find_active_session_by_user($user_id);

        if ($active !== null) {
            throw new RuntimeException('У вас уже есть активная сессия чтения');
        }

        if ($book_id !== null && !$this->_library_repository->has_user_book($user_id, $book_id)) {
            throw new RuntimeException('Можно привязать только книгу со своей полки');
        }

        // Создаём plant_state, если нет
        $plant = $this->_plant_repository->find_plant_state($user_id);

        if ($plant === null) {
            $this->_plant_repository->insert_plant_state($user_id);
        }

        $session_id = $this->_reading_repository->insert_session($user_id, [
            'session_duration_planned' => $duration,
            'book_id'                  => $book_id,
            'is_pomodoro'              => $is_pomodoro,
        ]);

        return $this->_reading_repository->find_session_by_id($session_id);
    }

    public function pause_session(int $user_id, int $session_id): array {
        $session = $this->validate_session_ownership($user_id, $session_id);

        if ($session['session_status'] !== SESSION_STATUS_ACTIVE) {
            throw new RuntimeException('Можно поставить на паузу только активную сессию');
        }

        $this->_reading_repository->update_session_status($session_id, SESSION_STATUS_PAUSED);

        return $this->_reading_repository->find_session_by_id($session_id);
    }

    public function resume_session(int $user_id, int $session_id): array {
        $session = $this->validate_session_ownership($user_id, $session_id);

        if ($session['session_status'] !== SESSION_STATUS_PAUSED) {
            throw new RuntimeException('Можно возобновить только сессию на паузе');
        }

        $this->_reading_repository->update_session_status($session_id, SESSION_STATUS_ACTIVE);

        return $this->_reading_repository->find_session_by_id($session_id);
    }

    public function complete_session(int $user_id, int $session_id, int $actual_duration): array {
        $session = $this->validate_session_ownership($user_id, $session_id);

        if (!in_array($session['session_status'], [SESSION_STATUS_ACTIVE, SESSION_STATUS_PAUSED], true)) {
            throw new RuntimeException('Можно завершить только активную или приостановленную сессию');
        }

        // 1. Обновляем сессию
        $this->_reading_repository->update_session_status($session_id, SESSION_STATUS_COMPLETED);
        $this->_reading_repository->update_session_actual_duration($session_id, $actual_duration);

        // 2. Инкрементируем счётчик
        $this->_plant_repository->increment_session_count($user_id);

        // 3. Проверяем рост
        $growth_result = $this->check_plant_growth($user_id);

        // 4. Собираем ответ
        $updated_session = $this->_reading_repository->find_session_by_id($session_id);
        $plant_state = $this->_plant_repository->find_plant_state($user_id);

        return [
            'session' => $updated_session,
            'plant'   => [
                'stage'                    => $plant_state['plant_stage'],
                'image_url'                => PLANT_IMAGE_URLS[$plant_state['plant_stage']] ?? '',
                'session_count_completed'  => (int) $plant_state['session_count_completed'],
                'grew'                     => $growth_result['grew'],
                'old_stage'                => $growth_result['old_stage'] ?? null,
                'new_stage'                => $growth_result['new_stage'] ?? null,
            ],
        ];
    }

    public function cancel_session(int $user_id, int $session_id): array {
        $session = $this->validate_session_ownership($user_id, $session_id);

        if (!in_array($session['session_status'], [SESSION_STATUS_ACTIVE, SESSION_STATUS_PAUSED], true)) {
            throw new RuntimeException('Можно отменить только активную или приостановленную сессию');
        }

        $this->_reading_repository->update_session_status($session_id, SESSION_STATUS_CANCELLED);

        return $this->_reading_repository->find_session_by_id($session_id);
    }

    public function get_active_session(int $user_id): ?array {
        return $this->_reading_repository->find_active_session_by_user($user_id);
    }

    public function get_session_history(int $user_id, int $page, int $per_page): array {
        $items = $this->_reading_repository->find_user_sessions($user_id, $page, $per_page);
        $total_count = $this->_reading_repository->count_user_sessions($user_id);

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    //  РОСТ РАСТЕНИЯ  //

    private function check_plant_growth(int $user_id): array {
        $plant = $this->_plant_repository->find_plant_state($user_id);

        if ($plant === null) {
            return ['grew' => false];
        }

        $current_stage = $plant['plant_stage'];
        $session_count = (int) $plant['session_count_completed'];

        // Определяем новую стадию: итерируем пороги в обратном порядке
        $thresholds = array_reverse(PLANT_STAGE_THRESHOLDS, true);
        $new_stage = PLANT_STAGE_SEED;

        foreach ($thresholds as $stage => $threshold) {
            if ($session_count >= $threshold) {
                $new_stage = $stage;
                break;
            }
        }

        // Если стадия изменилась
        if ($new_stage !== $current_stage) {
            $this->_plant_repository->update_plant_stage($user_id, $new_stage);
            $this->_plant_repository->insert_stage_transition($user_id, $current_stage, $new_stage, $session_count);

            return [
                'grew'      => true,
                'old_stage' => $current_stage,
                'new_stage' => $new_stage,
            ];
        }

        return ['grew' => false];
    }

    // РАСТЕНИЕ  //

    public function get_plant_state(int $user_id): array {
        $plant = $this->_plant_repository->find_plant_state($user_id);

        // Создаём plant_state, если нет
        if ($plant === null) {
            $this->_plant_repository->insert_plant_state($user_id);
            $plant = $this->_plant_repository->find_plant_state($user_id);
        }

        $stage = $plant['plant_stage'];
        $session_count = (int) $plant['session_count_completed'];
        $total_seconds = $this->_reading_repository->sum_total_reading_seconds($user_id);
        $books_finished = $this->_book_repository->count_user_books(
            $user_id,
            null,
            ['status' => BOOK_STATUS_FINISHED]
        );

        // Вычисляем следующую стадию
        $next_stage = null;
        $sessions_to_next = null;

        $stages = PLANT_STAGES;
        $current_index = array_search($stage, $stages, true);

        if ($current_index !== false && $current_index < count($stages) - 1) {
            $next_stage = $stages[$current_index + 1];
            $next_threshold = PLANT_STAGE_THRESHOLDS[$next_stage];
            $sessions_to_next = max(0, $next_threshold - $session_count);
        }

        return [
            'stage'                    => $stage,
            'image_url'                => PLANT_IMAGE_URLS[$stage] ?? '',
            'session_count_completed'  => $session_count,
            'total_minutes_focused'    => (int) floor($total_seconds / SECONDS_PER_MINUTE),
            'books_finished'           => $books_finished,
            'next_stage'               => $next_stage,
            'sessions_to_next'         => $sessions_to_next,
            'time_last_session'        => $plant['time_last_session'],
            'time_created'             => $plant['time_created'],
        ];
    }

    public function get_plant_history(int $user_id): array {
        return $this->_plant_repository->find_stage_history($user_id);
    }

    //  НАСТРОЙКИ  //

    public function get_timer_settings(int $user_id): array {
        $settings = $this->_reading_repository->find_timer_settings($user_id);

        if ($settings === null) {
            $this->_reading_repository->insert_timer_settings($user_id);
            $settings = $this->_reading_repository->find_timer_settings($user_id);
        }

        return $settings;
    }

    public function update_timer_settings(int $user_id, array $data): array {
        // Убеждаемся, что запись существует
        $this->get_timer_settings($user_id);

        $this->_reading_repository->update_timer_settings($user_id, $data);

        return $this->_reading_repository->find_timer_settings($user_id);
    }

    //  ЦЕЛИ  //

    public function set_reading_goal(int $user_id, string $goal_type, int $target_minutes, string $period_start): array {
        $this->_reading_repository->insert_reading_goal($user_id, [
            'goal_type'           => $goal_type,
            'goal_target_minutes' => $target_minutes,
            'goal_period_start'   => $period_start,
        ]);

        $goal = $this->_reading_repository->find_reading_goal($user_id, $goal_type, $period_start);

        return $goal;
    }

    public function get_reading_goals(int $user_id): array {
        return $this->_reading_repository->find_user_reading_goals($user_id);
    }

    //  ВСПОМОГАТЕЛЬНЫЕ ПРИВАТНЫЕ МЕТОДЫ //

    private function validate_session_ownership(int $user_id, int $session_id): array {
        $session = $this->_reading_repository->find_session_by_id($session_id);

        if ($session === null) {
            throw new RuntimeException('Сессия не найдена');
        }

        if ((int) $session['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для управления этой сессией');
        }

        return $session;
    }

    //  3. ЗАМЕТКИ ЧТЕНИЯ//

    public function create_reading_note(
        int $user_id,
        ?int $session_id,
        ?int $book_id,
        string $note_type,
        string $note_text,
        ?int $note_page
    ): array {
        $allowed_types = [NOTE_TYPE_QUOTE, NOTE_TYPE_THOUGHT, NOTE_TYPE_QUESTION, NOTE_TYPE_IDEA];
        if (!in_array($note_type, $allowed_types, true)) {
            throw new RuntimeException('Недопустимый тип заметки');
        }

        $note_text = trim($note_text);
        if ($note_text === '') {
            throw new RuntimeException('Текст заметки не может быть пустым');
        }
        if (mb_strlen($note_text) > MAX_NOTE_TEXT_LENGTH) {
            throw new RuntimeException('Текст заметки слишком длинный');
        }

        // Если сессия указана — она должна принадлежать пользователю
        if ($session_id !== null) {
            $this->require_session_owner($user_id, $session_id);
        }

        $note_id = $this->_reading_repository->insert_reading_note(
            $user_id, $session_id, $book_id, $note_type, $note_text, $note_page
        );

        return $this->_reading_repository->find_reading_note_by_id($note_id);
    }

    public function list_session_notes(int $user_id, int $session_id): array {
        $this->require_session_owner($user_id, $session_id);
        return $this->_reading_repository->find_reading_notes_by_session($session_id);
    }

    public function list_user_notes(int $user_id, ?int $book_id, int $page, int $per_page): array {
        $items = $this->_reading_repository->find_reading_notes_by_user($user_id, $book_id, $page, $per_page);
        $total = $this->_reading_repository->count_reading_notes_by_user($user_id, $book_id);

        return build_pagination_payload($items, $total, $page, $per_page);
    }

    public function delete_reading_note(int $user_id, int $note_id): void {
        $note = $this->_reading_repository->find_reading_note_by_id($note_id);
        if (!$note) {
            throw new RuntimeException('Заметка не найдена');
        }
        if ((int) $note['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав на удаление этой заметки');
        }
        $this->_reading_repository->delete_reading_note($note_id);
    }

    private function require_session_owner(int $user_id, int $session_id): array {
        $session = $this->_reading_repository->find_session_by_id($session_id);

        if ($session === null) {
            throw new RuntimeException('Сессия не найдена');
        }

        if ((int) $session['user_id'] !== $user_id) {
            throw new RuntimeException('Нет доступа к этой сессии');
        }

        return $session;
    }
}
