<?php
/**
 *  РЕПОЗИТОРИЙ: FriendRepository — SQL-запросы к таблицам friend_requests и friendships 
 *
 * НАЗНАЧЕНИЕ:
 * Все операции с таблицами friend_requests и friendships через PDO Prepared Statements.
 * Не содержит бизнес-логики — только SQL.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';
require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС FriendRepository  //

class FriendRepository {

    private PDO $_database;

    public function __construct() {
        $this->_database = get_database_connection();
    }

    // ЗАПРОСЫ ДРУЖБЫ: ВСТАВКА / ПОИСК  //

    public function insert_request(int $sender_id, int $receiver_id): int {
        $statement = $this->_database->prepare(
            'INSERT INTO friend_requests (user_id_sender, user_id_receiver, request_status)
             VALUES (:sender_id, :receiver_id, :status)'
        );

        $statement->execute([
            'sender_id'   => $sender_id,
            'receiver_id' => $receiver_id,
            'status'      => FRIEND_REQUEST_PENDING,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function find_request_by_id(int $request_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id_sender, user_id_receiver, request_status,
                    time_created, time_updated
             FROM friend_requests
             WHERE id = :request_id'
        );

        $statement->execute(['request_id' => $request_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_request_between_users(int $user_id_a, int $user_id_b): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id_sender, user_id_receiver, request_status,
                    time_created, time_updated
             FROM friend_requests
             WHERE request_status = :status
               AND (
                   (user_id_sender = :a1 AND user_id_receiver = :b1)
                   OR (user_id_sender = :b2 AND user_id_receiver = :a2)
               )'
        );

        $statement->execute([
            'status' => FRIEND_REQUEST_PENDING,
            'a1'     => $user_id_a,
            'b1'     => $user_id_b,
            'b2'     => $user_id_b,
            'a2'     => $user_id_a,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_request_by_users(int $sender_id, int $receiver_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id_sender, user_id_receiver, request_status,
                    time_created, time_updated
             FROM friend_requests
             WHERE user_id_sender = :sender_id
               AND user_id_receiver = :receiver_id'
        );

        $statement->execute([
            'sender_id'   => $sender_id,
            'receiver_id' => $receiver_id,
        ]);

        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    // ЗАПРОСЫ ДРУЖБЫ: ОБНОВЛЕНИЕ / УДАЛЕНИЕ  //

    public function update_request_status(int $request_id, string $status): bool {
        $statement = $this->_database->prepare(
            'UPDATE friend_requests
             SET request_status = :status
             WHERE id = :request_id'
        );

        return $statement->execute([
            'request_id' => $request_id,
            'status'     => $status,
        ]);
    }

    public function reactivate_request(int $request_id): bool {
        $statement = $this->_database->prepare(
            'UPDATE friend_requests
             SET request_status = :status,
                 time_created = CURRENT_TIMESTAMP
             WHERE id = :request_id'
        );

        return $statement->execute([
            'request_id' => $request_id,
            'status'     => FRIEND_REQUEST_PENDING,
        ]);
    }

    public function delete_request(int $request_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM friend_requests WHERE id = :request_id'
        );

        return $statement->execute(['request_id' => $request_id]);
    }

    //  ЗАПРОСЫ ДРУЖБЫ: СПИСКИ  //

    public function find_incoming_requests(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT fr.id, fr.user_id_sender, fr.user_id_receiver,
                    fr.request_status, fr.time_created,
                    u.user_name_first, u.user_name_last,
                    u.user_email, u.user_avatar_path, u.user_profile_identifier,
                    (
                        SELECT CASE
                            WHEN u.is_library_hidden = 1 THEN NULL
                            ELSE COUNT(DISTINCT be.book_id)
                        END
                        FROM library_books lb
                        JOIN book_editions be ON be.id = lb.edition_id
                        JOIN books b ON b.id = be.book_id
                        WHERE lb.user_id = u.id
                          AND be.edition_moderation_status = :edition_status_incoming
                          AND b.book_moderation_status = :book_status_incoming
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
                    ) AS publications_count
             FROM friend_requests fr
             JOIN users u ON u.id = fr.user_id_sender
             WHERE fr.user_id_receiver = :user_id
               AND fr.request_status = :status
             ORDER BY fr.time_created DESC'
        );

        $statement->execute([
            'user_id'                 => $user_id,
            'status'                  => FRIEND_REQUEST_PENDING,
            'edition_status_incoming' => EDITION_MODERATION_APPROVED,
            'book_status_incoming'    => BOOK_MODERATION_APPROVED,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function find_outgoing_requests(int $user_id): array {
        $statement = $this->_database->prepare(
            'SELECT fr.id, fr.user_id_sender, fr.user_id_receiver,
                    fr.request_status, fr.time_created,
                    u.user_name_first, u.user_name_last,
                    u.user_email, u.user_avatar_path, u.user_profile_identifier,
                    (
                        SELECT CASE
                            WHEN u.is_library_hidden = 1 THEN NULL
                            ELSE COUNT(DISTINCT be.book_id)
                        END
                        FROM library_books lb
                        JOIN book_editions be ON be.id = lb.edition_id
                        JOIN books b ON b.id = be.book_id
                        WHERE lb.user_id = u.id
                          AND be.edition_moderation_status = :edition_status_outgoing
                          AND b.book_moderation_status = :book_status_outgoing
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
                    ) AS publications_count
             FROM friend_requests fr
             JOIN users u ON u.id = fr.user_id_receiver
             WHERE fr.user_id_sender = :user_id
               AND fr.request_status = :status
             ORDER BY fr.time_created DESC'
        );

        $statement->execute([
            'user_id'                 => $user_id,
            'status'                  => FRIEND_REQUEST_PENDING,
            'edition_status_outgoing' => EDITION_MODERATION_APPROVED,
            'book_status_outgoing'    => BOOK_MODERATION_APPROVED,
        ]);

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_incoming_requests(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as total
             FROM friend_requests
             WHERE user_id_receiver = :user_id
               AND request_status = :status'
        );

        $statement->execute([
            'user_id' => $user_id,
            'status'  => FRIEND_REQUEST_PENDING,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    //  ДРУЖБА: ВСТАВКА / УДАЛЕНИЕ  //

    public function insert_friendship_pair(int $user_id_a, int $user_id_b): bool {
        $statement = $this->_database->prepare(
            'INSERT INTO friendships (user_id, friend_user_id)
             VALUES (:a, :b), (:b2, :a2)'
        );

        return $statement->execute([
            'a'  => $user_id_a,
            'b'  => $user_id_b,
            'b2' => $user_id_b,
            'a2' => $user_id_a,
        ]);
    }

    public function delete_friendship_pair(int $user_id_a, int $user_id_b): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM friendships
             WHERE (user_id = :a1 AND friend_user_id = :b1)
                OR (user_id = :b2 AND friend_user_id = :a2)'
        );

        return $statement->execute([
            'a1' => $user_id_a,
            'b1' => $user_id_b,
            'b2' => $user_id_b,
            'a2' => $user_id_a,
        ]);
    }

    //  ДРУЖБА: ПРОВЕРКИ И СПИСКИ  //

    public function exists_friendship(int $user_id, int $friend_id): bool {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as cnt
             FROM friendships
             WHERE user_id = :user_id AND friend_user_id = :friend_id'
        );

        $statement->execute([
            'user_id'   => $user_id,
            'friend_id' => $friend_id,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['cnt'] > 0;
    }

    public function find_friends(int $user_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT f.friend_user_id, f.time_created as friendship_time_created,
                    u.id, u.user_name_first, u.user_name_last,
                    u.user_email, u.user_avatar_path, u.user_profile_identifier,
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
                        FROM friendships friend_counter
                        WHERE friend_counter.user_id = u.id
                    ) AS friends_count,
                    (
                        SELECT COUNT(*)
                        FROM user_publications up
                        WHERE up.user_id = u.id
                    ) AS publications_count
             FROM friendships f
             JOIN users u ON u.id = f.friend_user_id
             WHERE f.user_id = :user_id
             ORDER BY f.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('user_id', $user_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->bindValue('edition_status', EDITION_MODERATION_APPROVED);
        $statement->bindValue('book_status', BOOK_MODERATION_APPROVED);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_friends(int $user_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as total
             FROM friendships
             WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }
}
