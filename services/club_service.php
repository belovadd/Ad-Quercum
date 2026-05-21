<?php
/**
 * СЕРВИС: ClubService — Бизнес-логика работы с клубами 
 *
 * НАЗНАЧЕНИЕ:
 * CRUD клубов, управление участниками, проверка прав доступа,
 * загрузка изображений. Не работает с HTTP напрямую.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/club_repository.php';
require_once __DIR__ . '/../repositories/club_publication_repository.php';
require_once __DIR__ . '/../repositories/user_repository.php';
require_once __DIR__ . '/../repositories/book_repository.php';
require_once __DIR__ . '/../repositories/library_repository.php';
require_once __DIR__ . '/../core/file_uploader.php';
require_once __DIR__ . '/../core/pagination_helper.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС ClubService  //

class ClubService {

    private ClubRepository $_club_repository;
    private ClubPublicationRepository $_club_publication_repository;

    private UserRepository $_user_repository;

    private BookRepository $_book_repository;

    private LibraryRepository $_library_repository;

    public function __construct() {
        $this->_club_repository = new ClubRepository();
        $this->_club_publication_repository = new ClubPublicationRepository();
        $this->_user_repository = new UserRepository();
        $this->_book_repository = new BookRepository();
        $this->_library_repository = new LibraryRepository();
    }

    //  CRUD  //

    public function create_club(int $user_id, string $name, ?string $description, bool $is_public): array {
        $count = $this->_club_repository->count_clubs_by_user($user_id);

        if ($count >= MAX_CLUBS_PER_USER) {
            throw new RuntimeException('Превышен лимит клубов (' . MAX_CLUBS_PER_USER . ')');
        }

        $club_id = $this->_club_repository->insert_club($user_id, $name, $description, null, $is_public);

        // Создатель добавляется как участник с ролью creator
        $this->_club_repository->insert_member($club_id, $user_id, CLUB_ROLE_CREATOR);

        $club = $this->_club_repository->find_club_by_id($club_id);
        $club['current_user_role'] = CLUB_ROLE_CREATOR;
        $club['member_count'] = 1;

        return $club;
    }

    public function get_club(int $club_id, int $user_id): array {
        $club = $this->find_club_or_fail($club_id);

        $member = $this->_club_repository->find_member($club_id, $user_id);
        $current_user_role = $member !== null ? $member['member_role'] : null;

        // Приватный клуб доступен только участникам
        if ((int) $club['is_public'] === 0 && $current_user_role === null) {
            throw new RuntimeException('Нет доступа к этому клубу');
        }

        $club['current_user_role'] = $current_user_role;
        $club['member_count'] = $this->_club_repository->count_members($club_id);
        $join_request = $current_user_role === null
            ? $this->_club_repository->find_join_request($club_id, $user_id)
            : null;
        $club['join_request_status'] = $join_request['request_status'] ?? null;
        $club['pending_join_requests_count'] = $this->can_moderate_club_content($club_id, $user_id)
            ? $this->_club_repository->count_pending_join_requests_by_club($club_id)
            : 0;

        return $club;
    }

    public function update_club(int $club_id, int $user_id, array $data): array {
        $club = $this->find_club_or_fail($club_id);
        $member = $this->_club_repository->find_member($club_id, $user_id);

        if ($member === null) {
            throw new RuntimeException('Нет прав для редактирования клуба');
        }

        $role = $member['member_role'];

        if ($role === CLUB_ROLE_MODERATOR) {
            $forbidden_fields = array_intersect(array_keys($data), ['club_name', 'is_public']);

            if (!empty($forbidden_fields)) {
                throw new RuntimeException('Модератор может изменять только описание клуба');
            }

            $data = array_intersect_key($data, array_flip(['club_description']));
        } elseif ($role !== CLUB_ROLE_CREATOR) {
            throw new RuntimeException('Нет прав для редактирования клуба');
        }

        if (empty($data)) {
            throw new RuntimeException('Нет данных для обновления');
        }

        $this->_club_repository->update_club($club_id, $data);

        $club = $this->_club_repository->find_club_by_id($club_id);
        $club['current_user_role'] = $role;
        $club['member_count'] = $this->_club_repository->count_members($club_id);

        return $club;
    }

    public function delete_club(int $club_id, int $user_id): void {
        $club = $this->require_creator($club_id, $user_id);

        // Удаление изображения
        if (!empty($club['club_image_path'])) {
            delete_uploaded_file($club['club_image_path']);
        }

        $this->_club_repository->delete_club($club_id);
    }

    public function upload_club_image(int $club_id, int $user_id, array $file): array {
        $this->require_club_moderator($club_id, $user_id);
        $club = $this->find_club_or_fail($club_id);

        // Валидация файла
        $validation_errors = validate_uploaded_image($file);

        if (!empty($validation_errors)) {
            throw new RuntimeException(reset($validation_errors));
        }

        // Удаление старого изображения
        if (!empty($club['club_image_path'])) {
            delete_uploaded_file($club['club_image_path']);
        }

        // Сохранение нового
        $image_url = save_uploaded_image($file, CLUB_IMAGES_PATH, CLUB_IMAGES_URL);

        // Обновление в БД
        $this->_club_repository->update_club($club_id, ['club_image_path' => $image_url]);

        $updated_club = $this->_club_repository->find_club_by_id($club_id);
        $updated_member = $this->_club_repository->find_member($club_id, $user_id);
        $updated_club['current_user_role'] = $updated_member['member_role'] ?? null;
        $updated_club['member_count'] = $this->_club_repository->count_members($club_id);

        return $updated_club;
    }

    //  УЧАСТНИКИ  //

    public function join_club(int $club_id, int $user_id): void {
        $club = $this->find_club_or_fail($club_id);

        if ((int) $club['is_public'] === 0) {
            throw new RuntimeException('В приватный клуб можно попасть только по заявке');
        }

        $existing = $this->_club_repository->find_member($club_id, $user_id);

        if ($existing !== null) {
            throw new RuntimeException('Вы уже являетесь участником этого клуба');
        }

        $member_count = $this->_club_repository->count_members($club_id);

        if ($member_count >= MAX_MEMBERS_PER_CLUB) {
            throw new RuntimeException('Клуб достиг максимального количества участников');
        }

        $this->_club_repository->insert_member($club_id, $user_id, CLUB_ROLE_MEMBER);
    }

    public function request_join_club(int $club_id, int $user_id): array {
        $club = $this->find_club_or_fail($club_id);

        if ((int) $club['is_public'] === 1) {
            throw new RuntimeException('В публичный клуб можно вступить без заявки');
        }

        $existing_member = $this->_club_repository->find_member($club_id, $user_id);

        if ($existing_member !== null) {
            throw new RuntimeException('Вы уже являетесь участником этого клуба');
        }

        $member_count = $this->_club_repository->count_members($club_id);

        if ($member_count >= MAX_MEMBERS_PER_CLUB) {
            throw new RuntimeException('Клуб достиг максимального количества участников');
        }

        $existing_request = $this->_club_repository->find_join_request($club_id, $user_id);

        if ($existing_request !== null
            && $existing_request['request_status'] === CLUB_JOIN_REQUEST_PENDING
        ) {
            throw new RuntimeException('Заявка уже отправлена');
        }

        $request_id = $this->_club_repository->upsert_join_request(
            $club_id,
            $user_id,
            CLUB_JOIN_REQUEST_PENDING
        );

        return $this->_club_repository->find_join_request_by_id($request_id);
    }

    public function leave_club(int $club_id, int $user_id): void {
        $member = $this->require_member($club_id, $user_id);

        if ($member['member_role'] === CLUB_ROLE_CREATOR) {
            throw new RuntimeException('Создатель не может покинуть клуб. Удалите клуб');
        }

        $this->_club_repository->delete_member($club_id, $user_id);
    }

    public function remove_member(int $club_id, int $target_user_id, int $actor_id): void {
        $this->find_club_or_fail($club_id);

        $actor_member = $this->_club_repository->find_member($club_id, $actor_id);

        if ($actor_member === null) {
            throw new RuntimeException('Вы не являетесь участником клуба');
        }

        $actor_role = $actor_member['member_role'];

        if ($actor_role !== CLUB_ROLE_CREATOR && $actor_role !== CLUB_ROLE_MODERATOR) {
            throw new RuntimeException('Нет прав для исключения участников');
        }

        if ($target_user_id === $actor_id) {
            throw new RuntimeException('Нельзя исключить самого себя');
        }

        $target_member = $this->_club_repository->find_member($club_id, $target_user_id);

        if ($target_member === null) {
            throw new RuntimeException('Пользователь не является участником клуба');
        }

        $target_role = $target_member['member_role'];

        // Модератор может кикнуть только member.
        if ($actor_role === CLUB_ROLE_MODERATOR && $target_role !== CLUB_ROLE_MEMBER) {
            throw new RuntimeException('Вы можете исключать только обычных участников');
        }

        $this->_club_repository->delete_member($club_id, $target_user_id);
    }

    public function change_member_role(int $club_id, int $target_user_id, string $new_role, int $actor_id): void {
        $this->require_creator($club_id, $actor_id);

        if ($target_user_id === $actor_id) {
            throw new RuntimeException('Нельзя менять роль самому себе');
        }

        if ($new_role === CLUB_ROLE_CREATOR) {
            throw new RuntimeException('Невозможно назначить роль создателя');
        }

        $target_member = $this->_club_repository->find_member($club_id, $target_user_id);

        if ($target_member === null) {
            throw new RuntimeException('Пользователь не является участником клуба');
        }

        $this->_club_repository->update_member_role($club_id, $target_user_id, $new_role);
    }

    //  СПИСКИ  //

    public function get_members(int $club_id, int $user_id, int $page, int $per_page): array {
        $club = $this->find_club_or_fail($club_id);

        // Приватный клуб — только участники могут видеть список
        if ((int) $club['is_public'] === 0) {
            $member = $this->_club_repository->find_member($club_id, $user_id);

            if ($member === null) {
                throw new RuntimeException('Нет доступа к этому клубу');
            }
        }

        $items = $this->_club_repository->find_members($club_id, $page, $per_page);
        $total_count = $this->_club_repository->count_members($club_id);

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    public function get_user_clubs(int $user_id, int $page, int $per_page): array {
        $items = $this->_club_repository->find_clubs_by_user($user_id, $page, $per_page);
        $total_count = $this->_club_repository->count_clubs_by_user($user_id);

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    public function get_catalog_clubs(int $user_id, string $filter, ?string $query, int $page, int $per_page): array {
        if (!in_array($filter, CLUB_CATALOG_FILTERS, true)) {
            throw new RuntimeException('Некорректный фильтр клубов');
        }

        $normalized_query = $query !== null ? trim($query) : null;
        if ($normalized_query === '') {
            $normalized_query = null;
        }

        $items = $this->_club_repository->find_catalog_clubs_for_user(
            $user_id,
            $filter,
            $normalized_query,
            $page,
            $per_page
        );
        $total_count = $this->_club_repository->count_catalog_clubs_for_user(
            $user_id,
            $filter,
            $normalized_query
        );

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    public function search_clubs(string $query, int $user_id, int $page, int $per_page): array {
        $items = $this->_club_repository->search_clubs_for_user($query, $user_id, $page, $per_page);
        $total_count = $this->_club_repository->count_search_results($query);

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    public function get_join_requests(int $club_id, int $user_id): array {
        $this->require_club_moderator($club_id, $user_id);

        return $this->_club_repository->find_pending_join_requests_by_club($club_id);
    }

    public function get_user_join_requests(int $user_id): array {
        return $this->_club_repository->find_pending_join_requests_by_user($user_id);
    }

    public function accept_join_request(int $request_id, int $actor_id): void {
        $request = $this->find_join_request_or_fail($request_id);
        $club_id = (int) $request['club_id'];
        $user_id = (int) $request['user_id'];

        $this->require_club_moderator($club_id, $actor_id);

        if ($request['request_status'] !== CLUB_JOIN_REQUEST_PENDING) {
            throw new RuntimeException('Заявка уже обработана');
        }

        if ($this->_club_repository->find_member($club_id, $user_id) !== null) {
            $this->_club_repository->update_join_request_status($request_id, CLUB_JOIN_REQUEST_ACCEPTED);
            throw new RuntimeException('Пользователь уже состоит в клубе');
        }

        $member_count = $this->_club_repository->count_members($club_id);

        if ($member_count >= MAX_MEMBERS_PER_CLUB) {
            throw new RuntimeException('Клуб достиг максимального количества участников');
        }

        $this->_club_repository->insert_member($club_id, $user_id, CLUB_ROLE_MEMBER);
        $this->_club_repository->update_join_request_status($request_id, CLUB_JOIN_REQUEST_ACCEPTED);
    }

    public function reject_join_request(int $request_id, int $actor_id): void {
        $request = $this->find_join_request_or_fail($request_id);

        $this->require_club_moderator((int) $request['club_id'], $actor_id);

        if ($request['request_status'] !== CLUB_JOIN_REQUEST_PENDING) {
            throw new RuntimeException('Заявка уже обработана');
        }

        $this->_club_repository->update_join_request_status($request_id, CLUB_JOIN_REQUEST_REJECTED);
    }

    public function cancel_join_request(int $request_id, int $user_id): void {
        $request = $this->find_join_request_or_fail($request_id);

        if ((int) $request['user_id'] !== $user_id) {
            throw new RuntimeException('Нет прав для отмены этой заявки');
        }

        if ($request['request_status'] !== CLUB_JOIN_REQUEST_PENDING) {
            throw new RuntimeException('Заявка уже обработана');
        }

        $this->_club_repository->update_join_request_status($request_id, CLUB_JOIN_REQUEST_REJECTED);
    }

    //  КЛУБНЫЕ ПУБЛИКАЦИИ  //

    public function create_club_publication(int $user_id, int $club_id, string $text, ?int $book_id = null): array {
        $this->require_member($club_id, $user_id);

        // Проверка привязанной книги
        if ($book_id !== null) {
            $book = $this->_book_repository->find_by_id($book_id);

            if ($book === null) {
                throw new RuntimeException('Книга не найдена');
            }

            if (!$this->_library_repository->has_user_book($user_id, $book_id)) {
                throw new RuntimeException('Можно привязать только книгу со своей полки');
            }
        }

        $publication_id = $this->_club_publication_repository->insert_publication($club_id, $user_id, $text, $book_id);

        return $this->_club_publication_repository->find_publication_by_id($publication_id);
    }

    public function get_club_publications(int $user_id, int $club_id, int $page, int $per_page): array {
        $club = $this->find_club_or_fail($club_id);

        // Приватный клуб — только участники могут видеть публикации
        if ((int) $club['is_public'] === 0) {
            $member = $this->_club_repository->find_member($club_id, $user_id);

            if ($member === null) {
                throw new RuntimeException('Нет доступа к этому клубу');
            }
        }

        $items = $this->_club_publication_repository->find_publications_by_club($club_id, $page, $per_page);
        $total_count = $this->_club_publication_repository->count_publications_by_club($club_id);

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    public function delete_club_publication(int $user_id, int $publication_id): void {
        $publication = $this->_club_publication_repository->find_publication_by_id($publication_id);

        if ($publication === null) {
            throw new RuntimeException('Публикация не найдена');
        }

        if ((int) $publication['user_id'] !== $user_id
            && !$this->can_moderate_club_content((int) $publication['club_id'], $user_id)
        ) {
            throw new RuntimeException('Вы можете удалить только свою публикацию');
        }

        $this->_club_publication_repository->delete_publication($publication_id);
    }

    //  КЛУБНЫЕ КОММЕНТАРИИ  //

    public function create_club_comment(int $user_id, int $publication_id, string $text): array {
        $publication = $this->_club_publication_repository->find_publication_by_id($publication_id);

        if ($publication === null) {
            throw new RuntimeException('Публикация не найдена');
        }

        $club_id = (int) $publication['club_id'];

        // Проверяем, что пользователь — участник клуба
        $this->require_member($club_id, $user_id);

        $comment_id = $this->_club_publication_repository->insert_comment($publication_id, $user_id, $text);

        return $this->_club_publication_repository->find_comment_by_id($comment_id);
    }

    public function get_club_comments(int $publication_id, int $page, int $per_page): array {
        $items = $this->_club_publication_repository->find_comments_by_publication($publication_id, $page, $per_page);
        $total_count = $this->_club_publication_repository->count_comments_by_publication($publication_id);

        return build_pagination_payload($items, $total_count, $page, $per_page, true);
    }

    public function delete_club_comment(int $user_id, int $comment_id): void {
        $comment = $this->_club_publication_repository->find_comment_by_id($comment_id);

        if ($comment === null) {
            throw new RuntimeException('Комментарий не найден');
        }

        if ((int) $comment['user_id'] !== $user_id
            && !$this->can_moderate_club_content((int) $comment['club_id'], $user_id)
        ) {
            throw new RuntimeException('Вы можете удалить только свой комментарий');
        }

        $this->_club_publication_repository->delete_comment($comment_id);
    }

    //  ВНУТРЕННИЕ ХЕЛПЕРЫ  //

    private function find_club_or_fail(int $club_id): array {
        $club = $this->_club_repository->find_club_by_id($club_id);

        if ($club === null) {
            throw new RuntimeException('Клуб не найден');
        }

        return $club;
    }

    private function require_creator(int $club_id, int $user_id): array {
        $club = $this->find_club_or_fail($club_id);

        if ((int) $club['user_id_creator'] !== $user_id) {
            throw new RuntimeException('Только создатель может выполнить это действие');
        }

        return $club;
    }

    private function require_member(int $club_id, int $user_id): array {
        $this->find_club_or_fail($club_id);

        $member = $this->_club_repository->find_member($club_id, $user_id);

        if ($member === null) {
            throw new RuntimeException('Вы не являетесь участником этого клуба');
        }

        return $member;
    }

    private function can_moderate_club_content(int $club_id, int $user_id): bool {
        $member = $this->_club_repository->find_member($club_id, $user_id);

        if ($member === null) {
            return false;
        }

        return $member['member_role'] === CLUB_ROLE_CREATOR
            || $member['member_role'] === CLUB_ROLE_MODERATOR;
    }

    private function require_club_moderator(int $club_id, int $user_id): array {
        $this->find_club_or_fail($club_id);

        $member = $this->_club_repository->find_member($club_id, $user_id);

        if ($member === null
            || ($member['member_role'] !== CLUB_ROLE_CREATOR && $member['member_role'] !== CLUB_ROLE_MODERATOR)
        ) {
            throw new RuntimeException('Нет прав для этого действия');
        }

        return $member;
    }

    private function find_join_request_or_fail(int $request_id): array {
        $request = $this->_club_repository->find_join_request_by_id($request_id);

        if ($request === null) {
            throw new RuntimeException('Заявка не найдена');
        }

        return $request;
    }
}
