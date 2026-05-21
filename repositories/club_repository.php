<?php
/**
 * РЕПОЗИТОРИЙ: ClubRepository — SQL-запросы к таблицам book_clubs и book_club_members 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с клубами и их участниками.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС ClubRepository  //

class ClubRepository {

    /** @var PDO Экземпляр PDO-соединения. */
    private PDO $_database;

    /**
     * 🐘 Метод __construct — Инициализирует подключение к базе данных для SQL-операций.
     *
     * @return void Ничего не возвращает.
     */
    public function __construct() {
        $this->_database = get_database_connection();
    }

    // КЛУБЫ: ВСТАВКА  //

    public function insert_club(int $creator_id, string $name, ?string $description, ?string $image_path, bool $is_public): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_clubs (user_id_creator, club_name, club_description, club_image_path, is_public)
             VALUES (:user_id_creator, :club_name, :club_description, :club_image_path, :is_public)'
        );

        $statement->execute([
            'user_id_creator' => $creator_id,
            'club_name'       => $name,
            'club_description' => $description,
            'club_image_path' => $image_path,
            'is_public'       => $is_public ? 1 : 0,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  КЛУБЫ: ПОИСК  //

    public function find_club_by_id(int $club_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id_creator, club_name, club_description,
                    club_image_path, is_public, time_created, time_updated
             FROM book_clubs
             WHERE id = :club_id'
        );

        $statement->execute(['club_id' => $club_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_clubs_by_user(int $user_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT bc.id, bc.user_id_creator, bc.club_name, bc.club_description,
                    bc.club_image_path, bc.is_public, bc.time_created, bc.time_updated,
                    bcm.member_role AS current_user_role,
                    (SELECT COUNT(*) FROM book_club_members sub WHERE sub.club_id = bc.id) AS member_count
             FROM book_club_members bcm
             JOIN book_clubs bc ON bc.id = bcm.club_id
             WHERE bcm.user_id = :user_id
             ORDER BY bc.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('user_id', $user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_clubs_by_user(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM book_club_members
             WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    public function search_clubs(string $query, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT bc.id, bc.user_id_creator, bc.club_name, bc.club_description,
                    bc.club_image_path, bc.is_public, bc.time_created, bc.time_updated,
                    (SELECT COUNT(*) FROM book_club_members sub WHERE sub.club_id = bc.id) AS member_count
             FROM book_clubs bc
             WHERE bc.club_name LIKE :query_name OR bc.club_description LIKE :query_description
             ORDER BY bc.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('query_name', '%' . $query . '%', PDO::PARAM_STR);
        $statement->bindValue('query_description', '%' . $query . '%', PDO::PARAM_STR);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function search_clubs_for_user(string $query, int $user_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT bc.id, bc.user_id_creator, bc.club_name, bc.club_description,
                    bc.club_image_path, bc.is_public, bc.time_created, bc.time_updated,
                    bcm.member_role AS current_user_role,
                    bcjr.request_status AS join_request_status,
                    (SELECT COUNT(*) FROM book_club_members sub WHERE sub.club_id = bc.id) AS member_count
             FROM book_clubs bc
             LEFT JOIN book_club_members bcm
                    ON bcm.club_id = bc.id AND bcm.user_id = :user_id_member
             LEFT JOIN book_club_join_requests bcjr
                    ON bcjr.club_id = bc.id AND bcjr.user_id = :user_id_request
             WHERE bc.club_name LIKE :query_name OR bc.club_description LIKE :query_description
             ORDER BY bc.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('user_id_member', $user_id, PDO::PARAM_INT);
        $statement->bindValue('user_id_request', $user_id, PDO::PARAM_INT);
        $statement->bindValue('query_name', '%' . $query . '%', PDO::PARAM_STR);
        $statement->bindValue('query_description', '%' . $query . '%', PDO::PARAM_STR);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_search_results(string $query): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM book_clubs
             WHERE club_name LIKE :query_name OR club_description LIKE :query_description'
        );

        $statement->execute([
            'query_name'        => '%' . $query . '%',
            'query_description' => '%' . $query . '%',
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    public function find_catalog_clubs_for_user(int $user_id, string $filter, ?string $query, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;
        $conditions = $this->build_catalog_conditions($filter, $query);

        $statement = $this->_database->prepare(
            'SELECT bc.id, bc.user_id_creator, bc.club_name, bc.club_description,
                    bc.club_image_path, bc.is_public, bc.time_created, bc.time_updated,
                    bcm.member_role AS current_user_role,
                    bcjr.id AS join_request_id,
                    bcjr.request_status AS join_request_status,
                    (SELECT COUNT(*) FROM book_club_members sub WHERE sub.club_id = bc.id) AS member_count
             FROM book_clubs bc
             LEFT JOIN book_club_members bcm
                    ON bcm.club_id = bc.id AND bcm.user_id = :user_id_member
             LEFT JOIN book_club_join_requests bcjr
                    ON bcjr.club_id = bc.id
                   AND bcjr.user_id = :user_id_request
                   AND bcjr.request_status = :request_pending
             ' . $conditions['where'] . '
             ORDER BY bc.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $this->bind_catalog_values($statement, $conditions['params'], $user_id);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_catalog_clubs_for_user(int $user_id, string $filter, ?string $query): int {
        $conditions = $this->build_catalog_conditions($filter, $query);

        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM book_clubs bc
             LEFT JOIN book_club_members bcm
                    ON bcm.club_id = bc.id AND bcm.user_id = :user_id_member
             LEFT JOIN book_club_join_requests bcjr
                    ON bcjr.club_id = bc.id
                   AND bcjr.user_id = :user_id_request
                   AND bcjr.request_status = :request_pending
             ' . $conditions['where']
        );

        $this->bind_catalog_values($statement, $conditions['params'], $user_id);
        $statement->execute();

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    // КЛУБЫ: ОБНОВЛЕНИЕ / УДАЛЕНИЕ  //

    public function update_club(int $club_id, array $data): bool {
        $fields = [];
        $params = ['club_id' => $club_id];

        $allowed = ['club_name', 'club_description', 'club_image_path', 'is_public'];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE book_clubs SET ' . implode(', ', $fields) . ' WHERE id = :club_id';
        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    public function delete_club(int $club_id): bool {
        $statement = $this->_database->prepare('DELETE FROM book_clubs WHERE id = :club_id');
        return $statement->execute(['club_id' => $club_id]);
    }

    //  УЧАСТНИКИ  //

    public function insert_member(int $club_id, int $user_id, string $role): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_club_members (club_id, user_id, member_role)
             VALUES (:club_id, :user_id, :member_role)'
        );

        $statement->execute([
            'club_id'     => $club_id,
            'user_id'     => $user_id,
            'member_role' => $role,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function find_member(int $club_id, int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, club_id, user_id, member_role, time_created
             FROM book_club_members
             WHERE club_id = :club_id AND user_id = :user_id'
        );

        $statement->execute([
            'club_id' => $club_id,
            'user_id' => $user_id,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function update_member_role(int $club_id, int $user_id, string $role): bool {
        $statement = $this->_database->prepare(
            'UPDATE book_club_members
             SET member_role = :member_role
             WHERE club_id = :club_id AND user_id = :user_id'
        );

        return $statement->execute([
            'club_id'     => $club_id,
            'user_id'     => $user_id,
            'member_role' => $role,
        ]);
    }

    public function delete_member(int $club_id, int $user_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM book_club_members
             WHERE club_id = :club_id AND user_id = :user_id'
        );

        return $statement->execute([
            'club_id' => $club_id,
            'user_id' => $user_id,
        ]);
    }

    public function find_members(int $club_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT bcm.id, bcm.club_id, bcm.user_id, bcm.member_role, bcm.time_created,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier,
                    (
                        SELECT CASE
                            WHEN u.is_library_hidden = 1 THEN NULL
                            ELSE COUNT(DISTINCT be.book_id)
                        END
                        FROM library_books lb
                        JOIN book_editions be ON be.id = lb.edition_id
                        JOIN books b ON b.id = be.book_id
                        WHERE lb.user_id = u.id
                          AND be.edition_moderation_status = :edition_status
                          AND b.book_moderation_status = :book_status
                    ) AS books_count,
                    (
                        SELECT COUNT(*)
                        FROM friendships f
                        WHERE f.user_id = u.id
                    ) AS friends_count,
                    (
                        SELECT COUNT(*)
                        FROM user_publications up
                        WHERE up.user_id = u.id
                    ) AS publications_count
             FROM book_club_members bcm
             JOIN users u ON u.id = bcm.user_id
             WHERE bcm.club_id = :club_id
             ORDER BY FIELD(bcm.member_role, \'creator\', \'moderator\', \'member\'), bcm.time_created ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('club_id', $club_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->bindValue('edition_status', EDITION_MODERATION_APPROVED);
        $statement->bindValue('book_status', BOOK_MODERATION_APPROVED);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_members(int $club_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM book_club_members
             WHERE club_id = :club_id'
        );

        $statement->execute(['club_id' => $club_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    // ЗАЯВКИ НА ВСТУПЛЕНИЕ  //

    public function find_join_request(int $club_id, int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, club_id, user_id, request_status, time_created, time_updated
             FROM book_club_join_requests
             WHERE club_id = :club_id AND user_id = :user_id'
        );

        $statement->execute([
            'club_id' => $club_id,
            'user_id' => $user_id,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_join_request_by_id(int $request_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT bcjr.id, bcjr.club_id, bcjr.user_id, bcjr.request_status,
                    bcjr.time_created, bcjr.time_updated,
                    bc.club_name, bc.user_id_creator
             FROM book_club_join_requests bcjr
             JOIN book_clubs bc ON bc.id = bcjr.club_id
             WHERE bcjr.id = :request_id'
        );

        $statement->execute(['request_id' => $request_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function upsert_join_request(int $club_id, int $user_id, string $status): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_club_join_requests (club_id, user_id, request_status)
             VALUES (:club_id, :user_id, :request_status)
             ON DUPLICATE KEY UPDATE
                request_status = VALUES(request_status),
                time_updated = CURRENT_TIMESTAMP'
        );

        $statement->execute([
            'club_id'        => $club_id,
            'user_id'        => $user_id,
            'request_status' => $status,
        ]);

        $request = $this->find_join_request($club_id, $user_id);

        return $request !== null ? (int) $request['id'] : (int) $this->_database->lastInsertId();
    }

    public function update_join_request_status(int $request_id, string $status): bool {
        $statement = $this->_database->prepare(
            'UPDATE book_club_join_requests
             SET request_status = :request_status
             WHERE id = :request_id'
        );

        return $statement->execute([
            'request_id'     => $request_id,
            'request_status' => $status,
        ]);
    }

    public function find_pending_join_requests_by_club(int $club_id): array {
        $statement = $this->_database->prepare(
            'SELECT bcjr.id, bcjr.club_id, bcjr.user_id, bcjr.request_status,
                    bcjr.time_created, bcjr.time_updated,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier,
                    (
                        SELECT CASE
                            WHEN u.is_library_hidden = 1 THEN NULL
                            ELSE COUNT(DISTINCT be.book_id)
                        END
                        FROM library_books lb
                        JOIN book_editions be ON be.id = lb.edition_id
                        JOIN books b ON b.id = be.book_id
                        WHERE lb.user_id = u.id
                          AND be.edition_moderation_status = :edition_status
                          AND b.book_moderation_status = :book_status
                    ) AS books_count,
                    (
                        SELECT COUNT(*)
                        FROM friendships f
                        WHERE f.user_id = u.id
                    ) AS friends_count,
                    (
                        SELECT COUNT(*)
                        FROM user_publications up
                        WHERE up.user_id = u.id
                    ) AS publications_count
             FROM book_club_join_requests bcjr
             JOIN users u ON u.id = bcjr.user_id
             WHERE bcjr.club_id = :club_id
               AND bcjr.request_status = :request_status
             ORDER BY bcjr.time_created ASC'
        );

        $statement->bindValue('club_id', $club_id, PDO::PARAM_INT);
        $statement->bindValue('request_status', CLUB_JOIN_REQUEST_PENDING);
        $statement->bindValue('edition_status', EDITION_MODERATION_APPROVED);
        $statement->bindValue('book_status', BOOK_MODERATION_APPROVED);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_pending_join_requests_by_club(int $club_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM book_club_join_requests
             WHERE club_id = :club_id AND request_status = :request_status'
        );

        $statement->execute([
            'club_id'        => $club_id,
            'request_status' => CLUB_JOIN_REQUEST_PENDING,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    public function find_pending_join_requests_by_user(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT bcjr.id AS request_id, bcjr.club_id, bcjr.user_id, bcjr.request_status,
                    bcjr.time_created, bcjr.time_updated,
                    bc.id AS id, bc.club_name, bc.club_description,
                    bc.club_image_path, bc.is_public, bc.user_id_creator,
                    (SELECT COUNT(*) FROM book_club_members sub WHERE sub.club_id = bc.id) AS member_count
             FROM book_club_join_requests bcjr
             JOIN book_clubs bc ON bc.id = bcjr.club_id
             WHERE bcjr.user_id = :user_id
               AND bcjr.request_status = :request_status
             ORDER BY bcjr.time_created DESC'
        );

        $statement->execute([
            'user_id'        => $user_id,
            'request_status' => CLUB_JOIN_REQUEST_PENDING,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    private function build_catalog_conditions(string $filter, ?string $query): array {
        $where = [];
        $params = [];

        if ($filter === CLUB_CATALOG_FILTER_MY) {
            $where[] = 'bcm.user_id IS NOT NULL';
        } elseif ($filter === CLUB_CATALOG_FILTER_PUBLIC) {
            $where[] = 'bc.is_public = 1';
        } elseif ($filter === CLUB_CATALOG_FILTER_PRIVATE) {
            $where[] = 'bc.is_public = 0';
        } elseif ($filter === CLUB_CATALOG_FILTER_PENDING) {
            $where[] = 'bcjr.id IS NOT NULL';
        }

        if ($query !== null && $query !== '') {
            $where[] = '(bc.club_name LIKE :query_name OR bc.club_description LIKE :query_description)';
            $params['query_name'] = '%' . $query . '%';
            $params['query_description'] = '%' . $query . '%';
        }

        return [
            'where'  => count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '',
            'params' => $params,
        ];
    }

    private function bind_catalog_values(PDOStatement $statement, array $params, int $user_id): void {
        $statement->bindValue('user_id_member', $user_id, PDO::PARAM_INT);
        $statement->bindValue('user_id_request', $user_id, PDO::PARAM_INT);
        $statement->bindValue('request_pending', CLUB_JOIN_REQUEST_PENDING, PDO::PARAM_STR);

        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value, PDO::PARAM_STR);
        }
    }
}
