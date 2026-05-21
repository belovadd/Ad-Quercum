<?php
/**
 *  🐘 РЕПОЗИТОРИЙ: ClubPublicationRepository — SQL-запросы к публикациям и комментариям клубов 
 *
 * НАЗНАЧЕНИЕ:
 * Все SQL-операции с клубными публикациями и комментариями к ним.
 * Не содержит бизнес-логики — только SQL через PDO Prepared Statements.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../core/database_connection.php';

//  2. КЛАСС ClubPublicationRepository  //

class ClubPublicationRepository {

    private PDO $_database;

    public function __construct() {
        $this->_database = get_database_connection();
    }

    // ПУБЛИКАЦИИ: ВСТАВКА  //

    public function insert_publication(int $club_id, int $user_id, string $text, ?int $book_id = null): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_club_publications (club_id, user_id, book_id, publication_text)
             VALUES (:club_id, :user_id, :book_id, :publication_text)'
        );

        $statement->execute([
            'club_id'          => $club_id,
            'user_id'          => $user_id,
            'book_id'          => $book_id,
            'publication_text' => $text,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  ПУБЛИКАЦИИ: ПОИСК  //

    public function find_publication_by_id(int $publication_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT cp.id, cp.club_id, cp.user_id, cp.book_id, cp.publication_text,
                    cp.time_created, cp.time_updated,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier,
                    b.book_title, b.book_author
             FROM book_club_publications cp
             JOIN users u ON u.id = cp.user_id
             LEFT JOIN books b ON b.id = cp.book_id
             WHERE cp.id = :publication_id'
        );

        $statement->execute(['publication_id' => $publication_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_publications_by_club(int $club_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT cp.id, cp.club_id, cp.user_id, cp.book_id, cp.publication_text,
                    cp.time_created, cp.time_updated,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier,
                    b.book_title, b.book_author,
                    (SELECT COUNT(*) FROM book_club_publication_comments cc WHERE cc.publication_id = cp.id) AS comment_count
             FROM book_club_publications cp
             JOIN users u ON u.id = cp.user_id
             LEFT JOIN books b ON b.id = cp.book_id
             WHERE cp.club_id = :club_id
             ORDER BY cp.time_created DESC
             LIMIT :limit OFFSET :offset'
        );

        $statement->bindValue('club_id', $club_id, PDO::PARAM_INT);
        $statement->bindValue('limit', $per_page, PDO::PARAM_INT);
        $statement->bindValue('offset', $offset, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll(PDO::FETCH_ASSOC);
    }

    public function count_publications_by_club(int $club_id): int {
        $statement = $this->_database->prepare(
            'SELECT COUNT(*) AS total
             FROM book_club_publications
             WHERE club_id = :club_id'
        );

        $statement->execute(['club_id' => $club_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    //  ПУБЛИКАЦИИ: УДАЛЕНИЕ  //


    public function delete_publication(int $publication_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM book_club_publications WHERE id = :publication_id'
        );

        return $statement->execute(['publication_id' => $publication_id]);
    }

    //  КОММЕНТАРИИ: ВСТАВКА  //

    public function insert_comment(int $publication_id, int $user_id, string $text): int {
        $statement = $this->_database->prepare(
            'INSERT INTO book_club_publication_comments (publication_id, user_id, comment_text)
             VALUES (:publication_id, :user_id, :comment_text)'
        );

        $statement->execute([
            'publication_id' => $publication_id,
            'user_id'        => $user_id,
            'comment_text'   => $text,
        ]);

        return (int) $this->_database->lastInsertId();
    }

    //  КОММЕНТАРИИ: ПОИСК  //

    public function find_comment_by_id(int $comment_id): ?array {
        $statement = $this->_database->prepare(
            'SELECT cc.id, cc.publication_id, cc.user_id, cc.comment_text, cc.time_created,
                    cp.club_id
             FROM book_club_publication_comments cc
             JOIN book_club_publications cp ON cp.id = cc.publication_id
             WHERE cc.id = :comment_id'
        );

        $statement->execute(['comment_id' => $comment_id]);
        $result = $statement->fetch(PDO::FETCH_ASSOC);

        return $result ?: null;
    }

    public function find_comments_by_publication(int $publication_id, int $page, int $per_page): array {
        $offset = ($page - 1) * $per_page;

        $statement = $this->_database->prepare(
            'SELECT cc.id, cc.publication_id, cc.user_id, cc.comment_text, cc.time_created,
                    u.user_name_first, u.user_name_last, u.user_email,
                    u.user_avatar_path, u.user_profile_identifier
             FROM book_club_publication_comments cc
             JOIN users u ON u.id = cc.user_id
             WHERE cc.publication_id = :publication_id
             ORDER BY cc.time_created ASC
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
             FROM book_club_publication_comments
             WHERE publication_id = :publication_id'
        );

        $statement->execute(['publication_id' => $publication_id]);

        return (int) $statement->fetch(PDO::FETCH_ASSOC)['total'];
    }

    // КОММЕНТАРИИ: УДАЛЕНИЕ  //

    public function delete_comment(int $comment_id): bool {
        $statement = $this->_database->prepare(
            'DELETE FROM book_club_publication_comments WHERE id = :comment_id'
        );

        return $statement->execute(['comment_id' => $comment_id]);
    }
}
