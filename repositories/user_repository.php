<?php
/**
 *  РЕПОЗИТОРИЙ: UserRepository — SQL-запросы к users и связанным таблицам 
 *
 * НАЗНАЧЕНИЕ:
 * Все операции с таблицами users, email_verification_tokens и user_legal_acceptances
 * через PDO Prepared Statements.
 * Не содержит бизнес-логики — только SQL.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ //

require_once __DIR__ . '/../core/database_connection.php';

//  2. КЛАСС UserRepository  //

class UserRepository {

    private PDO $_database;

    public function __construct() {
        $this->_database = get_database_connection();
    }

    // ВСТАВКА  //

    public function insert_user(
        string $email,
        string $password_hash,
        ?string $user_profile_identifier = null,
        bool $is_email_verified = true
    ): int {
        $statement = $this->_database->prepare(
            'INSERT INTO users (user_email, user_password_hash, user_profile_identifier, is_email_verified)
             VALUES (:email, :password_hash, :user_profile_identifier, :is_email_verified)'
        );

        $statement->execute([
            'email'                   => $email,
            'password_hash'           => $password_hash,
            'user_profile_identifier' => $user_profile_identifier,
            'is_email_verified'       => $is_email_verified ? 1 : 0,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function create_email_verification_token(int $user_id, string $token_hash, string $expires_at): void {
        $statement = $this->_database->prepare(
            'INSERT INTO email_verification_tokens (user_id, verification_token_hash, time_expires)
             VALUES (:user_id, :token_hash, :expires_at)'
        );

        $statement->execute([
            'user_id'    => $user_id,
            'token_hash' => $token_hash,
            'expires_at' => $expires_at,
        ]);
    }

    public function insert_legal_acceptance(
        int $user_id,
        string $acceptance_document_type,
        string $acceptance_document_version
    ): int {
        $statement = $this->_database->prepare(
            'INSERT INTO user_legal_acceptances (user_id, acceptance_document_type, acceptance_document_version)
             VALUES (:user_id, :acceptance_document_type, :acceptance_document_version)'
        );

        $statement->execute([
            'user_id'                     => $user_id,
            'acceptance_document_type'    => $acceptance_document_type,
            'acceptance_document_version' => $acceptance_document_version,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    public function find_email_verification_token(string $token_hash): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_id, verification_token_hash, time_expires, time_created
             FROM email_verification_tokens
             WHERE verification_token_hash = :token_hash
             LIMIT 1'
        );

        $statement->execute(['token_hash' => $token_hash]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function mark_email_verified(int $user_id): bool {
        $statement = $this->_database->prepare(
            'UPDATE users SET is_email_verified = TRUE WHERE id = :user_id'
        );

        return $statement->execute(['user_id' => $user_id]);
    }

    public function delete_email_verification_tokens(int $user_id): void {
        $statement = $this->_database->prepare(
            'DELETE FROM email_verification_tokens WHERE user_id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);
    }

    public function delete_expired_email_verification_tokens(): void {
        $statement = $this->_database->prepare(
            'DELETE FROM email_verification_tokens WHERE time_expires < NOW()'
        );
        $statement->execute();
    }


    // ПОИСК ПО ID / EMAIL  //

    public function find_by_id(int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_email, user_name_first, user_name_last,
                    user_avatar_path, user_profile_identifier,
                    user_bio, user_location, user_status,
                    is_email_verified, user_role, is_blocked, time_blocked,
                    is_profile_hidden, is_library_hidden, is_collections_hidden,
                    is_stats_hidden, is_plant_hidden,
                    time_created, time_updated
             FROM users
             WHERE id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_by_email(string $email): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_email, user_password_hash, user_name_first,
                    user_name_last, user_avatar_path, user_profile_identifier,
                    user_bio, user_location, user_status,
                    is_email_verified, user_role, is_blocked, time_blocked,
                    is_profile_hidden, is_library_hidden, is_collections_hidden,
                    is_stats_hidden, is_plant_hidden,
                    time_created, time_updated
             FROM users
             WHERE user_email = :email'
        );

        $statement->execute(['email' => $email]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_by_id_with_password(int $user_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT id, user_email, user_password_hash, is_blocked
             FROM users
             WHERE id = :user_id'
        );

        $statement->execute(['user_id' => $user_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    // ОБНОВЛЕНИЕ  //

    public function update_profile(int $user_id, array $data): bool {
        $fields = [];
        $params = ['user_id' => $user_id];

        $allowed_fields = [
            'user_name_first',
            'user_name_last',
            'user_profile_identifier',
            'user_bio',
            'user_location',
            'user_status',
            'is_profile_hidden',
            'is_library_hidden',
            'is_collections_hidden',
            'is_stats_hidden',
            'is_plant_hidden',
        ];

        foreach ($allowed_fields as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :user_id';
        $statement = $this->_database->prepare($sql);

        return $statement->execute($params);
    }

    public function update_avatar(int $user_id, string $avatar_path): bool {
        $statement = $this->_database->prepare(
            'UPDATE users SET user_avatar_path = :avatar_path WHERE id = :user_id'
        );

        return $statement->execute([
            'user_id'     => $user_id,
            'avatar_path' => $avatar_path,
        ]);
    }

    public function update_password(int $user_id, string $password_hash): bool {
        $statement = $this->_database->prepare(
            'UPDATE users SET user_password_hash = :password_hash WHERE id = :user_id'
        );

        return $statement->execute([
            'user_id'       => $user_id,
            'password_hash' => $password_hash,
        ]);
    }

    public function delete_by_id(int $user_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM users WHERE id = :user_id'
        );

        return $statement->execute(['user_id' => $user_id]);
    }

    //  ПОИСК И ПАГИНАЦИЯ  //

    public function search_users(string $query, int $page, int $per_page, int $current_user_id = 0): array {
        $offset = ($page - 1) * $per_page;
        $where_sql = '';

        if ($query !== '') {
            $where_sql = 'WHERE u.user_email LIKE :query
                OR u.user_name_first LIKE :query2
                OR u.user_name_last LIKE :query3
                OR u.user_profile_identifier LIKE :query4
                OR u.user_location LIKE :query5
                OR u.user_status LIKE :query6';
        }

        $statement = $this->_database->prepare(
            'SELECT u.id, u.user_email, u.user_name_first, u.user_name_last,
                    u.user_avatar_path, u.user_profile_identifier,
                    u.user_bio, u.user_location, u.user_status, u.time_created,
                    (
                        SELECT CASE
                            WHEN u.is_library_hidden = 1 THEN NULL
                            ELSE COUNT(DISTINCT be.book_id)
                        END
                        FROM library_books lb
                        JOIN book_editions be ON be.id = lb.edition_id
                        JOIN books b ON b.id = be.book_id
                        WHERE lb.user_id = u.id
                          AND be.edition_moderation_status = "approved"
                          AND b.book_moderation_status = "approved"
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
                    CASE
                        WHEN u.id = :current_user_id_self THEN \'self\'
                        WHEN current_friendship.friend_user_id IS NOT NULL THEN \'friends\'
                        WHEN pending_request.id IS NOT NULL
                             AND pending_request.user_id_sender = :current_user_id_sent
                            THEN \'request_sent\'
                        WHEN pending_request.id IS NOT NULL THEN \'request_received\'
                        ELSE \'none\'
                    END AS friendship_status,
                    pending_request.id AS friendship_request_id
             FROM users u
             LEFT JOIN friendships current_friendship
                    ON current_friendship.user_id = :current_user_id_friend
                   AND current_friendship.friend_user_id = u.id
             LEFT JOIN friend_requests pending_request
                    ON pending_request.request_status = :pending_status
                   AND (
                       (pending_request.user_id_sender = :current_user_id_request_out
                        AND pending_request.user_id_receiver = u.id)
                       OR
                       (pending_request.user_id_sender = u.id
                        AND pending_request.user_id_receiver = :current_user_id_request_in)
                   )
             ' . $where_sql . '
             ORDER BY u.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        if ($query !== '') {
            $like_query = '%' . $query . '%';
            $statement->bindValue('query', $like_query, PDO::PARAM_STR);
            $statement->bindValue('query2', $like_query, PDO::PARAM_STR);
            $statement->bindValue('query3', $like_query, PDO::PARAM_STR);
            $statement->bindValue('query4', $like_query, PDO::PARAM_STR);
            $statement->bindValue('query5', $like_query, PDO::PARAM_STR);
            $statement->bindValue('query6', $like_query, PDO::PARAM_STR);
        }

        $statement->bindValue('current_user_id_self', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('current_user_id_sent', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('current_user_id_friend', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('current_user_id_request_out', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('current_user_id_request_in', $current_user_id, PDO::PARAM_INT);
        $statement->bindValue('pending_status', FRIEND_REQUEST_PENDING, PDO::PARAM_STR);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_search_results(string $query): int {
        // Пустой запрос — считаем всех пользователей
        if ($query === '') {
            $statement = $this->_database->query('SELECT COUNT(*) as total FROM users');
            return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
        }

        $like_query = '%' . $query . '%';

        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as total
             FROM users
             WHERE user_email LIKE :query
                OR user_name_first LIKE :query2
                OR user_name_last LIKE :query3
                OR user_profile_identifier LIKE :query4
                OR user_location LIKE :query5
                OR user_status LIKE :query6'
        );

        $statement->bindValue('query', $like_query, PDO::PARAM_STR);
        $statement->bindValue('query2', $like_query, PDO::PARAM_STR);
        $statement->bindValue('query3', $like_query, PDO::PARAM_STR);
        $statement->bindValue('query4', $like_query, PDO::PARAM_STR);
        $statement->bindValue('query5', $like_query, PDO::PARAM_STR);
        $statement->bindValue('query6', $like_query, PDO::PARAM_STR);
        $statement->execute();

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    // ПРОВЕРКИ СУЩЕСТВОВАНИЯ  //

    public function exists_by_email(string $email): bool {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as cnt FROM users WHERE user_email = :email'
        );

        $statement->execute(['email' => $email]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['cnt'] > 0;
    }

    public function exists_by_profile_identifier(string $identifier, int $exclude_user_id = 0): bool {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) as cnt FROM users
             WHERE user_profile_identifier = :identifier AND id != :exclude_id'
        );

        $statement->execute([
            'identifier' => $identifier,
            'exclude_id' => $exclude_user_id,
        ]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['cnt'] > 0;
    }
}
