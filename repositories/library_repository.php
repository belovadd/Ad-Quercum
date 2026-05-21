<?php
/**
 *  РЕПОЗИТОРИЙ: LibraryRepository — SQL для libraries и library_books 
 *
 * НАЗНАЧЕНИЕ:
 * SQL-операции с пользовательскими коллекциями (`libraries`) и связями
 * «коллекция ↔ конкретное издание книги» (`library_books`).
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС LibraryRepository  //

class LibraryRepository {

    /** @var PDO Экземпляр PDO-соединения. */
    private PDO $_database;

    /** @var bool|null Можно ли явно писать в library_scope_id. */
    private ?bool $_can_write_library_scope_id = null;

    /**
     * 🐘 Метод __construct — Инициализирует подключение к базе данных для SQL-операций.
     *
     * @return void Ничего не возвращает.
     */
    public function __construct() {
        $this->_database = get_database_connection();
    }

    // КОЛЛЕКЦИИ: ВСТАВКА  //

    public function insert_library(int $user_id, array $data): int {
        $statement = $this->_database->prepare(
            'INSERT INTO libraries (user_id, library_name, library_description, is_private)
             VALUES (:user_id, :library_name, :library_description, :is_private)'
        );

        $statement->execute([
            'user_id'             => $user_id,
            'library_name'        => $data['library_name'],
            'library_description' => $data['library_description'] ?? null,
            'is_private'          => $data['is_private'] ?? 1,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    // КОЛЛЕКЦИИ: ПОИСК  //

    public function find_by_id(int $library_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, library_name, library_description,
                    is_private, time_created, time_updated
             FROM libraries
             WHERE id = :library_id'
        );

        $statement->execute(['library_id' => $library_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_user_libraries(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT l.id, l.user_id, l.library_name, l.library_description,
                    l.is_private, l.time_created, l.time_updated,
                    (
                        SELECT GROUP_CONCAT(e2.edition_cover_path ORDER BY lb2.time_created DESC SEPARATOR \'||\')
                        FROM library_books lb2
                        JOIN book_editions e2 ON e2.id = lb2.edition_id
                        WHERE lb2.library_id = l.id
                          AND e2.edition_cover_path IS NOT NULL
                          AND e2.edition_cover_path <> \'\'
                    ) AS cover_paths,
                    COUNT(lb.id) AS book_count
             FROM libraries l
             LEFT JOIN library_books lb ON lb.library_id = l.id
             WHERE l.user_id = :user_id
             GROUP BY l.id
             ORDER BY l.time_created DESC'
        );

        $statement->execute(['user_id' => $user_id]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find_user_libraries_with_edition_flag(int $user_id, int $edition_id): array {
        $statement = $this->_database->prepare(
            'SELECT l.id, l.user_id, l.library_name, l.library_description,
                    l.is_private, l.time_created, l.time_updated,
                    (
                        SELECT GROUP_CONCAT(e2.edition_cover_path ORDER BY lb2.time_created DESC SEPARATOR \'||\')
                        FROM library_books lb2
                        JOIN book_editions e2 ON e2.id = lb2.edition_id
                        WHERE lb2.library_id = l.id
                          AND e2.edition_cover_path IS NOT NULL
                          AND e2.edition_cover_path <> \'\'
                    ) AS cover_paths,
                    COUNT(lb.id) AS book_count,
                    MAX(CASE WHEN lb.edition_id = :edition_id THEN 1 ELSE 0 END) AS is_selected
             FROM libraries l
             LEFT JOIN library_books lb ON lb.library_id = l.id
             WHERE l.user_id = :user_id
             GROUP BY l.id
             ORDER BY l.time_created DESC'
        );

        $statement->execute([
            'edition_id' => $edition_id,
            'user_id'    => $user_id,
        ]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find_public_libraries_by_user(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT l.id, l.user_id, l.library_name, l.library_description,
                    l.is_private, l.time_created, l.time_updated,
                    (
                        SELECT GROUP_CONCAT(e2.edition_cover_path ORDER BY lb2.time_created DESC SEPARATOR \'||\')
                        FROM library_books lb2
                        JOIN book_editions e2 ON e2.id = lb2.edition_id
                        WHERE lb2.library_id = l.id
                          AND e2.edition_cover_path IS NOT NULL
                          AND e2.edition_cover_path <> \'\'
                    ) AS cover_paths,
                    COUNT(lb.id) AS book_count
             FROM libraries l
             LEFT JOIN library_books lb ON lb.library_id = l.id
             WHERE l.user_id = :user_id AND l.is_private = 0
             GROUP BY l.id
             ORDER BY l.time_created DESC'
        );

        $statement->execute(['user_id' => $user_id]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    //  КОЛЛЕКЦИИ: ОБНОВЛЕНИЕ / УДАЛЕНИЕ  //

    public function update_library(int $library_id, array $data): bool {
        $fields = [];
        $params = ['library_id' => $library_id];

        $allowed = ['library_name', 'library_description', 'is_private'];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE libraries SET ' . implode(', ', $fields) . ' WHERE id = :library_id';
        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    public function delete_library(int $library_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM libraries WHERE id = :library_id'
        );
        return $statement->execute(['library_id' => $library_id]);
    }

    public function count_user_libraries(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM libraries WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);
        return (int) $statement->fetchColumn();
    }

    public function count_public_libraries_by_user(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM libraries WHERE user_id = :user_id AND is_private = 0'
        );

        $statement->execute(['user_id' => $user_id]);
        return (int) $statement->fetchColumn();
    }

    //  ИЗДАНИЯ В КОЛЛЕКЦИЯХ //

    public function insert_library_book(?int $library_id, int $edition_id, int $user_id): bool {
        if ($this->exists_library_book($library_id, $edition_id, $user_id)) {
            return true;
        }

        return $this->insert_library_book_row($library_id, $edition_id, $user_id);
    }

    public function ensure_library_books_from_collection(int $library_id, int $user_id): void {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT edition_id
             FROM library_books
             WHERE library_id = :library_id AND user_id = :user_id'
        );
        $statement->execute([
            'library_id' => $library_id,
            'user_id'    => $user_id,
        ]);

        $edition_ids = $statement->fetchAll(PDO::FETCH_COLUMN);
        foreach ($edition_ids as $edition_id) {
            $this->insert_library_book(null, (int) $edition_id, $user_id);
        }
    }

    public function ensure_library_book_on_shelf(int $user_id, int $edition_id): bool {
        return $this->insert_library_book(null, $edition_id, $user_id);
    }

    public function insert_collection_book(int $library_id, int $edition_id, int $user_id): bool {
        $this->ensure_library_book_on_shelf($user_id, $edition_id);

        if ($this->exists_library_book($library_id, $edition_id, $user_id)) {
            return true;
        }

        return $this->insert_library_book_row($library_id, $edition_id, $user_id);
    }

    public function delete_library_book(int $library_id, int $edition_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM library_books
             WHERE library_id = :library_id AND edition_id = :edition_id'
        );

        return $statement->execute([
            'library_id' => $library_id,
            'edition_id' => $edition_id,
        ]);
    }

    public function delete_user_edition_from_shelf(int $user_id, int $edition_id): int {
        $statement = $this->_database->prepare(
            'DELETE FROM library_books
             WHERE user_id = :user_id AND edition_id = :edition_id'
        );

        $statement->execute([
            'user_id'    => $user_id,
            'edition_id' => $edition_id,
        ]);

        return $statement->rowCount();
    }

    public function exists_library_book(?int $library_id, int $edition_id, ?int $user_id = null): bool {
        if ($library_id === null) {
            $statement = $this->_database->prepare(
                'SELECT COUNT(*) FROM library_books
                 WHERE library_id IS NULL AND edition_id = :edition_id AND user_id = :user_id'
            );
            $statement->execute([
                'edition_id' => $edition_id,
                'user_id'    => $user_id,
            ]);

            return (int) $statement->fetchColumn() > 0;
        }

        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM library_books
             WHERE library_id = :library_id AND edition_id = :edition_id'
        );

        $statement->execute([
            'library_id' => $library_id,
            'edition_id' => $edition_id,
        ]);

        return (int) $statement->fetchColumn() > 0;
    }

    public function find_library_books(int $library_id, int $user_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT lb.id AS library_book_id,
                    lb.time_created AS time_added_to_library,
                    e.id AS edition_id, e.user_id AS edition_user_id,
                    e.edition_isbn, e.edition_language, e.edition_translator,
                    e.edition_publisher, e.edition_series, e.edition_pages,
                    e.edition_type, e.edition_cover_path,
                    e.edition_moderation_status,
                    b.id AS book_id, b.user_id AS book_user_id,
                    b.book_title, b.book_author, b.book_genre,
                    b.book_year_published, b.book_original_language,
                    b.book_moderation_status,
                    br.book_status, br.rate_score
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             JOIN books b ON b.id = e.book_id
             LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :user_id
             WHERE lb.library_id = :library_id
             ORDER BY lb.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('library_id', $library_id, PDO::PARAM_INT);
        $statement->bindValue('user_id', $user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_library_books(int $library_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM library_books WHERE library_id = :library_id'
        );

        $statement->execute(['library_id' => $library_id]);
        return (int) $statement->fetchColumn();
    }

    // ПОИСК ПО ВСЕЙ ПОЛКЕ ПОЛЬЗОВАТЕЛЯ  //

    public function search_user_library(
        int $user_id,
        ?string $query,
        array $filters,
        int $page,
        int $per_page
    ): array {
        // Принципиальная схема:
        //   - EXISTS-подзапрос отбирает издания, лежащие хотя бы на одной
        //     полке текущего пользователя (без GROUP BY — поэтому совместимо
        //     с `ONLY_FULL_GROUP_BY` в MariaDB).
        //   - Скаляр-подзапрос вычисляет MIN(time_created) — «когда впервые
        //     появилось на любой полке этого пользователя» — для сортировки.
        //   - LEFT JOIN `book_rates` — статус и оценка пользователя.
        $where = [
            'EXISTS (
                SELECT 1 FROM library_books lb
                WHERE lb.edition_id = e.id AND lb.user_id = :uid_filter
            )',
        ];
        $params = ['uid_filter' => $user_id];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :query_title OR b.book_author LIKE :query_author)';
            $params['query_title']  = '%' . $query . '%';
            $params['query_author'] = '%' . $query . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'br.book_status = :status';
            $params['status'] = $filters['status'];
        }

        if (!empty($filters['genre'])) {
            $where[] = 'b.book_genre = :genre';
            $params['genre'] = $filters['genre'];
        }

        if (!empty($filters['language'])) {
            $where[] = 'e.edition_language = :language';
            $params['language'] = $filters['language'];
        }

        $where_sql = implode(' AND ', $where);
        $offset = ($page - 1) * $per_page;

        $sql = "SELECT e.id AS edition_id, e.user_id AS edition_user_id,
                       e.edition_isbn, e.edition_language, e.edition_translator,
                       e.edition_publisher, e.edition_series, e.edition_pages,
                       e.edition_type, e.edition_cover_path,
                       e.edition_moderation_status,
                       b.id AS book_id, b.user_id AS book_user_id,
                       b.book_title, b.book_author, b.book_genre,
                       b.book_year_published, b.book_original_language,
                       b.book_moderation_status,
                       br.book_status, br.rate_score,
                       (SELECT MIN(lb2.time_created)
                        FROM library_books lb2
                        WHERE lb2.edition_id = e.id AND lb2.user_id = :uid_time
                       ) AS time_added_to_library
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :uid_rates
                WHERE {$where_sql}
                ORDER BY time_added_to_library DESC
                LIMIT :limit OFFSET :offset";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('uid_time', $user_id, PDO::PARAM_INT);
        $statement->bindValue('uid_rates', $user_id, PDO::PARAM_INT);

        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_user_library(int $user_id, ?string $query, array $filters): int {
        $where = [
            'EXISTS (
                SELECT 1 FROM library_books lb
                WHERE lb.edition_id = e.id AND lb.user_id = :uid_filter
            )',
        ];
        $params = ['uid_filter' => $user_id];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :query_title OR b.book_author LIKE :query_author)';
            $params['query_title']  = '%' . $query . '%';
            $params['query_author'] = '%' . $query . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'br.book_status = :status';
            $params['status'] = $filters['status'];
        }

        if (!empty($filters['genre'])) {
            $where[] = 'b.book_genre = :genre';
            $params['genre'] = $filters['genre'];
        }

        if (!empty($filters['language'])) {
            $where[] = 'e.edition_language = :language';
            $params['language'] = $filters['language'];
        }

        $where_sql = implode(' AND ', $where);

        $sql = "SELECT COUNT(*)
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :uid_rates
                WHERE {$where_sql}";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('uid_rates', $user_id, PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->execute();

        return (int) $statement->fetchColumn();
    }

    public function search_public_user_library(
        int $target_user_id,
        ?string $query,
        array $filters,
        int $page,
        int $per_page
    ): array {
        [$where_sql, $params] = $this->build_public_library_filter($target_user_id, $query, $filters);
        $offset = ($page - 1) * $per_page;

        $sql = "SELECT e.id AS edition_id, e.user_id AS edition_user_id,
                       e.edition_isbn, e.edition_language, e.edition_translator,
                       e.edition_publisher, e.edition_series, e.edition_pages,
                       e.edition_type, e.edition_cover_path,
                       e.edition_moderation_status,
                       b.id AS book_id, b.user_id AS book_user_id,
                       b.book_title, b.book_author, b.book_genre,
                       b.book_year_published, b.book_original_language,
                       b.book_moderation_status,
                       br.book_status, br.rate_score,
                       (SELECT MIN(lb2.time_created)
                        FROM library_books lb2
                        WHERE lb2.edition_id = e.id AND lb2.user_id = :uid_time
                       ) AS time_added_to_library
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :uid_rates
                WHERE {$where_sql}
                ORDER BY time_added_to_library DESC
                LIMIT :limit OFFSET :offset";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('uid_time', $target_user_id, PDO::PARAM_INT);
        $statement->bindValue('uid_rates', $target_user_id, PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_public_user_library(int $target_user_id, ?string $query, array $filters): int {
        [$where_sql, $params] = $this->build_public_library_filter($target_user_id, $query, $filters);

        $sql = "SELECT COUNT(*)
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :uid_rates
                WHERE {$where_sql}";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('uid_rates', $target_user_id, PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->execute();

        return (int) $statement->fetchColumn();
    }

    public function find_public_user_library_genres(int $target_user_id): array {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT b.book_genre
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             JOIN books b ON b.id = e.book_id
             WHERE lb.user_id = :user_id
               AND e.edition_moderation_status = :edition_status
               AND b.book_moderation_status = :book_status
               AND b.book_genre IS NOT NULL
               AND b.book_genre != ""
             ORDER BY b.book_genre'
        );
        $statement->execute([
            'user_id'        => $target_user_id,
            'edition_status' => EDITION_MODERATION_APPROVED,
            'book_status'    => BOOK_MODERATION_APPROVED,
        ]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    public function find_public_user_library_languages(int $target_user_id): array {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT e.edition_language
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             JOIN books b ON b.id = e.book_id
             WHERE lb.user_id = :user_id
               AND e.edition_moderation_status = :edition_status
               AND b.book_moderation_status = :book_status
               AND e.edition_language IS NOT NULL
               AND e.edition_language != ""
             ORDER BY e.edition_language'
        );
        $statement->execute([
            'user_id'        => $target_user_id,
            'edition_status' => EDITION_MODERATION_APPROVED,
            'book_status'    => BOOK_MODERATION_APPROVED,
        ]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    public function search_catalog(
        int $user_id,
        ?string $query,
        array $filters,
        int $page,
        int $per_page
    ): array {
        [$where_sql, $params] = $this->build_catalog_filter($user_id, $query, $filters);
        $offset = ($page - 1) * $per_page;

        $sql = "SELECT e.id AS edition_id, e.user_id AS edition_user_id,
                       e.edition_isbn, e.edition_language, e.edition_translator,
                       e.edition_publisher, e.edition_series, e.edition_pages,
                       e.edition_type, e.edition_cover_path,
                       e.edition_moderation_status,
                       b.id AS book_id, b.user_id AS book_user_id,
                       b.book_title, b.book_author, b.book_genre,
                       b.book_year_published, b.book_original_language,
                       b.book_moderation_status,
                       br.book_status, br.rate_score,
                       EXISTS(
                           SELECT 1 FROM library_books lb
                           WHERE lb.edition_id = e.id AND lb.user_id = :uid_shelf
                       ) AS is_on_shelf
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :uid_rates
                WHERE {$where_sql}
                ORDER BY is_on_shelf DESC, e.time_created DESC
                LIMIT :limit OFFSET :offset";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('uid_shelf', $user_id, PDO::PARAM_INT);
        $statement->bindValue('uid_rates', $user_id, PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_catalog(int $user_id, ?string $query, array $filters): int {
        [$where_sql, $params] = $this->build_catalog_filter($user_id, $query, $filters);

        $sql = "SELECT COUNT(*)
                FROM book_editions e
                JOIN books b ON b.id = e.book_id
                LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :uid_rates
                WHERE {$where_sql}";

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('uid_rates', $user_id, PDO::PARAM_INT);
        foreach ($params as $key => $value) {
            $statement->bindValue($key, $value);
        }
        $statement->execute();

        return (int) $statement->fetchColumn();
    }

    public function find_catalog_genres(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT b.book_genre
             FROM book_editions e
             JOIN books b ON b.id = e.book_id
             WHERE (e.edition_moderation_status = :edition_status
                    OR e.user_id = :uid_edition_owner)
               AND (b.book_moderation_status = :book_status
                    OR b.user_id = :uid_book_owner)
               AND b.book_merged_to_id IS NULL
               AND b.book_genre IS NOT NULL
               AND b.book_genre != ""
             ORDER BY b.book_genre'
        );
        $statement->execute([
            'edition_status'    => EDITION_MODERATION_APPROVED,
            'uid_edition_owner' => $user_id,
            'book_status'       => BOOK_MODERATION_APPROVED,
            'uid_book_owner'    => $user_id,
        ]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    public function find_catalog_languages(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT e.edition_language
             FROM book_editions e
             JOIN books b ON b.id = e.book_id
             WHERE (e.edition_moderation_status = :edition_status
                    OR e.user_id = :uid_edition_owner)
               AND (b.book_moderation_status = :book_status
                    OR b.user_id = :uid_book_owner)
               AND b.book_merged_to_id IS NULL
               AND e.edition_language IS NOT NULL
               AND e.edition_language != ""
             ORDER BY e.edition_language'
        );
        $statement->execute([
            'edition_status'    => EDITION_MODERATION_APPROVED,
            'uid_edition_owner' => $user_id,
            'book_status'       => BOOK_MODERATION_APPROVED,
            'uid_book_owner'    => $user_id,
        ]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    public function count_public_unique_books_on_shelf(int $target_user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(DISTINCT e.book_id)
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             JOIN books b ON b.id = e.book_id
             WHERE lb.user_id = :user_id
               AND e.edition_moderation_status = :edition_status
               AND b.book_moderation_status = :book_status'
        );
        $statement->execute([
            'user_id'        => $target_user_id,
            'edition_status' => EDITION_MODERATION_APPROVED,
            'book_status'    => BOOK_MODERATION_APPROVED,
        ]);
        return (int) ($statement->fetchColumn() ?: 0);
    }

    public function find_user_library_genres(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT b.book_genre
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             JOIN books b ON b.id = e.book_id
             WHERE lb.user_id = :user_id
               AND b.book_genre IS NOT NULL
               AND b.book_genre != ""
             ORDER BY b.book_genre'
        );

        $statement->execute(['user_id' => $user_id]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    public function count_unique_books_on_shelf(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(DISTINCT e.book_id)
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             WHERE lb.user_id = :user_id'
        );
        $statement->execute(['user_id' => $user_id]);
        return (int) ($statement->fetchColumn() ?: 0);
    }

    public function has_user_book(int $user_id, int $book_id): bool {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*)
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             WHERE lb.user_id = :user_id AND e.book_id = :book_id'
        );

        $statement->execute([
            'user_id' => $user_id,
            'book_id' => $book_id,
        ]);

        return (int) $statement->fetchColumn() > 0;
    }

    public function find_user_library_languages(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT DISTINCT e.edition_language
             FROM library_books lb
             JOIN book_editions e ON e.id = lb.edition_id
             WHERE lb.user_id = :user_id
               AND e.edition_language IS NOT NULL
               AND e.edition_language != ""
             ORDER BY e.edition_language'
        );

        $statement->execute(['user_id' => $user_id]);
        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }

    private function build_catalog_filter(int $user_id, ?string $query, array $filters): array {
        $where = [
            '(e.edition_moderation_status = :edition_status OR e.user_id = :uid_edition_owner)',
            '(b.book_moderation_status = :book_status OR b.user_id = :uid_book_owner)',
            'b.book_merged_to_id IS NULL',
        ];
        $params = [
            'edition_status'    => EDITION_MODERATION_APPROVED,
            'uid_edition_owner' => $user_id,
            'book_status'       => BOOK_MODERATION_APPROVED,
            'uid_book_owner'    => $user_id,
        ];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :query_title
                OR b.book_author LIKE :query_author
                OR e.edition_isbn LIKE :query_isbn)';
            $like = '%' . $query . '%';
            $params['query_title']  = $like;
            $params['query_author'] = $like;
            $params['query_isbn']   = $like;
        }

        if (!empty($filters['status'])) {
            $where[] = 'br.book_status = :status';
            $params['status'] = $filters['status'];
        }

        if (!empty($filters['genre'])) {
            $where[] = 'b.book_genre = :genre';
            $params['genre'] = $filters['genre'];
        }

        if (!empty($filters['language'])) {
            $where[] = 'e.edition_language = :language';
            $params['language'] = $filters['language'];
        }

        return [implode(' AND ', $where), $params];
    }

    private function build_public_library_filter(int $target_user_id, ?string $query, array $filters): array {
        $where = [
            'EXISTS (
                SELECT 1 FROM library_books lb
                WHERE lb.edition_id = e.id AND lb.user_id = :uid_filter
            )',
            'e.edition_moderation_status = :edition_status',
            'b.book_moderation_status = :book_status',
        ];
        $params = [
            'uid_filter'     => $target_user_id,
            'edition_status' => EDITION_MODERATION_APPROVED,
            'book_status'    => BOOK_MODERATION_APPROVED,
        ];

        if (!empty($query)) {
            $where[] = '(b.book_title LIKE :query_title OR b.book_author LIKE :query_author)';
            $params['query_title']  = '%' . $query . '%';
            $params['query_author'] = '%' . $query . '%';
        }

        if (!empty($filters['status'])) {
            $where[] = 'br.book_status = :status';
            $params['status'] = $filters['status'];
        }

        if (!empty($filters['genre'])) {
            $where[] = 'b.book_genre = :genre';
            $params['genre'] = $filters['genre'];
        }

        if (!empty($filters['language'])) {
            $where[] = 'e.edition_language = :language';
            $params['language'] = $filters['language'];
        }

        return [implode(' AND ', $where), $params];
    }

    private function get_library_scope_id(?int $library_id): int {
        return $library_id ?? 0;
    }

    private function insert_library_book_row(?int $library_id, int $edition_id, int $user_id): bool {
        if ($this->can_write_library_scope_id()) {
            $statement = $this->_database->prepare(
                'INSERT INTO library_books (library_id, library_scope_id, edition_id, user_id)
                 VALUES (:library_id, :library_scope_id, :edition_id, :user_id)'
            );
            $statement->bindValue(
                'library_scope_id',
                $this->get_library_scope_id($library_id),
                PDO::PARAM_INT
            );
        } else {
            $statement = $this->_database->prepare(
                'INSERT INTO library_books (library_id, edition_id, user_id)
                 VALUES (:library_id, :edition_id, :user_id)'
            );
        }

        if ($library_id === null) {
            $statement->bindValue('library_id', null, PDO::PARAM_NULL);
        } else {
            $statement->bindValue('library_id', $library_id, PDO::PARAM_INT);
        }
        $statement->bindValue('edition_id', $edition_id, PDO::PARAM_INT);
        $statement->bindValue('user_id', $user_id, PDO::PARAM_INT);

        return $statement->execute();
    }

    private function can_write_library_scope_id(): bool {
        if ($this->_can_write_library_scope_id !== null) {
            return $this->_can_write_library_scope_id;
        }

        $statement = $this->_database->prepare(
            'SELECT EXTRA
             FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name
             LIMIT 1'
        );
        $statement->execute([
            'table_name'  => 'library_books',
            'column_name' => 'library_scope_id',
        ]);
        $column = $statement->fetch(PDO::FETCH_ASSOC);

        if (!$column) {
            $this->_can_write_library_scope_id = false;
            return $this->_can_write_library_scope_id;
        }

        $extra = strtolower((string) ($column['Extra'] ?? ''));
        $this->_can_write_library_scope_id = strpos($extra, 'generated') === false;

        return $this->_can_write_library_scope_id;
    }
}
