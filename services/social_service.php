<?php
/**
 *  СЕРВИС: SocialService — Бизнес-логика публикаций, комментариев и сообщений 
 *
 * НАЗНАЧЕНИЕ:
 * Бизнес-логика создания/удаления публикаций пользователей,
 * создания/удаления комментариев, личных сообщений. Не работает с HTTP напрямую.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ //

require_once __DIR__ . '/../repositories/social_repository.php';
require_once __DIR__ . '/../repositories/book_repository.php';
require_once __DIR__ . '/../repositories/library_repository.php';
require_once __DIR__ . '/../repositories/friend_repository.php';
require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/../core/pagination_helper.php';

//  2. КЛАСС SocialService //

class SocialService {

    private SocialRepository $_social_repository;
    private BookRepository $_book_repository;
    private LibraryRepository $_library_repository;
    private FriendRepository $_friend_repository;

    public function __construct() {
        $this->_social_repository = new SocialRepository();
        $this->_book_repository = new BookRepository();
        $this->_library_repository = new LibraryRepository();
        $this->_friend_repository = new FriendRepository();
    }

    // ПУБЛИКАЦИИ: СОЗДАНИЕ  //

    public function create_publication(int $user_id, string $publication_text, ?int $book_id = null): array {
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

        $publication_id = $this->_social_repository->insert_publication($user_id, $publication_text, $book_id);

        return $this->_social_repository->find_publication_by_id($publication_id);
    }

    //  ПУБЛИКАЦИИ: ПОЛУЧЕНИЕ  //

    public function get_publication(int $publication_id): array {
        $publication = $this->_social_repository->find_publication_by_id($publication_id);

        if ($publication === null) {
            throw new RuntimeException('Публикация не найдена');
        }

        return $publication;
    }

    public function get_user_publications(int $user_id, int $page, int $per_page): array {
        $items = $this->_social_repository->find_publications_by_user($user_id, $page, $per_page);
        $total_count = $this->_social_repository->count_publications_by_user($user_id);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    //  ПУБЛИКАЦИИ: УДАЛЕНИЕ  //

    public function delete_publication(int $user_id, int $publication_id): void {
        $publication = $this->_social_repository->find_publication_by_id($publication_id);

        if ($publication === null) {
            throw new RuntimeException('Публикация не найдена');
        }

        if ((int) $publication['user_id'] !== $user_id) {
            throw new RuntimeException('Вы можете удалить только свою публикацию');
        }

        $this->_social_repository->delete_publication($publication_id);
    }

    // КОММЕНТАРИИ: СОЗДАНИЕ  //

    public function create_comment(int $user_id, int $publication_id, string $comment_text): array {
        $publication = $this->_social_repository->find_publication_by_id($publication_id);

        if ($publication === null) {
            throw new RuntimeException('Публикация не найдена');
        }

        $comment_id = $this->_social_repository->insert_comment($publication_id, $user_id, $comment_text);

        // Возвращаем комментарий — find_comment_by_id без JOIN, поэтому дополним вручную
        $comment = $this->_social_repository->find_comment_by_id($comment_id);

        return $comment;
    }

    //  КОММЕНТАРИИ: ПОЛУЧЕНИЕ  //

    public function get_comments(int $publication_id, int $page, int $per_page): array {
        $items = $this->_social_repository->find_comments_by_publication($publication_id, $page, $per_page);
        $total_count = $this->_social_repository->count_comments_by_publication($publication_id);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    //  КОММЕНТАРИИ: УДАЛЕНИЕ  //

    public function delete_comment(int $user_id, int $comment_id): void {
        $comment = $this->_social_repository->find_comment_by_id($comment_id);

        if ($comment === null) {
            throw new RuntimeException('Комментарий не найден');
        }

        if ((int) $comment['user_id'] !== $user_id) {
            throw new RuntimeException('Вы можете удалить только свой комментарий');
        }

        $this->_social_repository->delete_comment($comment_id);
    }

    //  СООБЩЕНИЯ: ОТПРАВКА  //

    public function send_message(int $user_id, int $receiver_id, string $message_text): array {
        if ($user_id === $receiver_id) {
            throw new RuntimeException('Нельзя отправить сообщение самому себе');
        }

        $has_friendship = $this->_friend_repository->exists_friendship($user_id, $receiver_id);
        $has_conversation = $this->_social_repository->exists_conversation_between_users($user_id, $receiver_id);

        if (!$has_friendship && !$has_conversation) {
            throw new RuntimeException('Начать новую переписку можно только с другом');
        }

        $message_id = $this->_social_repository->insert_message($user_id, $receiver_id, $message_text);

        return $this->_social_repository->find_message_by_id($message_id);
    }

    // СООБЩЕНИЯ: ПОЛУЧЕНИЕ //

    public function get_conversations(int $user_id): array {
        return $this->_social_repository->find_conversations($user_id);
    }

    public function get_messages(int $user_id, int $partner_id, int $page, int $per_page): array {
        $items = $this->_social_repository->find_messages_between_users($user_id, $partner_id, $page, $per_page);
        $total_count = $this->_social_repository->count_messages_between_users($user_id, $partner_id);

        // Автоматическая пометка прочитанных
        $this->_social_repository->update_messages_read($user_id, $partner_id);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function mark_messages_read(int $user_id, int $partner_id): void {
        $this->_social_repository->update_messages_read($user_id, $partner_id);
    }

    public function get_unread_count(int $user_id): int {
        return $this->_social_repository->count_unread_total($user_id);
    }
}
