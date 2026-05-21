-- -------------------------------------------------------------------------
--  1. users — пользователи системы
-- -------------------------------------------------------------------------
-- Корневая таблица. Учётка: email + bcrypt-хеш пароля. Профильные данные:
-- имя, фамилия, аватар, публичный никнейм, био, город и текущий статус.
-- Поля приватности отключают
-- видимость статистики и геймификации на чужом профиле. Роль определяет
-- доступ к админским действиям; флаг is_blocked — софт-блокировка.
-- -------------------------------------------------------------------------
CREATE TABLE users (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_email VARCHAR(255) NOT NULL UNIQUE,
    user_password_hash VARCHAR(255) NOT NULL,
    user_name_first VARCHAR(100) DEFAULT NULL,
    user_name_last VARCHAR(100) DEFAULT NULL,
    user_avatar_path VARCHAR(500) DEFAULT NULL,
    user_profile_identifier VARCHAR(50) UNIQUE DEFAULT NULL,
    user_bio TEXT DEFAULT NULL,
    user_location VARCHAR(100) DEFAULT NULL,
    user_status VARCHAR(255) DEFAULT NULL,
    is_email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    user_role ENUM('user', 'moderator', 'admin') NOT NULL DEFAULT 'user',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    is_profile_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_library_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_collections_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    time_blocked TIMESTAMP NULL DEFAULT NULL,
    user_blocked_reason VARCHAR(500) DEFAULT NULL,
    is_stats_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    is_plant_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  2. email_verification_tokens — токены подтверждения email
-- -------------------------------------------------------------------------
-- Токены хранятся только в виде SHA-256-хеша. Функциональность реализована,
-- но в дипломном режиме отключена константой EMAIL_VERIFICATION_ENABLED.
-- -------------------------------------------------------------------------
CREATE TABLE email_verification_tokens (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    verification_token_hash CHAR(64) NOT NULL UNIQUE,
    time_expires TIMESTAMP NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_email_verification_user (user_id),
    INDEX idx_email_verification_expires (time_expires)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  3. user_legal_acceptances — принятие правовых документов
-- -------------------------------------------------------------------------
-- Фиксирует отдельные согласия пользователя при регистрации: тип документа,
-- версию опубликованной редакции и время принятия.
-- -------------------------------------------------------------------------
CREATE TABLE user_legal_acceptances (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    acceptance_document_type ENUM('terms', 'personal_data_consent') NOT NULL,
    acceptance_document_version VARCHAR(20) NOT NULL,
    time_accepted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_acceptance_document_version (
        user_id,
        acceptance_document_type,
        acceptance_document_version
    ),
    INDEX idx_legal_acceptances_user (user_id, time_accepted DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  4. libraries — пользовательские коллекции
-- -------------------------------------------------------------------------
-- Именованные «полки» пользователя. По умолчанию приватные. Содержимое
-- хранит таблица library_books, ссылающаяся на конкретные издания.
-- -------------------------------------------------------------------------
CREATE TABLE libraries (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    library_name VARCHAR(255) NOT NULL,
    library_description TEXT DEFAULT NULL,
    is_private BOOLEAN NOT NULL DEFAULT TRUE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  5. books — произведения (абстракция)
-- -------------------------------------------------------------------------
-- Литературная единица (название/автор/жанр/год/описание/язык оригинала).
-- НЕ хранит ISBN, обложку, переводчика, страницы — это атрибуты издания
-- (см. book_editions). Модерация двухуровневая, независимая от издания.
-- book_merged_to_id указывает на мастер-запись при слиянии дубликатов.
-- -------------------------------------------------------------------------
CREATE TABLE books (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    book_title VARCHAR(500) NOT NULL,
    book_author VARCHAR(500) NOT NULL,
    book_genre VARCHAR(100) DEFAULT NULL,
    book_year_published SMALLINT UNSIGNED DEFAULT NULL,
    book_original_language VARCHAR(10) DEFAULT NULL,
    book_description TEXT DEFAULT NULL,
    book_moderation_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    book_merged_to_id INT UNSIGNED DEFAULT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_merged_to_id) REFERENCES books(id) ON DELETE SET NULL,
    INDEX idx_books_moderation_status (book_moderation_status),
    INDEX idx_books_title (book_title),
    INDEX idx_books_author (book_author)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  6. book_editions — конкретные издания произведений
-- -------------------------------------------------------------------------
-- Физический/электронный экземпляр произведения: ISBN, язык, переводчик
-- или автор оригинала, издатель, серия, страницы, тип обложки и URL
-- файла обложки. Модерация независимо от произведения. Каскад при
-- удалении родительского произведения.
-- -------------------------------------------------------------------------
CREATE TABLE book_editions (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    book_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    edition_isbn VARCHAR(20) DEFAULT NULL,
    edition_language VARCHAR(10) DEFAULT NULL,
    edition_translator VARCHAR(500) DEFAULT NULL,
    edition_publisher VARCHAR(255) DEFAULT NULL,
    edition_series VARCHAR(255) DEFAULT NULL,
    edition_pages SMALLINT UNSIGNED DEFAULT NULL,
    edition_type ENUM('paperback', 'hardcover', 'pocket', 'ebook', 'audiobook') DEFAULT NULL,
    edition_cover_path VARCHAR(500) DEFAULT NULL,
    edition_moderation_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_editions_moderation_status (edition_moderation_status),
    INDEX idx_editions_isbn (edition_isbn),
    INDEX idx_editions_book (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  7. library_books — содержимое коллекций
-- -------------------------------------------------------------------------
-- Связующая таблица: какие издания лежат в библиотеке пользователя и, опционально,
-- в конкретных коллекциях. `library_id = NULL` означает «просто в библиотеке»,
-- без привязки к пользовательской коллекции. Ссылается на издание
-- (book_editions.id), не на абстрактное произведение.
-- UNIQUE гарантирует, что одно издание добавлено в библиотеку/одну коллекцию
-- не больше раза. `library_scope_id` хранит 0 для общей библиотеки и id коллекции.
-- -------------------------------------------------------------------------
CREATE TABLE library_books (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    library_id INT UNSIGNED DEFAULT NULL,
    library_scope_id INT UNSIGNED NOT NULL DEFAULT 0,
    edition_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_library_user_edition (user_id, edition_id, library_scope_id),
    FOREIGN KEY (library_id) REFERENCES libraries(id) ON DELETE CASCADE,
    FOREIGN KEY (edition_id) REFERENCES book_editions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_library_books_user_edition (user_id, edition_id),
    INDEX idx_library_books_edition (edition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  8. book_rates — оценки/статусы/рецензии произведений
-- -------------------------------------------------------------------------
-- Один пользователь — одна запись на произведение. Хранит текущий
-- статус прочтения, оценку 1–5, рецензию и личные заметки. Привязка
-- к произведению (book_id), не к изданию: рецензия про роман, не про
-- конкретный перевод/переплёт.
-- -------------------------------------------------------------------------
CREATE TABLE book_rates (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    book_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    rate_score TINYINT UNSIGNED DEFAULT NULL CHECK (rate_score BETWEEN 1 AND 5),
    rate_review TEXT DEFAULT NULL,
    rate_notes TEXT DEFAULT NULL,
    book_status ENUM('want_to_read', 'reading', 'finished') NOT NULL DEFAULT 'want_to_read',
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_book (user_id, book_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  9. reading_sessions — сессии чтения (таймер)
-- -------------------------------------------------------------------------
-- Каждый запуск таймера — новая сессия. Привязка к произведению (book_id)
-- опциональна (читать можно и без указания книги). При удалении книги
-- ссылка обнуляется, сессия не теряется.
-- -------------------------------------------------------------------------
CREATE TABLE reading_sessions (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    book_id INT UNSIGNED DEFAULT NULL,
    session_duration_planned INT UNSIGNED NOT NULL,
    session_duration_actual INT UNSIGNED DEFAULT NULL,
    session_status ENUM('active', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
    is_pomodoro BOOLEAN NOT NULL DEFAULT FALSE,
    pomodoro_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    time_started TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_finished TIMESTAMP NULL DEFAULT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  10. reading_notes — заметки во время чтения
-- -------------------------------------------------------------------------
-- Заметки пользователя к сессии чтения и/или произведению: цитата, мысль,
-- вопрос. session_id и book_id nullable: заметка может быть общей, если
-- пользователь создал её без активной сессии или конкретной книги.
-- -------------------------------------------------------------------------
CREATE TABLE reading_notes (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    session_id INT UNSIGNED DEFAULT NULL,
    user_id INT UNSIGNED NOT NULL,
    book_id INT UNSIGNED DEFAULT NULL,
    note_type ENUM('quote', 'thought', 'question', 'idea') NOT NULL DEFAULT 'thought',
    note_text TEXT NOT NULL,
    note_page INT UNSIGNED DEFAULT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
    INDEX idx_reading_notes_user (user_id, time_created DESC),
    INDEX idx_reading_notes_session (session_id),
    INDEX idx_reading_notes_book (book_id, time_created DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  11. timer_settings — настройки таймера
-- -------------------------------------------------------------------------
-- Один пользователь — одна запись (UNIQUE user_id). Длительности — секунды.
-- -------------------------------------------------------------------------
CREATE TABLE timer_settings (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    setting_work_duration INT UNSIGNED NOT NULL DEFAULT 1500,
    setting_short_break INT UNSIGNED NOT NULL DEFAULT 300,
    setting_long_break INT UNSIGNED NOT NULL DEFAULT 1800,
    setting_pomodoro_before_long_break TINYINT UNSIGNED NOT NULL DEFAULT 4,
    is_sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_lo_fi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  12. plant_states — текущее состояние растения (геймификация)
-- -------------------------------------------------------------------------
-- Один пользователь — одно растение. Стадия определяется по количеству
-- завершённых сессий чтения (пороги — в config/constants.php).
-- -------------------------------------------------------------------------
CREATE TABLE plant_states (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    plant_stage ENUM('seed', 'sprout', 'young_plant', 'adult_plant', 'flowering', 'oak') NOT NULL DEFAULT 'seed',
    session_count_completed INT UNSIGNED NOT NULL DEFAULT 0,
    time_last_session TIMESTAMP NULL DEFAULT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  13. plant_stage_history — история переходов стадий растения
-- -------------------------------------------------------------------------
CREATE TABLE plant_stage_history (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    stage_from ENUM('seed', 'sprout', 'young_plant', 'adult_plant', 'flowering', 'oak') NOT NULL,
    stage_to ENUM('seed', 'sprout', 'young_plant', 'adult_plant', 'flowering', 'oak') NOT NULL,
    session_count_at_transition INT UNSIGNED NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  14. reading_goals — цели чтения
-- -------------------------------------------------------------------------
-- Цели по времени (в минутах) на день/неделю/месяц/год. Уникальная пара
-- (user_id, goal_type, goal_period_start) предотвращает дубли.
-- -------------------------------------------------------------------------
CREATE TABLE reading_goals (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    goal_type ENUM('daily', 'weekly', 'monthly', 'yearly') NOT NULL,
    goal_target_minutes INT UNSIGNED NOT NULL,
    goal_period_start DATE NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_goal_period (user_id, goal_type, goal_period_start),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
-- 15. friend_requests — запросы в друзья
-- -------------------------------------------------------------------------
CREATE TABLE friend_requests (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id_sender INT UNSIGNED NOT NULL,
    user_id_receiver INT UNSIGNED NOT NULL,
    request_status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_friend_request (user_id_sender, user_id_receiver),
    FOREIGN KEY (user_id_sender) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_receiver) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  16. friendships — установленные дружеские связи
-- -------------------------------------------------------------------------
-- При принятии заявки вставляются ДВЕ строки: (A, B) и (B, A) — это
-- упрощает выборку друзей конкретного пользователя.
-- -------------------------------------------------------------------------
CREATE TABLE friendships (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    friend_user_id INT UNSIGNED NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_friendship (user_id, friend_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  17. book_clubs — книжные клубы
-- -------------------------------------------------------------------------
CREATE TABLE book_clubs (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id_creator INT UNSIGNED NOT NULL,
    club_name VARCHAR(255) NOT NULL,
    club_description TEXT DEFAULT NULL,
    club_image_path VARCHAR(500) DEFAULT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id_creator) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  18. book_club_members — участники клубов и роли
-- -------------------------------------------------------------------------
CREATE TABLE book_club_members (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    club_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    member_role ENUM('member', 'moderator', 'creator') NOT NULL DEFAULT 'member',
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_club_member (club_id, user_id),
    FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  19. book_club_join_requests — заявки на вступление в приватные клубы
-- -------------------------------------------------------------------------
CREATE TABLE book_club_join_requests (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    club_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    request_status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_club_join_request (club_id, user_id),
    INDEX idx_club_join_requests_status (club_id, request_status),
    FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  20. book_club_messages — чат клуба
-- -------------------------------------------------------------------------
CREATE TABLE book_club_messages (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    club_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    message_text TEXT NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  21. book_club_publications — публикации в клубах
-- -------------------------------------------------------------------------
-- Опциональная привязка к произведению (book_id). При удалении книги
-- ссылка обнуляется, публикация сохраняется.
-- -------------------------------------------------------------------------
CREATE TABLE book_club_publications (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    club_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    book_id INT UNSIGNED DEFAULT NULL,
    publication_text TEXT NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  22. book_club_publication_comments — комментарии в клубах
-- -------------------------------------------------------------------------
CREATE TABLE book_club_publication_comments (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    publication_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    comment_text TEXT NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publication_id) REFERENCES book_club_publications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  23. user_publications — публикации в личной ленте
-- -------------------------------------------------------------------------
CREATE TABLE user_publications (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    book_id INT UNSIGNED DEFAULT NULL,
    publication_text TEXT NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  24. user_publication_comments — комментарии к публикациям юзеров
-- -------------------------------------------------------------------------
CREATE TABLE user_publication_comments (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    publication_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    comment_text TEXT NOT NULL,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (publication_id) REFERENCES user_publications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  25. user_messages — личные сообщения
-- -------------------------------------------------------------------------
CREATE TABLE user_messages (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id_sender INT UNSIGNED NOT NULL,
    user_id_receiver INT UNSIGNED NOT NULL,
    message_text TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id_sender) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_receiver) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -------------------------------------------------------------------------
--  26. Тестовый пользователь Diana
-- -------------------------------------------------------------------------

INSERT IGNORE INTO users (user_email, user_password_hash, user_name_first, user_profile_identifier)
VALUES
    ('diana@ad-quercum.ru', '$2y$12$aGyWMf.EQk/lgbgsSe8RReU63G4F/8I.I.tJ8XOyoOp7qilxT4Hr2', 'Diana', 'diana');

INSERT IGNORE INTO user_legal_acceptances (user_id, acceptance_document_type, acceptance_document_version)
SELECT id, 'terms', '2026-05-16'
FROM users
WHERE user_email = 'diana@ad-quercum.ru'
UNION ALL
SELECT id, 'personal_data_consent', '2026-05-16'
FROM users
WHERE user_email = 'diana@ad-quercum.ru';
