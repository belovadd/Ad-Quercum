<?php
/**
 * СЕРВИС: BookService — Бизнес-логика произведений и изданий 
 *
 * НАЗНАЧЕНИЕ:
 * Высокоуровневые операции с произведениями (`books`) и их изданиями
 * (`book_editions`). Оркестрирует атомарное двухшаговое создание через
 * транзакционный helper репозитория, управляет модерацией видимости и оценками.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/book_repository.php';
require_once __DIR__ . '/../repositories/edition_repository.php';
require_once __DIR__ . '/../repositories/library_repository.php';
require_once __DIR__ . '/../core/file_uploader.php';
require_once __DIR__ . '/../core/pagination_helper.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС BookService //

class BookService {

    
    private BookRepository $_book_repository;

    private EditionRepository $_edition_repository;

    private LibraryRepository $_library_repository;

    public function __construct() {
        $this->_book_repository    = new BookRepository();
        $this->_edition_repository = new EditionRepository();
        $this->_library_repository = new LibraryRepository();
    }

    // ПРОИЗВЕДЕНИЯ: КОМПЛЕКСНЫЕ ОПЕРАЦИИ  //

    public function create_book_with_first_edition(
        int $user_id,
        array $book_data,
        array $edition_data,
        ?int $library_id
    ): array {
        if ($library_id !== null) {
            $this->assert_library_owned_by_user($library_id, $user_id);
        }

        $created_ids = $this->_book_repository->run_in_transaction(
            function () use ($user_id, $book_data, $edition_data, $library_id): array {
                $book_id = $this->_book_repository->insert_book($user_id, $book_data);

                $edition_id = $this->_edition_repository->insert_edition(
                    $book_id, $user_id, $edition_data
                );

                $this->_book_repository->insert_book_rate(
                    $book_id, $user_id, BOOK_STATUS_WANT_TO_READ
                );

                $this->_library_repository->ensure_library_book_on_shelf($user_id, $edition_id);

                if ($library_id !== null) {
                    $this->_library_repository->insert_collection_book(
                        $library_id, $edition_id, $user_id
                    );
                }

                return [
                    'book_id'    => $book_id,
                    'edition_id' => $edition_id,
                ];
            }
        );

        $book_id = $created_ids['book_id'];
        $edition_id = $created_ids['edition_id'];

        return [
            'book'         => $this->_book_repository->find_by_id_with_rate($book_id, $user_id),
            'edition'      => $this->_edition_repository->find_edition_by_id($edition_id),
            'library_book' => [
                'library_id' => $library_id,
                'edition_id' => $edition_id,
            ],
        ];
    }

    public function get_book_with_editions(
        int $book_id,
        int $current_user_id,
        string $current_user_role = USER_ROLE_USER
    ): array {
        $book = $this->_book_repository->find_by_id_with_rate($book_id, $current_user_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $this->assert_book_visible($book, $current_user_id, $current_user_role);

        $editions = $this->_edition_repository->find_editions_by_book_id(
            $book_id, $current_user_id
        );

        // Дополнительные флаги per-edition: is_owner для UI «редактировать/удалить».
        foreach ($editions as &$edition) {
            $edition['is_owner']    = ((int) $edition['user_id']) === $current_user_id;
            $edition['is_pending']  = $edition['edition_moderation_status'] === EDITION_MODERATION_PENDING;
            $edition['is_on_shelf'] = (int) $edition['is_on_shelf'] === 1;
        }
        unset($edition);

        $book['is_owner']      = ((int) $book['user_id']) === $current_user_id;
        $readers_count         = $this->_book_repository->count_book_readers($book_id);

        return [
            'book'          => $book,
            'editions'      => $editions,
            'readers_count' => $readers_count,
        ];
    }

    public function search_autocomplete(string $query, int $current_user_id): array {
        $query = trim($query);

        if (mb_strlen($query) < AUTOCOMPLETE_MIN_QUERY_LENGTH) {
            return [];
        }

        return $this->_book_repository->search_books_autocomplete(
            $query,
            $current_user_id,
            AUTOCOMPLETE_MAX_RESULTS
        );
    }

    public function update_book(int $user_id, int $book_id, array $book_data): array {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        if ((int) $book['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для редактирования этого произведения');
        }

        $this->_book_repository->update_book($book_id, $book_data);

        return $this->_book_repository->find_by_id_with_rate($book_id, $user_id);
    }

    public function delete_book(int $user_id, int $book_id): void {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        if ((int) $book['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для удаления этого произведения');
        }

        // Снимаем файлы обложек ВСЕХ изданий (включая чужие approved/pending),
        // т.к. ON DELETE CASCADE снесёт их вместе с произведением, а файлы
        // на диске останутся orphan. Фильтр видимости здесь не применяется —
        // решение сносить чужие издания уже принято на уровне UI/прав.
        $editions = $this->_edition_repository->find_all_editions_by_book_id($book_id);
        foreach ($editions as $edition) {
            delete_uploaded_file($edition['edition_cover_path']);
        }

        $this->_book_repository->delete_book($book_id);
    }

    // ИЗДАНИЯ  //

    public function create_edition_for_book(
        int $user_id,
        int $book_id,
        array $edition_data,
        ?int $library_id,
        string $user_role = USER_ROLE_USER
    ): array {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $this->assert_book_visible($book, $user_id, $user_role);

        if ($library_id !== null) {
            $this->assert_library_owned_by_user($library_id, $user_id);
        }

        $created_ids = $this->_book_repository->run_in_transaction(
            function () use ($book_id, $user_id, $edition_data, $library_id): array {
                $edition_id = $this->_edition_repository->insert_edition(
                    $book_id, $user_id, $edition_data
                );

                // Если у пользователя ещё нет book_rate на это произведение —
                // создаём начальную запись со статусом want_to_read.
                $existing_rate = $this->_book_repository->find_book_rate($book_id, $user_id);
                if ($existing_rate === null) {
                    $this->_book_repository->insert_book_rate(
                        $book_id, $user_id, BOOK_STATUS_WANT_TO_READ
                    );
                }

                if ($library_id !== null) {
                    $this->_library_repository->insert_collection_book(
                        $library_id, $edition_id, $user_id
                    );
                } else {
                    $this->_library_repository->ensure_library_book_on_shelf($user_id, $edition_id);
                }

                return ['edition_id' => $edition_id];
            }
        );

        $edition_id = $created_ids['edition_id'];

        return [
            'edition'      => $this->_edition_repository->find_edition_by_id($edition_id),
            'library_book' => ['library_id' => $library_id, 'edition_id' => $edition_id],
        ];
    }

    public function update_edition(
        int $user_id,
        int $edition_id,
        array $edition_data,
        bool $remove_cover = false
    ): array {
        $edition = $this->_edition_repository->find_edition_by_id($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        if ((int) $edition['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для редактирования этого издания');
        }

        if ($remove_cover) {
            $edition_data['edition_cover_path'] = null;
        }

        $this->_edition_repository->update_edition($edition_id, $edition_data);

        if ($remove_cover) {
            delete_uploaded_file($edition['edition_cover_path']);
        }

        return $this->_edition_repository->find_edition_by_id($edition_id);
    }

    public function delete_edition(int $user_id, int $edition_id): void {
        $edition = $this->_edition_repository->find_edition_by_id($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        if ((int) $edition['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для удаления этого издания');
        }

        delete_uploaded_file($edition['edition_cover_path']);
        $this->_edition_repository->delete_edition($edition_id);
    }

    public function upload_edition_cover(int $user_id, int $edition_id, array $file): array {
        $edition = $this->_edition_repository->find_edition_by_id($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        if ((int) $edition['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для изменения этого издания');
        }

        $errors = validate_uploaded_image($file);
        if (!empty($errors)) {
            throw new RuntimeException(implode('; ', $errors));
        }

        // Сохраняем новый файл ДО удаления старого: если save или update БД
        // упадут — старая обложка останется на месте. При ошибке update БД
        // вычищаем только что сохранённый файл, чтобы не плодить orphans.
        $new_cover_url = save_uploaded_image($file, BOOK_COVERS_PATH, BOOK_COVERS_URL);

        try {
            $this->_edition_repository->update_edition($edition_id, [
                'edition_cover_path' => $new_cover_url,
            ]);
        } catch (Throwable $exception) {
            delete_uploaded_file($new_cover_url);
            throw $exception;
        }

        delete_uploaded_file($edition['edition_cover_path']);

        return $this->_edition_repository->find_edition_by_id($edition_id);
    }

    // СТАТУС / ОЦЕНКИ / РЕЦЕНЗИИ  //

    public function update_book_status(
        int $user_id,
        int $book_id,
        string $status,
        string $role = USER_ROLE_USER
    ): array {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $this->assert_book_visible($book, $user_id, $role);

        $existing_rate = $this->_book_repository->find_book_rate($book_id, $user_id);

        if ($existing_rate === null) {
            $this->_book_repository->insert_book_rate($book_id, $user_id, $status);
        } else {
            $this->_book_repository->update_book_rate($book_id, $user_id, [
                'book_status' => $status,
            ]);
        }

        return $this->_book_repository->find_by_id_with_rate($book_id, $user_id);
    }

    public function rate_book(
        int $user_id,
        int $book_id,
        ?int $score,
        ?string $review,
        ?string $notes,
        string $role = USER_ROLE_USER
    ): array {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $this->assert_book_visible($book, $user_id, $role);

        $rate_data = [];
        if ($score !== null)  { $rate_data['rate_score']  = $score; }
        if ($review !== null) { $rate_data['rate_review'] = $review; }
        if ($notes !== null)  { $rate_data['rate_notes']  = $notes; }

        $existing_rate = $this->_book_repository->find_book_rate($book_id, $user_id);

        if ($existing_rate === null) {
            $this->_book_repository->insert_book_rate(
                $book_id, $user_id, BOOK_STATUS_WANT_TO_READ
            );
        }

        if (!empty($rate_data)) {
            $this->_book_repository->update_book_rate($book_id, $user_id, $rate_data);
        }

        return $this->_book_repository->find_by_id_with_rate($book_id, $user_id);
    }

    public function delete_book_review(
        int $user_id,
        int $book_id,
        string $role = USER_ROLE_USER
    ): array {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $this->assert_book_visible($book, $user_id, $role);

        $existing_rate = $this->_book_repository->find_book_rate($book_id, $user_id);

        if ($existing_rate === null || trim((string) ($existing_rate['rate_review'] ?? '')) === '') {
            throw new RuntimeException('Рецензия не найдена');
        }

        $this->_book_repository->update_book_rate($book_id, $user_id, [
            'rate_review' => null,
        ]);

        return $this->_book_repository->find_by_id_with_rate($book_id, $user_id);
    }

    public function get_book_reviews(int $book_id, int $page, int $per_page, ?int $current_user_id = null): array {
        $book = $this->_book_repository->find_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $items       = $this->_book_repository->find_book_reviews($book_id, $page, $per_page, $current_user_id);
        $total_count = $this->_book_repository->count_book_reviews($book_id);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    // ВНУТРЕННИЕ ХЕЛПЕРЫ  //

    private function assert_book_visible(
        array $book,
        int $user_id,
        string $role = USER_ROLE_USER
    ): void {
        $status   = $book['book_moderation_status'] ?? BOOK_MODERATION_APPROVED;
        $is_owner = ((int) $book['user_id']) === $user_id;
        $is_staff = in_array($role, [USER_ROLE_ADMIN, USER_ROLE_MODERATOR], true);

        if ($status !== BOOK_MODERATION_APPROVED && !$is_owner && !$is_staff) {
            throw new RuntimeException('Произведение не найдено');
        }
    }

    private function assert_library_owned_by_user(int $library_id, int $user_id): void {
        $library = $this->_library_repository->find_by_id($library_id);

        if ($library === null) {
            throw new RuntimeException('Коллекция не найдена');
        }

        if ((int) $library['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав на эту коллекцию');
        }
    }
}
