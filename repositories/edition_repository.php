<?php
/**
 * РЕПОЗИТОРИЙ: EditionRepository — SQL-запросы к таблице book_editions 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с конкретными изданиями произведений. Издание — физический
 * или электронный экземпляр с ISBN, языком, переводчиком, обложкой и т.д.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ//

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС EditionRepository //

class EditionRepository {

    private PDO $_database;

    public function __construct() {
        $this->_database = get_database_connection();
    }

    // ВСТАВКА / ОБНОВЛЕНИЕ / УДАЛЕНИЕ  //

    public function insert_edition(int $book_id, int $user_id, array $edition_data): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_editions (
                book_id, user_id, edition_isbn, edition_language, edition_translator,
                edition_publisher, edition_series, edition_pages, edition_type,
                edition_cover_path, edition_moderation_status
            ) VALUES (
                :book_id, :user_id, :isbn, :language, :translator,
                :publisher, :series, :pages, :type,
                :cover, :moderation_status
            )'
        );

        $statement->execute([
            'book_id'           => $book_id,
            'user_id'           => $user_id,
            'isbn'              => $edition_data['edition_isbn'] ?? null,
            'language'          => $edition_data['edition_language'] ?? null,
            'translator'        => $edition_data['edition_translator'] ?? null,
            'publisher'         => $edition_data['edition_publisher'] ?? null,
            'series'            => $edition_data['edition_series'] ?? null,
            'pages'             => $edition_data['edition_pages'] ?? null,
            'type'              => $edition_data['edition_type'] ?? null,
            'cover'             => $edition_data['edition_cover_path'] ?? null,
            'moderation_status' => $edition_data['edition_moderation_status'] ?? EDITION_MODERATION_PENDING,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function update_edition(int $edition_id, array $edition_data): bool {
        $fields = [];
        $params = ['edition_id' => $edition_id];

        $allowed = [
            'edition_isbn', 'edition_language', 'edition_translator',
            'edition_publisher', 'edition_series', 'edition_pages',
            'edition_type', 'edition_cover_path',
        ];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $edition_data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $edition_data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE book_editions SET ' . implode(', ', $fields)
             . ' WHERE id = :edition_id';

        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    public function delete_edition(int $edition_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM book_editions WHERE id = :edition_id'
        );
        return $statement->execute(['edition_id' => $edition_id]);
    }

    //  ПОИСК  //

    public function find_edition_by_id(int $edition_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, book_id, user_id, edition_isbn, edition_language,
                    edition_translator, edition_publisher, edition_series,
                    edition_pages, edition_type, edition_cover_path,
                    edition_moderation_status, time_created, time_updated
             FROM book_editions
             WHERE id = :edition_id'
        );

        $statement->execute(['edition_id' => $edition_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_editions_by_book_id(int $book_id, int $current_user_id): array {
        $sql = 'SELECT e.id AS edition_id, e.book_id, e.user_id, e.edition_isbn, e.edition_language,
                       e.edition_translator, e.edition_publisher, e.edition_series,
                       e.edition_pages, e.edition_type, e.edition_cover_path,
                       e.edition_moderation_status, e.time_created, e.time_updated,
                       EXISTS(
                           SELECT 1 FROM library_books lb
                           WHERE lb.edition_id = e.id AND lb.user_id = :uid_shelf
                       ) AS is_on_shelf,
                       (
                           SELECT lb3.library_id
                           FROM library_books lb3
                           WHERE lb3.edition_id = e.id
                             AND lb3.user_id = :uid_shelf_library
                             AND lb3.library_id IS NOT NULL
                           ORDER BY lb3.time_created DESC
                           LIMIT 1
                       ) AS shelf_library_id
                FROM book_editions e
                WHERE e.book_id = :book_id
                  AND (e.edition_moderation_status = :status_approved
                       OR e.user_id = :uid_filter)
                ORDER BY
                    CASE
                        WHEN e.edition_moderation_status = :status_pending AND e.user_id = :uid_pending THEN 0
                        WHEN EXISTS(
                            SELECT 1 FROM library_books lb2
                            WHERE lb2.edition_id = e.id AND lb2.user_id = :uid_order_shelf
                        ) THEN 1
                        ELSE 2
                    END,
                    e.time_created DESC';

        $statement = $this->_database->prepare($sql);
        $statement->execute([
            'book_id'         => $book_id,
            'status_approved' => EDITION_MODERATION_APPROVED,
            'status_pending'  => EDITION_MODERATION_PENDING,
            'uid_shelf'         => $current_user_id,
            'uid_shelf_library' => $current_user_id,
            'uid_filter'        => $current_user_id,
            'uid_pending'       => $current_user_id,
            'uid_order_shelf'   => $current_user_id,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find_all_editions_by_book_id(int $book_id): array {
        $statement = $this->_database->prepare(
            'SELECT id, book_id, user_id, edition_isbn, edition_language,
                    edition_translator, edition_publisher, edition_series,
                    edition_pages, edition_type, edition_cover_path,
                    edition_moderation_status, time_created, time_updated
             FROM book_editions
             WHERE book_id = :book_id
             ORDER BY time_created DESC'
        );

        $statement->execute(['book_id' => $book_id]);
        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_editions_by_book_id(int $book_id, int $current_user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM book_editions
             WHERE book_id = :book_id
               AND (edition_moderation_status = :status_approved
                    OR user_id = :user_id)'
        );

        $statement->execute([
            'book_id'         => $book_id,
            'status_approved' => EDITION_MODERATION_APPROVED,
            'user_id'         => $current_user_id,
        ]);

        return (int) $statement->fetchColumn();
    }

    // МОДЕРАЦИЯ  //

    public function find_pending_editions(int $limit, int $offset): array {
        $statement = $this->_database->prepare(
            'SELECT e.id, e.book_id, e.user_id, e.edition_isbn, e.edition_language,
                    e.edition_translator, e.edition_publisher, e.edition_series,
                    e.edition_pages, e.edition_type, e.edition_cover_path,
                    e.edition_moderation_status, e.time_created, e.time_updated,
                    b.book_title, b.book_author, b.book_moderation_status
             FROM book_editions e
             JOIN books b ON b.id = e.book_id
             WHERE e.edition_moderation_status = :status
             ORDER BY e.time_created ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('status', EDITION_MODERATION_PENDING);
        $statement->bindValue('limit', $limit, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_pending_editions(): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) FROM book_editions
             WHERE edition_moderation_status = :status'
        );
        $statement->execute(['status' => EDITION_MODERATION_PENDING]);

        return (int) $statement->fetchColumn();
    }

    public function update_edition_moderation_status(int $edition_id, string $status): bool {
        $statement = $this->_database->prepare(
            'UPDATE book_editions
             SET edition_moderation_status = :status
             WHERE id = :edition_id'
        );

        return $statement->execute([
            'edition_id' => $edition_id,
            'status'     => $status,
        ]);
    }
}
