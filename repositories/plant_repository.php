<?php
/**
 *  РЕПОЗИТОРИЙ: PlantRepository — SQL-запросы к plant_states и plant_stage_history 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с состоянием растения и историей переходов стадий.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';

//  2. КЛАСС PlantRepository  //

class PlantRepository {

    private PDO $_database;

    public function __construct() {
        $this->_database = get_database_connection();
    }

    // СОСТОЯНИЕ РАСТЕНИЯ: ПОИСК  //

    public function find_plant_state(int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, plant_stage, session_count_completed,
                    time_last_session, time_created, time_updated
             FROM plant_states
             WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    // СОСТОЯНИЕ РАСТЕНИЯ: ВСТАВКА  //

    public function insert_plant_state(int $user_id): int {
        $statement = $this->_database->prepare(
            'INSERT INTO plant_states (user_id, plant_stage, session_count_completed)
             VALUES (:user_id, :plant_stage, 0)'
        );

        $statement->execute([
            'user_id'     => $user_id,
            'plant_stage' => PLANT_STAGE_SEED,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  СОСТОЯНИЕ РАСТЕНИЯ: ОБНОВЛЕНИЕ //

    public function increment_session_count(int $user_id): bool {
        $statement = $this->_database->prepare(
            'UPDATE plant_states
             SET session_count_completed = session_count_completed + 1,
                 time_last_session = NOW()
             WHERE user_id = :user_id'
        );

        return $statement->execute(['user_id' => $user_id]);
    }

    public function update_plant_stage(int $user_id, string $stage): bool {
        $statement = $this->_database->prepare(
            'UPDATE plant_states
             SET plant_stage = :plant_stage
             WHERE user_id = :user_id'
        );

        return $statement->execute([
            'user_id'     => $user_id,
            'plant_stage' => $stage,
        ]);
    }

    //  ИСТОРИЯ ПЕРЕХОДОВ  //

    public function insert_stage_transition(int $user_id, string $stage_from, string $stage_to, int $session_count): int {
        $statement = $this->_database->prepare(
            'INSERT INTO plant_stage_history (user_id, stage_from, stage_to, session_count_at_transition)
             VALUES (:user_id, :stage_from, :stage_to, :session_count_at_transition)'
        );

        $statement->execute([
            'user_id'                     => $user_id,
            'stage_from'                  => $stage_from,
            'stage_to'                    => $stage_to,
            'session_count_at_transition' => $session_count,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function find_stage_history(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, stage_from, stage_to,
                    session_count_at_transition, time_created
             FROM plant_stage_history
             WHERE user_id = :user_id
             ORDER BY time_created ASC'
        );

        $statement->execute(['user_id' => $user_id]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }
}
