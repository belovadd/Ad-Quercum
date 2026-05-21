<?php
/**
 * СЕРВИС: LibraryService — Бизнес-логика коллекций и полки 
 *
 * НАЗНАЧЕНИЕ:
 * Высокоуровневые операции с пользовательскими коллекциями (`libraries`)
 * и связями «коллекция ↔ конкретное издание». Поиск по всей полке
 * пользователя.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ //

require_once __DIR__ . '/../repositories/library_repository.php';
require_once __DIR__ . '/../repositories/edition_repository.php';
require_once __DIR__ . '/../repositories/user_repository.php';
require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/../core/pagination_helper.php';

//  2. КЛАСС LibraryService  //

class LibraryService {

    private LibraryRepository $_library_repository;
    private EditionRepository $_edition_repository;
    private UserRepository $_user_repository;

    public function __construct() {
        $this->_library_repository = new LibraryRepository();
        $this->_edition_repository = new EditionRepository();
        $this->_user_repository = new UserRepository();
    }

    // КОЛЛЕКЦИИ: CRUD  //

    public function create_library(int $user_id, array $data): array {
        $count = $this->_library_repository->count_user_libraries($user_id);

        if ($count >= MAX_LIBRARIES_PER_USER) {
            throw new RuntimeException(
                'Превышен лимит коллекций (' . MAX_LIBRARIES_PER_USER . ')'
            );
        }

        $library_id = $this->_library_repository->insert_library($user_id, $data);

        return $this->_library_repository->find_by_id($library_id);
    }

    public function get_user_libraries(int $user_id): array {
        return $this->_library_repository->find_user_libraries($user_id);
    }

    public function get_public_libraries(int $user_id): array {
        $this->assert_public_collections_visible($user_id);
        return $this->_library_repository->find_public_libraries_by_user($user_id);
    }

    public function get_library(int $user_id, int $library_id, int $page, int $per_page): array {
        $library = $this->_library_repository->find_by_id($library_id);

        if ($library === null) {
            throw new RuntimeException('Коллекция не найдена');
        }

        $is_owner = ((int) $library['user_id']) === $user_id;

        if (!$is_owner) {
            $this->assert_public_collections_visible((int) $library['user_id']);

            if ((int) $library['is_private'] === 1) {
                throw new RuntimeException('Нет доступа к этой коллекции');
            }
        }

        $items = $this->_library_repository->find_library_books(
            $library_id, $is_owner ? $user_id : (int) $library['user_id'], $page, $per_page
        );
        $total_count = $this->_library_repository->count_library_books($library_id);

        // Фильтр видимости pending: гость публичной коллекции НЕ должен
        // видеть pending-издания владельца профиля (§8 BOOKS_AND_EDITIONS).
        // Свою же коллекцию владелец видит полностью.
        // Note: total_count и пагинация остаются «сырыми» по библиотеке —
        // показывает реальный размер. Если pending много, страница может
        // выглядеть пустее, но это допустимая компромисс; сложный фильтр
        // с пагинацией на уровне SQL — задача отдельной итерации.
        if (!$is_owner) {
            $items = array_values(array_filter(
                $items,
                static fn(array $row): bool => $row['edition_moderation_status']
                    === EDITION_MODERATION_APPROVED
            ));
        }

        $library['is_owner'] = $is_owner;
        $library['books'] = build_pagination_payload($items, $total_count, $page, $per_page, true);

        return $library;
    }

    public function update_library(int $user_id, int $library_id, array $data): array {
        $library = $this->_library_repository->find_by_id($library_id);

        if ($library === null) {
            throw new RuntimeException('Коллекция не найдена');
        }

        if ((int) $library['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для редактирования этой коллекции');
        }

        $this->_library_repository->update_library($library_id, $data);

        return $this->_library_repository->find_by_id($library_id);
    }

    public function delete_library(int $user_id, int $library_id): void {
        $library = $this->_library_repository->find_by_id($library_id);

        if ($library === null) {
            throw new RuntimeException('Коллекция не найдена');
        }

        if ((int) $library['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для удаления этой коллекции');
        }

        $this->_library_repository->ensure_library_books_from_collection($library_id, $user_id);
        $this->_library_repository->delete_library($library_id);
    }

    //  ИЗДАНИЯ В КОЛЛЕКЦИЯХ  //

    public function add_edition_to_shelf(int $user_id, int $edition_id): void {
        $this->assert_edition_visible_for_shelf($user_id, $edition_id);
        $this->_library_repository->ensure_library_book_on_shelf($user_id, $edition_id);
    }

    public function get_edition_collections(int $user_id, int $edition_id): array {
        $this->assert_edition_visible_for_shelf($user_id, $edition_id);
        return $this->_library_repository->find_user_libraries_with_edition_flag($user_id, $edition_id);
    }

    public function add_edition_to_library(int $user_id, int $library_id, int $edition_id): array {
        $library = $this->_library_repository->find_by_id($library_id);

        if ($library === null) {
            throw new RuntimeException('Коллекция не найдена');
        }

        if ((int) $library['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для изменения этой коллекции');
        }

        $this->assert_edition_visible_for_shelf($user_id, $edition_id);

        if ($this->_library_repository->exists_library_book($library_id, $edition_id, $user_id)) {
            throw new RuntimeException('Издание уже добавлено в эту коллекцию');
        }

        $this->_library_repository->insert_collection_book($library_id, $edition_id, $user_id);

        return $this->_library_repository->find_by_id($library_id);
    }

    public function remove_edition_from_library(int $user_id, int $library_id, int $edition_id): void {
        $library = $this->_library_repository->find_by_id($library_id);

        if ($library === null) {
            throw new RuntimeException('Коллекция не найдена');
        }

        if ((int) $library['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для изменения этой коллекции');
        }

        if (!$this->_library_repository->exists_library_book($library_id, $edition_id, $user_id)) {
            return;
        }

        $this->_library_repository->ensure_library_book_on_shelf($user_id, $edition_id);
        $this->_library_repository->delete_library_book($library_id, $edition_id);
    }

    public function remove_edition_from_shelf(int $user_id, int $edition_id): void {
        $deleted_count = $this->_library_repository->delete_user_edition_from_shelf(
            $user_id,
            $edition_id
        );

        if ($deleted_count === 0) {
            throw new RuntimeException('Издание не найдено на полке');
        }
    }

    private function assert_edition_visible_for_shelf(int $user_id, int $edition_id): void {
        $edition = $this->_edition_repository->find_edition_by_id($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        $is_owner_of_edition = ((int) $edition['user_id']) === $user_id;
        $is_approved = $edition['edition_moderation_status'] === EDITION_MODERATION_APPROVED;

        if (!$is_owner_of_edition && !$is_approved) {
            throw new RuntimeException('Это издание недоступно для добавления');
        }
    }

    // ПОИСК ПО ПОЛКЕ ПОЛЬЗОВАТЕЛЯ //

    public function search_user_library(
        int $user_id,
        ?string $query,
        array $filters,
        int $page,
        int $per_page
    ): array {
        $items = $this->_library_repository->search_user_library(
            $user_id, $query, $filters, $page, $per_page
        );
        $total_count = $this->_library_repository->count_user_library($user_id, $query, $filters);
        $genres    = $this->_library_repository->find_user_library_genres($user_id);
        $languages = $this->_library_repository->find_user_library_languages($user_id);

        return array_merge(build_pagination_payload($items, $total_count, $page, $per_page), [
            'genres'      => $genres,
            'languages'   => $languages,
        ]);
    }

    public function search_public_user_library(
        int $target_user_id,
        ?string $query,
        array $filters,
        int $page,
        int $per_page
    ): array {
        $this->assert_public_library_visible($target_user_id);

        $items = $this->_library_repository->search_public_user_library(
            $target_user_id, $query, $filters, $page, $per_page
        );
        $total_count = $this->_library_repository->count_public_user_library(
            $target_user_id, $query, $filters
        );
        $genres = $this->_library_repository->find_public_user_library_genres($target_user_id);
        $languages = $this->_library_repository->find_public_user_library_languages($target_user_id);

        return array_merge(build_pagination_payload($items, $total_count, $page, $per_page), [
            'genres'      => $genres,
            'languages'   => $languages,
        ]);
    }

    public function search_catalog(
        int $user_id,
        ?string $query,
        array $filters,
        int $page,
        int $per_page
    ): array {
        $items = $this->_library_repository->search_catalog(
            $user_id, $query, $filters, $page, $per_page
        );
        $total_count = $this->_library_repository->count_catalog($user_id, $query, $filters);
        $genres = $this->_library_repository->find_catalog_genres($user_id);
        $languages = $this->_library_repository->find_catalog_languages($user_id);

        return array_merge(build_pagination_payload($items, $total_count, $page, $per_page), [
            'genres'      => $genres,
            'languages'   => $languages,
        ]);
    }

    private function assert_public_library_visible(int $target_user_id): void {
        $user = $this->_user_repository->find_by_id($target_user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if (!empty($user['is_profile_hidden'])) {
            throw new RuntimeException('Профиль скрыт');
        }

        if (!empty($user['is_library_hidden'])) {
            throw new RuntimeException('Библиотека скрыта');
        }
    }

    private function assert_public_collections_visible(int $target_user_id): void {
        $user = $this->_user_repository->find_by_id($target_user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if (!empty($user['is_profile_hidden'])) {
            throw new RuntimeException('Профиль скрыт');
        }

        if (!empty($user['is_collections_hidden'])) {
            throw new RuntimeException('Коллекции скрыты');
        }
    }
}
