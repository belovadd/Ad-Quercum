<?php
/**
 * РЕПОЗИТОРИЙ: BookRepository — SQL-запросы к таблицам books и book_rates 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с произведениями (`books`) и оценками/рецензиями (`book_rates`).
 * Произведение — абстрактная литературная единица. Конкретные издания (с ISBN,
 * обложкой, языком, переводчиком) живут в таблице `book_editions` — см.
 * [`edition_repository.php`](./edition_repository.php).
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС BookRepository  //

class BookRepository {

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

    //  ТРАНЗАКЦИИ  //

    public function run_in_transaction(callable $callback) {
        $this->_database->beginTransaction();

        try {
            $result = $callback();
            $this->_database->commit();

            return $result;
        } catch (Throwable $exception) {
            $this->_database->rollBack();
            throw $exception;
        }
    }

    // ПРОИЗВЕДЕНИЯ: ВСТАВКА  //

    public function insert_book(int $user_id, array $book_data): int {
        $statement = $this->_database->prepare(
            'INSERT INTO books (user_id, book_title, book_author, book_genre,
                                book_year_published, book_original_language,
                                book_description, book_moderation_status)
             VALUES (:user_id, :title, :author, :genre, :year, :language,
                     :description, :moderation_status)'
        );

        $statement->execute([
            'user_id'           => $user_id,
            'title'             => $book_data['book_title'],
            'author'            => $book_data['book_author'],
            'genre'             => $book_data['book_genre'] ?? null,
            'year'              => $book_data['book_year_published'] ?? null,
            'language'          => $book_data['book_original_language'] ?? null,
            'description'       => $book_data['book_description'] ?? null,
            'moderation_status' => $book_data['book_moderation_status'] ?? BOOK_MODERATION_PENDING,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    // ПРОИЗВЕДЕНИЯ: ПОИСК  //

    public function find_by_id(int $book_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, book_title, book_author, book_genre,
                    book_year_published, book_original_language, book_description,
                    book_moderation_status, book_merged_to_id,
                    time_created, time_updated
             FROM books
             WHERE id = :book_id'
        );

        $statement->execute(['book_id' => $book_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_by_id_with_rate(int $book_id, int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT b.id, b.user_id, b.book_title, b.book_author, b.book_genre,
                    b.book_year_published, b.book_original_language, b.book_description,
                    b.book_moderation_status, b.book_merged_to_id,
                    b.time_created, b.time_updated,
                    br.book_status, br.rate_score, br.rate_review, br.rate_notes
             FROM books b
             LEFT JOIN book_rates br ON br.book_id = b.id AND br.user_id = :user_id
             WHERE b.id = :book_id'
        );

        $statement->execute([
            'book_id' => $book_id,
            'user_id' => $user_id,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    // ПРОИЗВЕДЕНИЯ: ОБНОВЛЕНИЕ / УДАЛЕНИЕ  //

    public function update_book(int $book_id, array $book_data): bool {
        $fields = [];
        $params = ['book_id' => $book_id];

        $allowed = [
            'book_title', 'book_author', 'book_genre',
            'book_year_published', 'book_original_language', 'book_description',
        ];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $book_data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $book_data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE books SET ' . implode(', ', $fields) . ' WHERE id = :book_id';
        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    public function delete_book(int $book_id): bool {
        $statement = $this->_database->prepare('DELETE FROM books WHERE id = :book_id');
        return $statement->execute(['book_id' => $book_id]);
    }

    //  АВТОКОМПЛИТ И СТАТИСТИКА  //

    public function search_books_autocomplete(string $query, int $current_user_id, int $limit): array {
        // Эскейпинг wildcard-символов (`%` / `_` / `\`) — чтобы пользовательский
        // ввод не превращался в шаблон LIKE. Используем явный escape `\`.
        $escaped_query = addcslashes($query, '%_\\');

        $sql = 'SELECT b.id, b.book_title, b.book_author, b.book_year_published,
                       b.book_original_language, b.book_moderation_status,
                       (SELECT COUNT(*) FROM book_editions e
                        WHERE e.book_id = b.id
                          AND (e.edition_moderation_status = :status_approved_count
                               OR e.user_id = :uid_count)
                       ) AS editions_count,
                       (SELECT e2.edition_cover_path FROM book_editions e2
                        WHERE e2.book_id = b.id
                          AND (e2.edition_moderation_status = :status_approved_cover
                               OR e2.user_id = :uid_cover)
                          AND e2.edition_cover_path IS NOT NULL
                        ORDER BY (e2.edition_moderation_status = :status_approved_order) DESC,
                                 e2.time_created DESC
                        LIMIT 1
                       ) AS sample_cover_path
                FROM books b
                WHERE (b.book_title LIKE :contains_query_title ESCAPE \'\\\\\'
                       OR b.book_author LIKE :contains_query_author ESCAPE \'\\\\\')
                  AND b.book_merged_to_id IS NULL
                  AND (b.book_moderation_status = :status_approved_book
                       OR b.user_id = :uid_filter)
                ORDER BY
                    CASE
                        WHEN b.book_title LIKE :prefix_query_title ESCAPE \'\\\\\' THEN 0
                        WHEN b.book_author LIKE :prefix_query_author ESCAPE \'\\\\\' THEN 1
                        WHEN b.book_title LIKE :contains_query_title_order ESCAPE \'\\\\\' THEN 2
                        ELSE 3
                    END,
                    b.book_title ASC
                LIMIT :limit';

        $statement = $this->_database->prepare($sql);
        $statement->bindValue('prefix_query_title', $escaped_query . '%');
        $statement->bindValue('prefix_query_author', $escaped_query . '%');
        $statement->bindValue('contains_query_title', '%' . $escaped_query . '%');
        $statement->bindValue('contains_query_author', '%' . $escaped_query . '%');
        $statement->bindValue('contains_query_title_order', '%' . $escaped_query . '%');
        $statement->bindValue('status_approved_count', EDITION_MODERATION_APPROVED);
        $statement->bindValue('status_approved_cover', EDITION_MODERATION_APPROVED);
        $statement->bindValue('status_approved_order', EDITION_MODERATION_APPROVED);
        $statement->bindValue('status_approved_book', BOOK_MODERATION_APPROVED);
        $statement->bindValue('uid_count', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('uid_cover', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('uid_filter', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_book_readers(int $book_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(DISTINCT user_id) FROM book_rates
             WHERE book_id = :book_id'
        );

        $statement->execute(['book_id' => $book_id]);

        return (int) $statement->fetchColumn();
    }

    public function count_user_books(int $user_id, ?int $library_id = null, array $filters = []): int {
        $params = ['user_id' => $user_id];
        $where = ['br.user_id = :user_id'];
        $join = '';

        if (!empty($filters['status'])) {
            $where[] = 'br.book_status = :book_status';
            $params['book_status'] = $filters['status'];
        }

        if ($library_id !== null) {
            $join = ' INNER JOIN book_editions be ON be.book_id = br.book_id
                      INNER JOIN library_books lb ON lb.edition_id = be.id
                         AND lb.user_id = br.user_id
                         AND lb.library_id = :library_id';
            $params['library_id'] = $library_id;
        }

        $statement = $this->_database->prepare(
            'SELECT COUNT(DISTINCT br.book_id)
             FROM book_rates br' . $join . '
             WHERE ' . implode(' AND ', $where)
        );

        foreach ($params as $name => $value) {
            $type = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $statement->bindValue($name, $value, $type);
        }

        $statement->execute();

        return (int) $statement->fetchColumn();
    }

    public function count_user_finished_books_for_year(int $user_id, int $year): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(DISTINCT br.book_id)
             FROM book_rates br
             WHERE br.user_id = :user_id
               AND br.book_status = :book_status
               AND YEAR(br.time_updated) = :year'
        );

        $statement->execute([
            'user_id'     => $user_id,
            'book_status' => BOOK_STATUS_FINISHED,
            'year'        => $year,
        ]);

        return (int) $statement->fetchColumn();
    }

    public function sum_user_finished_pages(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COALESCE(SUM(finished_books.edition_pages), 0)
             FROM (
                 SELECT br.book_id, MAX(be.edition_pages) AS edition_pages
                 FROM book_rates br
                 INNER JOIN book_editions be ON be.book_id = br.book_id
                 INNER JOIN library_books lb ON lb.edition_id = be.id
                    AND lb.user_id = br.user_id
                 WHERE br.user_id = :user_id
                   AND br.book_status = :book_status
                   AND be.edition_pages IS NOT NULL
                 GROUP BY br.book_id
             ) finished_books'
        );

        $statement->execute([
            'user_id'     => $user_id,
            'book_status' => BOOK_STATUS_FINISHED,
        ]);

        return (int) $statement->fetchColumn();
    }

    // МОДЕРАЦИЯ  //

    public function update_moderation_status(int $book_id, string $status): bool {
        $statement = $this->_database->prepare(
            'UPDATE books SET book_moderation_status = :status WHERE id = :book_id'
        );

        return $statement->execute([
            'book_id' => $book_id,
            'status'  => $status,
        ]);
    }

    public function merge_book_into_master(int $duplicate_id, int $master_id): void {
        if ($duplicate_id === $master_id) {
            throw new RuntimeException('Нельзя слить произведение само в себя');
        }

        $this->_database->beginTransaction();

        try {
            // 1. Сначала удаляем оценки дубликата, для которых у пользователя
            //    уже есть оценка мастера (UNIQUE user_id+book_id предотвратит UPDATE).
            $statement = $this->_database->prepare(
                'DELETE FROM book_rates
                 WHERE book_id = :duplicate_id
                   AND user_id IN (SELECT user_id FROM (
                       SELECT user_id FROM book_rates WHERE book_id = :master_id
                   ) AS existing)'
            );
            $statement->execute([
                'duplicate_id' => $duplicate_id,
                'master_id'    => $master_id,
            ]);

            // 2. Перевешиваем оставшиеся оценки на мастер.
            $statement = $this->_database->prepare(
                'UPDATE book_rates SET book_id = :master_id WHERE book_id = :duplicate_id'
            );
            $statement->execute([
                'master_id'    => $master_id,
                'duplicate_id' => $duplicate_id,
            ]);

            // 3. Перевешиваем издания.
            $statement = $this->_database->prepare(
                'UPDATE book_editions SET book_id = :master_id WHERE book_id = :duplicate_id'
            );
            $statement->execute([
                'master_id'    => $master_id,
                'duplicate_id' => $duplicate_id,
            ]);

            // 4. Перевешиваем сессии чтения.
            $statement = $this->_database->prepare(
                'UPDATE reading_sessions SET book_id = :master_id WHERE book_id = :duplicate_id'
            );
            $statement->execute([
                'master_id'    => $master_id,
                'duplicate_id' => $duplicate_id,
            ]);

            // 5. Перевешиваем публикации пользователей.
            $statement = $this->_database->prepare(
                'UPDATE user_publications SET book_id = :master_id WHERE book_id = :duplicate_id'
            );
            $statement->execute([
                'master_id'    => $master_id,
                'duplicate_id' => $duplicate_id,
            ]);

            // 6. Перевешиваем публикации клубов.
            $statement = $this->_database->prepare(
                'UPDATE book_club_publications SET book_id = :master_id WHERE book_id = :duplicate_id'
            );
            $statement->execute([
                'master_id'    => $master_id,
                'duplicate_id' => $duplicate_id,
            ]);

            // 7. Помечаем дубликат как merged.
            $statement = $this->_database->prepare(
                'UPDATE books SET book_merged_to_id = :master_id WHERE id = :duplicate_id'
            );
            $statement->execute([
                'master_id'    => $master_id,
                'duplicate_id' => $duplicate_id,
            ]);

            $this->_database->commit();
        } catch (Throwable $exception) {
            $this->_database->rollBack();
            throw $exception;
        }
    }

    // ОЦЕНКИ: ВСТАВКА / ОБНОВЛЕНИЕ  //

    public function insert_book_rate(int $book_id, int $user_id, string $status): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_rates (book_id, user_id, book_status)
             VALUES (:book_id, :user_id, :status)'
        );

        $statement->execute([
            'book_id' => $book_id,
            'user_id' => $user_id,
            'status'  => $status,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function update_book_rate(int $book_id, int $user_id, array $data): bool {
        $fields = [];
        $params = ['book_id' => $book_id, 'user_id' => $user_id];

        $allowed = ['book_status', 'rate_score', 'rate_review', 'rate_notes'];

        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE book_rates SET ' . implode(', ', $fields)
             . ' WHERE book_id = :book_id AND user_id = :user_id';

        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    public function find_book_rate(int $book_id, int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, book_id, user_id, rate_score, rate_review, rate_notes,
                    book_status, time_created, time_updated
             FROM book_rates
             WHERE book_id = :book_id AND user_id = :user_id'
        );

        $statement->execute([
            'book_id' => $book_id,
            'user_id' => $user_id,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    // РЕЦЕНЗИИ  //

    public function find_book_reviews(int $book_id, int $page, int $per_page, ?int $current_user_id = null): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT br.rate_score, br.rate_review, br.time_created,
                    u.id as reviewer_id, u.user_name_first, u.user_name_last,
                    u.user_avatar_path
             FROM book_rates br
             JOIN users u ON u.id = br.user_id
             WHERE br.book_id = :book_id AND br.rate_review IS NOT NULL AND br.rate_review != ""
             ORDER BY CASE WHEN br.user_id = :current_user_id THEN 0 ELSE 1 END,
                      br.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('book_id', $book_id, PDO::PARAM_INT);
        if ($current_user_id === null) {
            $statement->bindValue('current_user_id', null, PDO::PARAM_NULL);
        } else {
            $statement->bindValue('current_user_id', $current_user_id, PDO::PARAM_INT);
        }
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_book_reviews(int $book_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as total
             FROM book_rates
             WHERE book_id = :book_id AND rate_review IS NOT NULL AND rate_review != ""'
        );

        $statement->execute(['book_id' => $book_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }
}
