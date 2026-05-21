<?php
/**
 * СЕРВИС: AdminService — Бизнес-логика администрирования 
 *
 * НАЗНАЧЕНИЕ:
 * Админ-панель: управление пользователями, модерация произведений и изданий,
 * слияние дубликатов, статистика. Проверка прав, валидация бизнес-правил.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/admin_repository.php';
require_once __DIR__ . '/../repositories/book_repository.php';
require_once __DIR__ . '/../repositories/edition_repository.php';
require_once __DIR__ . '/../repositories/user_repository.php';
require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/../core/file_uploader.php';
require_once __DIR__ . '/../core/pagination_helper.php';

//  2. КЛАСС AdminService  //

class AdminService {

    private AdminRepository $_admin_repository;

    private BookRepository $_book_repository;

    private EditionRepository $_edition_repository;

    public function __construct() {
        $this->_admin_repository   = new AdminRepository();
        $this->_book_repository    = new BookRepository();
        $this->_edition_repository = new EditionRepository();
    }

    //  СТАТИСТИКА  //

    public function get_statistics(): array {
        return [
            'total_users'         => $this->_admin_repository->count_users(),
            'total_books'         => $this->_admin_repository->count_books(),
            'pending_books'       => $this->_admin_repository->count_books_by_moderation(BOOK_MODERATION_PENDING),
            'approved_books'      => $this->_admin_repository->count_books_by_moderation(BOOK_MODERATION_APPROVED),
            'rejected_books'      => $this->_admin_repository->count_books_by_moderation(BOOK_MODERATION_REJECTED),
            'pending_editions'    => $this->_admin_repository->count_editions_by_moderation(EDITION_MODERATION_PENDING),
            'approved_editions'   => $this->_admin_repository->count_editions_by_moderation(EDITION_MODERATION_APPROVED),
            'rejected_editions'   => $this->_admin_repository->count_editions_by_moderation(EDITION_MODERATION_REJECTED),
            'total_publications'  => $this->_admin_repository->count_publications(),
            'total_sessions'      => $this->_admin_repository->count_reading_sessions(),
            'total_clubs'         => $this->_admin_repository->count_clubs(),
        ];
    }

    public function get_recent_activity(int $limit = ADMIN_RECENT_ACTIVITY_DEFAULT_LIMIT): array {
        $limit = max(ADMIN_RECENT_ACTIVITY_MIN_LIMIT, min($limit, ADMIN_RECENT_ACTIVITY_MAX_LIMIT));
        return $this->_admin_repository->find_recent_activity($limit);
    }

    //  ПОЛЬЗОВАТЕЛИ  //

    public function get_users(?string $query, array $filters, int $page, int $per_page): array {
        $items = $this->_admin_repository->find_users($query, $filters, $page, $per_page);
        $total_count = $this->_admin_repository->count_users_filtered($query, $filters);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function get_user(int $user_id): array {
        $user = $this->_admin_repository->find_user_by_id($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        return $user;
    }

    public function update_user_role(int $admin_id, int $user_id, string $new_role): array {
        if ($admin_id === $user_id) {
            throw new RuntimeException('Нельзя изменить собственную роль');
        }

        if (!in_array($new_role, USER_ROLES, true)) {
            throw new RuntimeException('Недопустимая роль');
        }

        $user = $this->_admin_repository->find_user_by_id($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if ($user['user_role'] === USER_ROLE_ADMIN && $new_role !== USER_ROLE_ADMIN) {
            $admin_count = $this->_admin_repository->count_admins();
            if ($admin_count <= 1) {
                throw new RuntimeException('Нельзя снять роль последнего администратора');
            }
        }

        $this->_admin_repository->update_user_role($user_id, $new_role);

        return $this->_admin_repository->find_user_by_id($user_id);
    }

    public function block_user(int $admin_id, int $user_id, ?string $reason = null): array {
        if ($admin_id === $user_id) {
            throw new RuntimeException('Нельзя заблокировать самого себя');
        }

        $user = $this->_admin_repository->find_user_by_id($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if ($user['user_role'] === USER_ROLE_ADMIN) {
            throw new RuntimeException('Нельзя заблокировать администратора');
        }

        $this->_admin_repository->update_user_blocked($user_id, true, $reason);

        return $this->_admin_repository->find_user_by_id($user_id);
    }

    public function update_user_by_admin(int $user_id, array $data): array {
        $user = $this->_admin_repository->find_user_by_id($user_id);
        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        // Уникальность email
        if (isset($data['user_email']) && $data['user_email'] !== $user['user_email']) {
            $user_repository = new UserRepository();
            if ($user_repository->exists_by_email($data['user_email'])) {
                throw new RuntimeException('Email уже используется');
            }
        }

        // Уникальность profile_identifier
        if (isset($data['user_profile_identifier'])
            && $data['user_profile_identifier'] !== ($user['user_profile_identifier'] ?? null)
            && $data['user_profile_identifier'] !== null
            && $data['user_profile_identifier'] !== ''
        ) {
            $user_repository = new UserRepository();
            if ($user_repository->exists_by_profile_identifier($data['user_profile_identifier'])) {
                throw new RuntimeException('Идентификатор уже используется');
            }
        }

        $this->_admin_repository->update_user_profile_by_admin($user_id, $data);
        return $this->_admin_repository->find_user_by_id($user_id);
    }

    public function upload_user_avatar(int $user_id, array $file): array {
        $user = $this->_admin_repository->find_user_by_id($user_id);
        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        $validation_errors = validate_uploaded_image($file);
        if (!empty($validation_errors)) {
            throw new RuntimeException(reset($validation_errors));
        }

        if (!empty($user['user_avatar_path'])) {
            delete_uploaded_file($user['user_avatar_path']);
        }

        $avatar_url = save_uploaded_image($file, AVATARS_PATH, AVATARS_URL);
        $this->_admin_repository->update_user_avatar_path($user_id, $avatar_url);

        return $this->_admin_repository->find_user_by_id($user_id);
    }

    public function remove_user_avatar(int $user_id): array {
        $user = $this->_admin_repository->find_user_by_id($user_id);
        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if (!empty($user['user_avatar_path'])) {
            delete_uploaded_file($user['user_avatar_path']);
        }

        $this->_admin_repository->update_user_avatar_path($user_id, null);
        return $this->_admin_repository->find_user_by_id($user_id);
    }

    public function unblock_user(int $user_id): array {
        $user = $this->_admin_repository->find_user_by_id($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if (empty($user['is_blocked'])) {
            throw new RuntimeException('Пользователь не заблокирован');
        }

        $this->_admin_repository->update_user_blocked($user_id, false);

        return $this->_admin_repository->find_user_by_id($user_id);
    }

    public function delete_user(int $admin_id, int $user_id): void {
        if ($admin_id === $user_id) {
            throw new RuntimeException('Нельзя удалить самого себя');
        }

        $user = $this->_admin_repository->find_user_by_id($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if ($user['user_role'] === USER_ROLE_ADMIN) {
            throw new RuntimeException('Нельзя удалить администратора');
        }

        if (!empty($user['user_avatar_path'])) {
            delete_uploaded_file($user['user_avatar_path']);
        }

        $this->_admin_repository->delete_user($user_id);
    }

    //  МОДЕРАЦИЯ ПРОИЗВЕДЕНИЙ  //

    public function get_pending_books(int $page, int $per_page): array {
        $items = $this->_admin_repository->find_books_for_moderation(
            BOOK_MODERATION_PENDING, $page, $per_page
        );
        $total_count = $this->_admin_repository->count_books_for_moderation(BOOK_MODERATION_PENDING);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function get_all_books(?string $query, array $filters, int $page, int $per_page): array {
        $items = $this->_admin_repository->find_all_books($query, $filters, $page, $per_page);
        $total_count = $this->_admin_repository->count_all_books($query, $filters);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function get_book(int $book_id): array {
        $book = $this->_admin_repository->find_book_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        return $book;
    }

    public function approve_book(int $book_id): array {
        $book = $this->_admin_repository->find_book_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        if ($book['book_moderation_status'] === BOOK_MODERATION_APPROVED) {
            throw new RuntimeException('Произведение уже одобрено');
        }

        $this->_admin_repository->update_book_moderation_status(
            $book_id, BOOK_MODERATION_APPROVED
        );

        return $this->_admin_repository->find_book_by_id($book_id);
    }

    public function reject_book(int $book_id): array {
        $book = $this->_admin_repository->find_book_by_id($book_id);

        if ($book === null) {
            throw new RuntimeException('Произведение не найдено');
        }

        $this->_admin_repository->update_book_moderation_status(
            $book_id, BOOK_MODERATION_REJECTED
        );

        return $this->_admin_repository->find_book_by_id($book_id);
    }

    public function merge_book(int $source_book_id, int $target_book_id): array {
        if ($source_book_id === $target_book_id) {
            throw new RuntimeException('Нельзя объединить произведение с самим собой');
        }

        $source = $this->_admin_repository->find_book_by_id($source_book_id);
        $target = $this->_admin_repository->find_book_by_id($target_book_id);

        if ($source === null) {
            throw new RuntimeException('Произведение-дубликат не найдено');
        }

        if ($target === null) {
            throw new RuntimeException('Произведение-оригинал не найдено');
        }

        if ($source['book_merged_to_id'] !== null) {
            throw new RuntimeException('Произведение уже было объединено');
        }

        if ($target['book_merged_to_id'] !== null) {
            throw new RuntimeException('Произведение-оригинал само является дубликатом');
        }

        $this->_book_repository->merge_book_into_master($source_book_id, $target_book_id);

        return [
            'source_book_id' => $source_book_id,
            'target_book_id' => $target_book_id,
        ];
    }

    public function search_books_for_merge(string $query, int $exclude): array {
        return $this->_admin_repository->search_books_for_merge($query, $exclude, ADMIN_MERGE_SEARCH_LIMIT);
    }

    public function list_duplicates(int $page, int $per_page): array {
        $rows = $this->_admin_repository->find_duplicate_book_rows($page, $per_page);
        $total_count = $this->_admin_repository->count_duplicate_book_groups();
        $groups = [];

        foreach ($rows as $row) {
            $key = $row['book_title_key'];
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'group_id'        => hash('sha256', $key),
                    'book_title_key'  => $key,
                    'book_title'      => $row['book_title'],
                    'duplicate_count' => (int) $row['duplicate_count'],
                    'first_created'   => $row['first_created'],
                    'candidates'      => [],
                ];
            }

            $groups[$key]['candidates'][] = [
                'id'                     => (int) $row['id'],
                'user_id'                => (int) $row['user_id'],
                'book_title'             => $row['book_title'],
                'book_author'            => $row['book_author'],
                'book_genre'             => $row['book_genre'],
                'book_year_published'    => $row['book_year_published'],
                'book_original_language' => $row['book_original_language'],
                'book_moderation_status' => $row['book_moderation_status'],
                'edition_count'          => (int) $row['edition_count'],
                'user_email'             => $row['user_email'],
                'user_name_first'        => $row['user_name_first'],
                'user_name_last'         => $row['user_name_last'],
                'time_created'           => $row['time_created'],
            ];
        }

        return build_pagination_payload(array_values($groups), $total_count, $page, $per_page);
    }

    // МОДЕРАЦИЯ ИЗДАНИЙ  //

    public function get_pending_editions(int $page, int $per_page): array {
        $items = $this->_admin_repository->find_editions_for_moderation(
            EDITION_MODERATION_PENDING, $page, $per_page
        );
        $total_count = $this->_admin_repository->count_editions_for_moderation(EDITION_MODERATION_PENDING);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function get_all_editions(?string $query, array $filters, int $page, int $per_page): array {
        $items = $this->_admin_repository->find_all_editions($query, $filters, $page, $per_page);
        $total_count = $this->_admin_repository->count_all_editions($query, $filters);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function get_edition(int $edition_id): array {
        $edition = $this->_admin_repository->find_edition_by_id_for_admin($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        return $edition;
    }

    public function approve_edition(int $edition_id): array {
        $edition = $this->_admin_repository->find_edition_by_id_for_admin($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        if ($edition['edition_moderation_status'] === EDITION_MODERATION_APPROVED) {
            throw new RuntimeException('Издание уже одобрено');
        }

        if ($edition['book_moderation_status'] !== BOOK_MODERATION_APPROVED) {
            throw new RuntimeException(
                'Сначала одобрите родительское произведение'
            );
        }

        $this->_edition_repository->update_edition_moderation_status(
            $edition_id, EDITION_MODERATION_APPROVED
        );

        return $this->_admin_repository->find_edition_by_id_for_admin($edition_id);
    }

    public function reject_edition(int $edition_id): array {
        $edition = $this->_admin_repository->find_edition_by_id_for_admin($edition_id);

        if ($edition === null) {
            throw new RuntimeException('Издание не найдено');
        }

        $this->_edition_repository->update_edition_moderation_status(
            $edition_id, EDITION_MODERATION_REJECTED
        );

        return $this->_admin_repository->find_edition_by_id_for_admin($edition_id);
    }
}
