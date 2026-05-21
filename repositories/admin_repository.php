<?php
/**
 *  РЕПОЗИТОРИЙ: AdminRepository — SQL для админ-панели 
 *
 * НАЗНАЧЕНИЕ:
 * SQL-операции для админ-панели: пользователи, модерация произведений
 * и изданий, общая статистика. Не содержит бизнес-логики — только SQL.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС AdminRepository  //

class AdminRepository {

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

    //  СТАТИСТИКА ПЛАТФОРМЫ  //

    public function count_users(): int {
        $statement = $this->_database->query('SELECT COUNT(*) FROM users');
        return (int) $statement->fetchColumn();
    }

    public function count_books(): int {
        $statement = $this->_database->query(
            'SELECT COUNT(*) FROM books WHERE book_merged_to_id IS NULL'
        );
        return (int) $statement->fetchColumn();
    }

    public function count_books_by_moderation(string $status): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM books
             WHERE book_moderation_status = :status AND book_merged_to_id IS NULL'
        );
        $statement->execute(['status' => $status]);
        return (int) $statement->fetchColumn();
    }

    public function count_editions_by_moderation(string $status): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM book_editions
             WHERE edition_moderation_status = :status'
        );
        $statement->execute(['status' => $status]);
        return (int) $statement->fetchColumn();
    }

    public function count_publications(): int {
        $statement = $this->_database->query('SELECT COUNT(*) FROM user_publications');
        return (int) $statement->fetchColumn();
    }

    public function count_reading_sessions(): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM reading_sessions WHERE session_status = :status'
        );
        $statement->execute(['status' => SESSION_STATUS_COMPLETED]);
        return (int) $statement->fetchColumn();
    }

    public function count_clubs(): int {
        $statement = $this->_database->query('SELECT COUNT(*) FROM book_clubs');
        return (int) $statement->fetchColumn();
    }

    // ПОЛЬЗОВАТЕЛИ: СПИСОК  //

    public function find_users(?string $query, array $filters, int $page, int $per_page): array {
        $where = ['1=1'];
        $params = [];

        if (!empty($query)) {
            $where[] = '(user_email LIKE :q1
                OR user_name_first LIKE :q2
                OR user_name_last LIKE :q3
                OR user_profile_identifier LIKE :q4)';
            $like = '%' . $query . '%';
            $params['q1'] = $like;
            $params['q2'] = $like;
            $params['q3'] = $like;
            $params['q4'] = $like;
        }

        if (!empty($filters['role'])) {
            $where[] = 'user_role = :role';
            $params['role'] = $filters['role'];
        }

        if (isset($filters['is_blocked'])) {
            $where[] = 'is_blocked = :is_blocked';
            $params['is_blocked'] = $filters['is_blocked'] ? 1 : 0;
        }

        $where_sql = implode(' AND ', $where);
        $offset = ($page - 1) * $per_page;

        $sql = "SELECT id, user_email, user_name_first, user_name_last,
                       user_avatar_path, user_profile_identifier,
                       user_role, is_blocked, time_blocked, user_blocked_reason,
                       time_created, time_updated
                FROM users
                WHERE {$where_sql}
                ORDER BY time_created DESC
                LIMIT :limit OFFSET :offset";

        $statement = $this->_database->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_users_filtered(?string $query, array $filters): int {
        $where = ['1=1'];
        $params = [];

        if (!empty($query)) {
            $where[] = '(user_email LIKE :q1
                OR user_name_first LIKE :q2
                OR user_name_last LIKE :q3
                OR user_profile_identifier LIKE :q4)';
            $like = '%' . $query . '%';
            $params['q1'] = $like;
            $params['q2'] = $like;
            $params['q3'] = $like;
            $params['q4'] = $like;
        }

        if (!empty($filters['role'])) {
            $where[] = 'user_role = :role';
            $params['role'] = $filters['role'];
        }

        if (isset($filters['is_blocked'])) {
            $where[] = 'is_blocked = :is_blocked';
            $params['is_blocked'] = $filters['is_blocked'] ? 1 : 0;
        }

        $where_sql = implode(' AND ', $where);

        $statement = $this->_database->prepare(
            "SELECT COUNT(*) FROM users WHERE {$where_sql}"
        );
        $statement->execute($params);
        return (int) $statement->fetchColumn();
    }

    public function find_user_by_id(int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_email, user_name_first, user_name_last,
                    user_avatar_path, user_profile_identifier,
                    user_role, is_blocked, time_blocked, user_blocked_reason,
                    is_profile_hidden, is_library_hidden, is_collections_hidden,
                    is_stats_hidden, is_plant_hidden,
                    time_created, time_updated
             FROM users
             WHERE id = :user_id'
        );
        $statement->execute(['user_id' => $user_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    // ПОЛЬЗОВАТЕЛИ: ДЕЙСТВИЯ  //

    public function update_user_role(int $user_id, string $role): bool {
        $statement = $this->_database->prepare(
            'UPDATE users SET user_role = :role WHERE id = :user_id'
        );
        return $statement->execute(['user_id' => $user_id, 'role' => $role]);
    }

    public function update_user_blocked(int $user_id, bool $is_blocked, ?string $reason = null): bool {
        $statement = $this->_database->prepare(
            'UPDATE users
             SET is_blocked = :is_blocked,
                 time_blocked = :time_blocked,
                 user_blocked_reason = :reason
             WHERE id = :user_id'
        );
        return $statement->execute([
            'user_id'      => $user_id,
            'is_blocked'   => $is_blocked ? 1 : 0,
            'time_blocked' => $is_blocked ? date('Y-m-d H:i:s') : null,
            'reason'       => $is_blocked ? $reason : null,
        ]);
    }

    public function update_user_profile_by_admin(int $user_id, array $data): bool {
        $allowed = [
            'user_name_first',
            'user_name_last',
            'user_email',
            'user_profile_identifier',
            'is_profile_hidden',
            'is_library_hidden',
            'is_collections_hidden',
        ];
        $sets = [];
        $params = ['user_id' => $user_id];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "$field = :$field";
                $params[$field] = $data[$field];
            }
        }

        if (empty($sets)) {
            return true; // нечего обновлять
        }

        $sql = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = :user_id';
        $statement = $this->_database->prepare($sql);
        return $statement->execute($params);
    }

    public function update_user_avatar_path(int $user_id, ?string $avatar_path): bool {
        $statement = $this->_database->prepare(
            'UPDATE users SET user_avatar_path = :avatar_path WHERE id = :user_id'
        );
        return $statement->execute([
            'user_id'     => $user_id,
            'avatar_path' => $avatar_path,
        ]);
    }

    public function delete_user(int $user_id): bool {
        $statement = $this->_database->prepare('DELETE FROM users WHERE id = :user_id');
        return $statement->execute(['user_id' => $user_id]);
    }

    public function count_admins(): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM users WHERE user_role = :role'
        );
        $statement->execute(['role' => USER_ROLE_ADMIN]);
        return (int) $statement->fetchColumn();
    }

    // МОДЕРАЦИЯ ПРОИЗВЕДЕНИЙ  //

    
    public function find_books_for_moderation(string $status, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT b.id, b.user_id, b.book_title, b.book_author, b.book_genre,
                    b.book_year_published, b.book_original_language, b.book_description,
                    b.book_moderation_status, b.book_merged_to_id,
                    b.time_created, b.time_updated,
                    u.user_email, u.user_name_first, u.user_name_last
             FROM books b
             JOIN users u ON u.id = b.user_id
             WHERE b.book_moderation_status = :status AND b.book_merged_to_id IS NULL
             ORDER BY b.time_created ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('status', $status, PDO::PARAM_STR);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    
    public function count_books_for_moderation(string $status): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM books
             WHERE book_moderation_status = :status AND book_merged_to_id IS NULL'
        );
        $statement->execute(['status' => $status]);
        return (int) $statement->fetchColumn();
    }

    public function find_all_books(?string $query, array $filters, int $page, int $per_page): array {
        $where = ['b.book_merged_to_id IS NULL'];
        $params = [];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :q1 OR b.book_author LIKE :q2)';
            $like = '%' . $query . '%';
            $params['q1'] = $like;
            $params['q2'] = $like;
        }

        if (!empty($filters['moderation_status'])) {
            $where[] = 'b.book_moderation_status = :mod_status';
            $params['mod_status'] = $filters['moderation_status'];
        }

        $where_sql = implode(' AND ', $where);
        $offset = ($page - 1) * $per_page;

        $sql = "SELECT b.id, b.user_id, b.book_title, b.book_author, b.book_genre,
                       b.book_year_published, b.book_original_language,
                       b.book_moderation_status, b.time_created,
                       u.user_email, u.user_name_first, u.user_name_last
                FROM books b
                JOIN users u ON u.id = b.user_id
                WHERE {$where_sql}
                ORDER BY b.time_created DESC
                LIMIT :limit OFFSET :offset";

        $statement = $this->_database->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_all_books(?string $query, array $filters): int {
        $where = ['b.book_merged_to_id IS NULL'];
        $params = [];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :q1 OR b.book_author LIKE :q2)';
            $like = '%' . $query . '%';
            $params['q1'] = $like;
            $params['q2'] = $like;
        }

        if (!empty($filters['moderation_status'])) {
            $where[] = 'b.book_moderation_status = :mod_status';
            $params['mod_status'] = $filters['moderation_status'];
        }

        $where_sql = implode(' AND ', $where);

        $statement = $this->_database->prepare(
            "SELECT COUNT(*) FROM books b WHERE {$where_sql}"
        );
        $statement->execute($params);
        return (int) $statement->fetchColumn();
    }

    public function update_book_moderation_status(int $book_id, string $status): bool {
        $statement = $this->_database->prepare(
            'UPDATE books SET book_moderation_status = :status WHERE id = :book_id'
        );
        return $statement->execute(['book_id' => $book_id, 'status' => $status]);
    }

    public function find_book_by_id(int $book_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT b.id, b.user_id, b.book_title, b.book_author, b.book_genre,
                    b.book_year_published, b.book_original_language, b.book_description,
                    b.book_moderation_status, b.book_merged_to_id,
                    b.time_created, b.time_updated,
                    u.user_email, u.user_name_first, u.user_name_last
             FROM books b
             JOIN users u ON u.id = b.user_id
             WHERE b.id = :book_id'
        );
        $statement->execute(['book_id' => $book_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    public function search_books_for_merge(string $query, int $exclude, int $limit): array {
        $like = '%' . $query . '%';

        $statement = $this->_database->prepare(
            'SELECT id, book_title, book_author, book_year_published,
                    book_moderation_status
             FROM books
             WHERE (book_title LIKE :q1 OR book_author LIKE :q2)
               AND id != :exclude
               AND book_merged_to_id IS NULL
               AND book_moderation_status = :status
             ORDER BY book_title
             LIMIT :limit'
        );

        $statement->bindValue('q1', $like, PDO::PARAM_STR);
        $statement->bindValue('q2', $like, PDO::PARAM_STR);
        $statement->bindValue('exclude', $exclude, PDO::PARAM_INT);
        $statement->bindValue('status', BOOK_MODERATION_APPROVED, PDO::PARAM_STR);
        $statement->bindValue('limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_duplicate_book_groups(): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM (
                 SELECT LOWER(TRIM(book_title)) AS book_title_key
                 FROM books
                 WHERE book_merged_to_id IS NULL
                 GROUP BY LOWER(TRIM(book_title))
                 HAVING COUNT(*) > 1
             ) duplicate_groups'
        );
        $statement->execute();
        return (int) $statement->fetchColumn();
    }

    public function find_duplicate_book_rows(int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $sql = 'SELECT b.id, b.user_id, b.book_title, b.book_author,
                       b.book_genre, b.book_year_published, b.book_original_language,
                       b.book_moderation_status, b.time_created, b.time_updated,
                       duplicate_groups.book_title_key,
                       duplicate_groups.duplicate_count,
                       duplicate_groups.first_created,
                       COUNT(DISTINCT e.id) AS edition_count,
                       u.user_email, u.user_name_first, u.user_name_last
                FROM books b
                JOIN (
                    SELECT LOWER(TRIM(book_title)) AS book_title_key,
                           COUNT(*) AS duplicate_count,
                           MIN(time_created) AS first_created
                    FROM books
                    WHERE book_merged_to_id IS NULL
                    GROUP BY LOWER(TRIM(book_title))
                    HAVING COUNT(*) > 1
                    ORDER BY first_created ASC
                    LIMIT :limit OFFSET :offset
                ) duplicate_groups
                    ON LOWER(TRIM(b.book_title)) = duplicate_groups.book_title_key
                JOIN users u ON u.id = b.user_id
                LEFT JOIN book_editions e ON e.book_id = b.id
                WHERE b.book_merged_to_id IS NULL
                GROUP BY b.id, b.user_id, b.book_title, b.book_author,
                         b.book_genre, b.book_year_published, b.book_original_language,
                         b.book_moderation_status, b.time_created, b.time_updated,
                         duplicate_groups.book_title_key,
                         duplicate_groups.duplicate_count,
                         duplicate_groups.first_created,
                         u.user_email, u.user_name_first, u.user_name_last
                ORDER BY duplicate_groups.first_created ASC, b.time_created ASC';

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    // МОДЕРАЦИЯ ИЗДАНИЙ //

    public function find_editions_for_moderation(string $status, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT e.id, e.book_id, e.user_id,
                    e.edition_isbn, e.edition_language, e.edition_translator,
                    e.edition_publisher, e.edition_series, e.edition_pages,
                    e.edition_type, e.edition_cover_path,
                    e.edition_moderation_status, e.time_created, e.time_updated,
                    b.book_title, b.book_author, b.book_moderation_status,
                    u.user_email, u.user_name_first, u.user_name_last
             FROM book_editions e
             JOIN books b ON b.id = e.book_id
             JOIN users u ON u.id = e.user_id
             WHERE e.edition_moderation_status = :status
             ORDER BY e.time_created ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('status', $status, PDO::PARAM_STR);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_editions_for_moderation(string $status): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM book_editions
             WHERE edition_moderation_status = :status'
        );
        $statement->execute(['status' => $status]);
        return (int) $statement->fetchColumn();
    }

    public function find_all_editions(?string $query, array $filters, int $page, int $per_page): array {
        $where = ['1=1'];
        $params = [];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :q1
                OR b.book_author LIKE :q2
                OR e.edition_isbn LIKE :q3)';
            $like = '%' . $query . '%';
            $params['q1'] = $like;
            $params['q2'] = $like;
            $params['q3'] = $like;
        }

        if (!empty($filters['moderation_status'])) {
            $where[] = 'e.edition_moderation_status = :mod_status';
            $params['mod_status'] = $filters['moderation_status'];
        }

        if (!empty($filters['language'])) {
            $where[] = 'e.edition_language = :language';
            $params['language'] = $filters['language'];
        }

        if (!empty($filters['type'])) {
            $where[] = 'e.edition_type = :type';
            $params['type'] = $filters['type'];
        }

        $where_sql = implode(' AND ', $where);
        $offset = ($page - 1) * $per_page;

        $sql = "SELECT e.id, e.book_id, e.user_id,
                       e.edition_isbn, e.edition_language, e.edition_translator,
                       e.edition_publisher, e.edition_series, e.edition_pages,
                       e.edition_type, e.edition_cover_path,
                       e.edition_moderation_status, e.time_created, e.time_updated,
                       b.book_title, b.book_author, b.book_moderation_status,
                       u.user_email, u.user_name_first, u.user_name_last
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                JOIN users u ON u.id = e.user_id
                WHERE {$where_sql}
                ORDER BY e.time_created DESC
                LIMIT :limit OFFSET :offset";

        $statement = $this->_database->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_all_editions(?string $query, array $filters): int {
        $where = ['1=1'];
        $params = [];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :q1
                OR b.book_author LIKE :q2
                OR e.edition_isbn LIKE :q3)';
            $like = '%' . $query . '%';
            $params['q1'] = $like;
            $params['q2'] = $like;
            $params['q3'] = $like;
        }

        if (!empty($filters['moderation_status'])) {
            $where[] = 'e.edition_moderation_status = :mod_status';
            $params['mod_status'] = $filters['moderation_status'];
        }

        if (!empty($filters['language'])) {
            $where[] = 'e.edition_language = :language';
            $params['language'] = $filters['language'];
        }

        if (!empty($filters['type'])) {
            $where[] = 'e.edition_type = :type';
            $params['type'] = $filters['type'];
        }

        $where_sql = implode(' AND ', $where);

        $statement = $this->_database->prepare(
            "SELECT COUNT(*) FROM book_editions e
             JOIN books b ON b.id = e.book_id
             WHERE {$where_sql}"
        );
        $statement->execute($params);
        return (int) $statement->fetchColumn();
    }

    public function find_edition_by_id_for_admin(int $edition_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT e.id, e.book_id, e.user_id,
                    e.edition_isbn, e.edition_language, e.edition_translator,
                    e.edition_publisher, e.edition_series, e.edition_pages,
                    e.edition_type, e.edition_cover_path,
                    e.edition_moderation_status, e.time_created, e.time_updated,
                    b.book_title, b.book_author, b.book_genre,
                    b.book_year_published, b.book_original_language,
                    b.book_moderation_status,
                    u.user_email, u.user_name_first, u.user_name_last
             FROM book_editions e
             JOIN books b ON b.id = e.book_id
             JOIN users u ON u.id = e.user_id
             WHERE e.id = :edition_id'
        );
        $statement->execute(['edition_id' => $edition_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);
        return $result ?: null;
    }

    //  3. ЖУРНАЛ АКТИВНОСТИ  //

    public function find_recent_activity(int $limit): array {
        $sql = "
            SELECT 'user_registered' AS activity_type,
                   u.time_created AS time_created,
                   u.id AS ref_id,
                   COALESCE(
                       NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.user_name_first, ''), NULLIF(u.user_name_last, ''))), ''),
                       u.user_email
                   ) AS ref_title,
                   u.id AS user_id,
                   COALESCE(
                       NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.user_name_first, ''), NULLIF(u.user_name_last, ''))), ''),
                       u.user_email
                   ) AS user_name,
                   u.user_name_first,
                   u.user_name_last,
                   u.user_email,
                   NULL AS book_id,
                   NULL AS club_id
            FROM users u

            UNION ALL

            SELECT 'book_created' AS activity_type,
                   b.time_created,
                   b.id AS ref_id,
                   b.book_title AS ref_title,
                   b.user_id,
                   COALESCE(
                       NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.user_name_first, ''), NULLIF(u.user_name_last, ''))), ''),
                       u.user_email
                   ) AS user_name,
                   u.user_name_first,
                   u.user_name_last,
                   u.user_email,
                   b.id AS book_id,
                   NULL AS club_id
            FROM books b
            JOIN users u ON u.id = b.user_id

            UNION ALL

            SELECT 'edition_created' AS activity_type,
                   e.time_created,
                   e.id AS ref_id,
                   b.book_title AS ref_title,
                   e.user_id,
                   COALESCE(
                       NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.user_name_first, ''), NULLIF(u.user_name_last, ''))), ''),
                       u.user_email
                   ) AS user_name,
                   u.user_name_first,
                   u.user_name_last,
                   u.user_email,
                   e.book_id,
                   NULL AS club_id
            FROM book_editions e
            JOIN users u ON u.id = e.user_id
            JOIN books b ON b.id = e.book_id

            UNION ALL

            SELECT 'publication_created' AS activity_type,
                   up.time_created,
                   up.id AS ref_id,
                   COALESCE(b.book_title, '') AS ref_title,
                   up.user_id,
                   COALESCE(
                       NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.user_name_first, ''), NULLIF(u.user_name_last, ''))), ''),
                       u.user_email
                   ) AS user_name,
                   u.user_name_first,
                   u.user_name_last,
                   u.user_email,
                   up.book_id,
                   NULL AS club_id
            FROM user_publications up
            JOIN users u ON u.id = up.user_id
            LEFT JOIN books b ON b.id = up.book_id

            UNION ALL

            SELECT 'club_created' AS activity_type,
                   bc.time_created,
                   bc.id AS ref_id,
                   bc.club_name AS ref_title,
                   bc.user_id_creator AS user_id,
                   COALESCE(
                       NULLIF(TRIM(CONCAT_WS(' ', NULLIF(u.user_name_first, ''), NULLIF(u.user_name_last, ''))), ''),
                       u.user_email
                   ) AS user_name,
                   u.user_name_first,
                   u.user_name_last,
                   u.user_email,
                   NULL AS book_id,
                   bc.id AS club_id
            FROM book_clubs bc
            JOIN users u ON u.id = bc.user_id_creator

            ORDER BY time_created DESC
            LIMIT :max_limit
        ";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('max_limit', $limit, PDO::PARAM_INT);
        $statement->execute();
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }
}
