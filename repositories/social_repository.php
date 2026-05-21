<?php
/**
 *  РЕПОЗИТОРИЙ: SocialRepository — SQL-запросы к публикациям, комментариям и сообщениям 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с персональными публикациями, комментариями и личными сообщениями.
 * Не содержит бизнес-логики — только SQL через PDO Prepared Statements.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС SocialRepository  //

class SocialRepository {

    private PDO $_database;


    public function __construct() {
        $this->_database = get_database_connection();
    }

    //  ПУБЛИКАЦИИ: ВСТАВКА  //

    public function insert_publication(int $user_id, string $publication_text, ?int $book_id = null): int {
        $statement = $this->_database->prepare(
            'INSERT INTO user_publications (user_id, book_id, publication_text)
             VALUES (:user_id, :book_id, :publication_text)'
        );

        $statement->execute([
            'user_id'          => $user_id,
            'book_id'          => $book_id,
            'publication_text' => $publication_text,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    // ПУБЛИКАЦИИ: ПОИСК  //

    public function find_publication_by_id(int $publication_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT up.id, up.user_id, up.book_id, up.publication_text,
                    up.time_created, up.time_updated,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier,
                    b.book_title, b.book_author
             FROM user_publications up
             JOIN users u ON u.id = up.user_id
             LEFT JOIN books b ON b.id = up.book_id
             WHERE up.id = :publication_id'
        );

        $statement->execute(['publication_id' => $publication_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_publications_by_user(int $user_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT up.id, up.user_id, up.book_id, up.publication_text,
                    up.time_created, up.time_updated,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier,
                    b.book_title, b.book_author,
                    (SELECT COUNT(*) FROM user_publication_comments c WHERE c.publication_id = up.id) AS comment_count
             FROM user_publications up
             JOIN users u ON u.id = up.user_id
             LEFT JOIN books b ON b.id = up.book_id
             WHERE up.user_id = :user_id
             ORDER BY up.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('user_id', $user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_publications_by_user(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM user_publications
             WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    // ПУБЛИКАЦИИ: ОБНОВЛЕНИЕ / УДАЛЕНИЕ  //

    public function update_publication(int $publication_id, string $publication_text): bool {
        $statement = $this->_database->prepare(
            'UPDATE user_publications
             SET publication_text = :publication_text
             WHERE id = :publication_id'
        );

        return $statement->execute([
            'publication_id'   => $publication_id,
            'publication_text' => $publication_text,
        ]);
    }

    public function delete_publication(int $publication_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM user_publications WHERE id = :publication_id'
        );

        return $statement->execute(['publication_id' => $publication_id]);
    }

    // КОММЕНТАРИИ: ВСТАВКА  //

    public function insert_comment(int $publication_id, int $user_id, string $comment_text): int {
        $statement = $this->_database->prepare(
            'INSERT INTO user_publication_comments (publication_id, user_id, comment_text)
             VALUES (:publication_id, :user_id, :comment_text)'
        );

        $statement->execute([
            'publication_id' => $publication_id,
            'user_id'        => $user_id,
            'comment_text'   => $comment_text,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  КОММЕНТАРИИ: ПОИСК  //

    public function find_comment_by_id(int $comment_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, publication_id, user_id, comment_text, time_created
             FROM user_publication_comments
             WHERE id = :comment_id'
        );

        $statement->execute(['comment_id' => $comment_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_comments_by_publication(int $publication_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT c.id, c.publication_id, c.user_id, c.comment_text, c.time_created,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier
             FROM user_publication_comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.publication_id = :publication_id
             ORDER BY c.time_created ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('publication_id', $publication_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_comments_by_publication(int $publication_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM user_publication_comments
             WHERE publication_id = :publication_id'
        );

        $statement->execute(['publication_id' => $publication_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    //  КОММЕНТАРИИ: УДАЛЕНИЕ  //

    public function delete_comment(int $comment_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM user_publication_comments WHERE id = :comment_id'
        );

        return $statement->execute(['comment_id' => $comment_id]);
    }

    //  СООБЩЕНИЯ: ВСТАВКА  //

    public function insert_message(int $user_id_sender, int $user_id_receiver, string $message_text): int {
        $statement = $this->_database->prepare(
            'INSERT INTO user_messages (user_id_sender, user_id_receiver, message_text)
             VALUES (:user_id_sender, :user_id_receiver, :message_text)'
        );

        $statement->execute([
            'user_id_sender'   => $user_id_sender,
            'user_id_receiver' => $user_id_receiver,
            'message_text'     => $message_text,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  СООБЩЕНИЯ: ПОИСК  //

    public function find_message_by_id(int $message_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id_sender, user_id_receiver, message_text,
                    is_read, time_created
             FROM user_messages
             WHERE id = :message_id'
        );

        $statement->execute(['message_id' => $message_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_conversations(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT
                conv.partner_id,
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
                ) AS publications_count,
                lm.message_text AS last_message_text,
                lm.user_id_sender AS last_message_sender_id,
                lm.time_created AS last_message_time,
                COALESCE(unread.unread_count, 0) AS unread_count
             FROM (
                 SELECT
                     CASE
                         WHEN user_id_sender = :user_id_1 THEN user_id_receiver
                         ELSE user_id_sender
                     END AS partner_id,
                     MAX(id) AS last_message_id
                 FROM user_messages
                 WHERE user_id_sender = :user_id_2 OR user_id_receiver = :user_id_3
                 GROUP BY partner_id
             ) conv
             JOIN user_messages lm ON lm.id = conv.last_message_id
             JOIN users u ON u.id = conv.partner_id
             LEFT JOIN (
                 SELECT user_id_sender, COUNT(*) AS unread_count
                 FROM user_messages
                 WHERE user_id_receiver = :user_id_4 AND is_read = FALSE
                 GROUP BY user_id_sender
             ) unread ON unread.user_id_sender = conv.partner_id
             ORDER BY lm.time_created DESC'
        );

        $statement->bindValue('user_id_1', $user_id, PDO::PARAM_INT);
        $statement->bindValue('user_id_2', $user_id, PDO::PARAM_INT);
        $statement->bindValue('user_id_3', $user_id, PDO::PARAM_INT);
        $statement->bindValue('user_id_4', $user_id, PDO::PARAM_INT);
        $statement->bindValue('edition_status', EDITION_MODERATION_APPROVED);
        $statement->bindValue('book_status', BOOK_MODERATION_APPROVED);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find_messages_between_users(int $user_id, int $partner_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT id, user_id_sender, user_id_receiver, message_text,
                    is_read, time_created
             FROM user_messages
             WHERE (user_id_sender = :user_id_1 AND user_id_receiver = :partner_id_1)
                OR (user_id_sender = :partner_id_2 AND user_id_receiver = :user_id_2)
             ORDER BY time_created ASC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('user_id_1', $user_id, PDO::PARAM_INT);
        $statement->bindValue('partner_id_1', $partner_id, PDO::PARAM_INT);
        $statement->bindValue('partner_id_2', $partner_id, PDO::PARAM_INT);
        $statement->bindValue('user_id_2', $user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_messages_between_users(int $user_id, int $partner_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM user_messages
             WHERE (user_id_sender = :user_id_1 AND user_id_receiver = :partner_id_1)
                OR (user_id_sender = :partner_id_2 AND user_id_receiver = :user_id_2)'
        );

        $statement->execute([
            'user_id_1'    => $user_id,
            'partner_id_1' => $partner_id,
            'partner_id_2' => $partner_id,
            'user_id_2'    => $user_id,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    public function exists_conversation_between_users(int $user_id, int $partner_id): bool {
        $statement = $this->_database->prepare(
            'SELECT 1
             FROM user_messages
             WHERE (user_id_sender = :user_id_1 AND user_id_receiver = :partner_id_1)
                OR (user_id_sender = :partner_id_2 AND user_id_receiver = :user_id_2)
             LIMIT 1'
        );

        $statement->execute([
            'user_id_1'    => $user_id,
            'partner_id_1' => $partner_id,
            'partner_id_2' => $partner_id,
            'user_id_2'    => $user_id,
        ]);

        return (bool) $statement->fetchColumn();
    }

    //  СООБЩЕНИЯ: ОБНОВЛЕНИЕ  //

    public function update_messages_read(int $user_id_receiver, int $user_id_sender): bool {
        $statement = $this->_database->prepare(
            'UPDATE user_messages
             SET is_read = TRUE
             WHERE user_id_receiver = :user_id_receiver
               AND user_id_sender = :user_id_sender
               AND is_read = FALSE'
        );

        return $statement->execute([
            'user_id_receiver' => $user_id_receiver,
            'user_id_sender'   => $user_id_sender,
        ]);
    }

    //  СООБЩЕНИЯ: ПОДСЧЁТ  //

    public function count_unread_total(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM user_messages
             WHERE user_id_receiver = :user_id AND is_read = FALSE'
        );

        $statement->execute(['user_id' => $user_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }
}
