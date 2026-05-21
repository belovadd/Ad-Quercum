<?php
/**
 *  Все константы приложения Ad Quercum
 * НАЗНАЧЕНИЕ:
 * Единый источник всех параметров, лимитов, порогов и перечислений.
 * В коде сервисов и контроллеров используются ТОЛЬКО эти константы.
 * 
 */

//  1. ПУТИ  //

define('BASE_PATH', dirname(__DIR__));
define('UPLOADS_PATH', BASE_PATH . '/uploads');
define('AVATARS_PATH', UPLOADS_PATH . '/avatars');
define('BOOK_COVERS_PATH', UPLOADS_PATH . '/book_covers');
define('CLUB_IMAGES_PATH', UPLOADS_PATH . '/club_images');

define('WEB_ROOT', (function () {
    if (!isset($_SERVER['SCRIPT_NAME'])) {
        return '';
    }
    $script = $_SERVER['SCRIPT_NAME'];
    $api_pos = strpos($script, '/api/');
    if ($api_pos !== false) {
        return substr($script, 0, $api_pos);
    }
    return '';
})());

define('AVATARS_URL', WEB_ROOT . '/uploads/avatars');
define('BOOK_COVERS_URL', WEB_ROOT . '/uploads/book_covers');
define('CLUB_IMAGES_URL', WEB_ROOT . '/uploads/club_images');

define('DEFAULT_AVATAR_URL', WEB_ROOT . '/assets/images/default_avatar.png');
define('DEFAULT_BOOK_COVER_URL', WEB_ROOT . '/assets/images/default_book_cover.jpg');

define('APP_BASE_URL', (function () {
    $configured_url = getenv('APP_BASE_URL');

    if ($configured_url === false || trim($configured_url) === '') {
        $configured_url = getenv('AD_QUERCUM_APP_BASE_URL');
    }

    if (is_string($configured_url) && trim($configured_url) !== '') {
        $normalized_url = rtrim(trim($configured_url), '/');
        $configured_scheme = parse_url($normalized_url, PHP_URL_SCHEME);
        $configured_host = parse_url($normalized_url, PHP_URL_HOST);

        if (in_array($configured_scheme, ['http', 'https'], true) && $configured_host) {
            return $normalized_url;
        }
    }

    $is_https = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== '' && $_SERVER['HTTPS'] !== 'off';
    $scheme = $is_https ? 'https' : 'http';
    $host = $_SERVER['SERVER_NAME'] ?? 'localhost';
    $port = isset($_SERVER['SERVER_PORT']) ? (int) $_SERVER['SERVER_PORT'] : null;
    $is_standard_port = ($scheme === 'http' && $port === 80) || ($scheme === 'https' && $port === 443);
    $port_part = ($port !== null && !$is_standard_port) ? ':' . $port : '';

    return $scheme . '://' . $host . $port_part;
})());
define('APP_CANONICAL_HOST', parse_url(APP_BASE_URL, PHP_URL_HOST) ?: 'localhost');

// 1.1. РОЛИ ПОЛЬЗОВАТЕЛЕЙ  //

define('USER_ROLE_USER', 'user');
define('USER_ROLE_MODERATOR', 'moderator');
define('USER_ROLE_ADMIN', 'admin');

define('USER_ROLES', [
    USER_ROLE_USER,
    USER_ROLE_MODERATOR,
    USER_ROLE_ADMIN,
]);

//  1.2. МОДЕРАЦИЯ КНИГ И ИЗДАНИЙ  //

define('BOOK_MODERATION_PENDING', 'pending');
define('BOOK_MODERATION_APPROVED', 'approved');
define('BOOK_MODERATION_REJECTED', 'rejected');

define('BOOK_MODERATION_STATUSES', [
    BOOK_MODERATION_PENDING,
    BOOK_MODERATION_APPROVED,
    BOOK_MODERATION_REJECTED,
]);

define('EDITION_MODERATION_PENDING', 'pending');
define('EDITION_MODERATION_APPROVED', 'approved');
define('EDITION_MODERATION_REJECTED', 'rejected');

define('EDITION_MODERATION_STATUSES', [
    EDITION_MODERATION_PENDING,
    EDITION_MODERATION_APPROVED,
    EDITION_MODERATION_REJECTED,
]);

//  2. АУТЕНТИФИКАЦИЯ  //

define('MIN_PASSWORD_LENGTH', 8);
define('MAX_PASSWORD_LENGTH', 128);
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_MINUTES', 15);
define('MAX_EMAIL_LENGTH', 255);
define('MAX_NAME_LENGTH', 100);
define('MAX_PROFILE_IDENTIFIER_LENGTH', 50);
define('MAX_PROFILE_BIO_LENGTH', 1000);
define('MAX_PROFILE_LOCATION_LENGTH', 100);
define('MAX_PROFILE_STATUS_LENGTH', 255);

// Email-верификация реализована, но выключена для дипломного режима:
// пользователь сразу создаётся подтверждённым и автоматически входит в систему.
define('EMAIL_VERIFICATION_ENABLED', false);
define('EMAIL_VERIFICATION_TOKEN_BYTES', 32);
define('EMAIL_VERIFICATION_TOKEN_TTL_HOURS', 24);
define('CSRF_TOKEN_BYTES', 32);

define('SMTP_HOST', 'localhost');
define('SMTP_PORT', 25);
define('SMTP_USERNAME', '');
define('SMTP_PASSWORD', '');
define('SMTP_ENCRYPTION', ''); // '', 'tls' или 'ssl'
define('SMTP_FROM_EMAIL', 'no-reply@ad-quercum.local');
define('SMTP_FROM_NAME', 'Ad Quercum');
define('SMTP_TIMEOUT_SECONDS', 10);

define('LEGAL_DOCUMENT_TERMS', 'terms');
define('LEGAL_DOCUMENT_PERSONAL_DATA_CONSENT', 'personal_data_consent');
define('LEGAL_DOCUMENT_VERSION_CURRENT', '2026-05-16');
define('ERROR_EMAIL_VERIFICATION_SEND_FAILED', 'Не удалось отправить письмо подтверждения');

define('LEGAL_DOCUMENT_TYPES', [
    LEGAL_DOCUMENT_TERMS,
    LEGAL_DOCUMENT_PERSONAL_DATA_CONSENT,
]);

//  3. ЗАГРУЗКА ФАЙЛОВ  //

define('MAX_UPLOAD_SIZE_BYTES', 5242880); // 5 МБ
define('ALLOWED_IMAGE_TYPES', ['image/jpeg', 'image/png', 'image/webp']);
define('ALLOWED_IMAGE_EXTENSIONS', ['jpg', 'jpeg', 'png', 'webp']);

//  4. СТАТУСЫ КНИГ  //

define('BOOK_STATUS_WANT_TO_READ', 'want_to_read');
define('BOOK_STATUS_READING', 'reading');
define('BOOK_STATUS_FINISHED', 'finished');

define('BOOK_STATUSES', [
    BOOK_STATUS_WANT_TO_READ,
    BOOK_STATUS_READING,
    BOOK_STATUS_FINISHED,
]);

define('MIN_RATE_SCORE', 1);
define('MAX_RATE_SCORE', 5);
define('MAX_BOOK_TITLE_LENGTH', 500);
define('MAX_BOOK_AUTHOR_LENGTH', 500);
define('MAX_BOOK_GENRE_LENGTH', 100);
define('MIN_BOOK_YEAR_PUBLISHED', 1);
define('MAX_BOOK_YEAR_PUBLISHED', 9999);
define('MAX_BOOK_DESCRIPTION_LENGTH', 5000);

//  4.0.1. ИЗДАНИЯ  //

define('EDITION_TYPE_PAPERBACK', 'paperback');
define('EDITION_TYPE_HARDCOVER', 'hardcover');
define('EDITION_TYPE_POCKET', 'pocket');
define('EDITION_TYPE_EBOOK', 'ebook');
define('EDITION_TYPE_AUDIOBOOK', 'audiobook');

define('EDITION_TYPES', [
    EDITION_TYPE_PAPERBACK,
    EDITION_TYPE_HARDCOVER,
    EDITION_TYPE_POCKET,
    EDITION_TYPE_EBOOK,
    EDITION_TYPE_AUDIOBOOK,
]);

define('MAX_EDITION_ISBN_LENGTH', 20);
define('MAX_EDITION_LANGUAGE_LENGTH', 10);
define('MAX_EDITION_TRANSLATOR_LENGTH', 500);
define('MAX_EDITION_PUBLISHER_LENGTH', 255);
define('MAX_EDITION_SERIES_LENGTH', 255);
define('MIN_EDITION_PAGES', 1);
define('MAX_EDITION_PAGES', 65535);

define('AUTOCOMPLETE_MIN_QUERY_LENGTH', 2);
define('AUTOCOMPLETE_MAX_RESULTS', 10);

//  4.1. КОЛЛЕКЦИИ  //

define('MAX_LIBRARY_NAME_LENGTH', 255);
define('MAX_LIBRARY_DESCRIPTION_LENGTH', 1000);
define('MAX_LIBRARIES_PER_USER', 50);

// 5. СТАДИИ РАСТЕНИЯ  //

define('PLANT_STAGE_SEED', 'seed');
define('PLANT_STAGE_SPROUT', 'sprout');
define('PLANT_STAGE_YOUNG_PLANT', 'young_plant');
define('PLANT_STAGE_ADULT_PLANT', 'adult_plant');
define('PLANT_STAGE_FLOWERING', 'flowering');
define('PLANT_STAGE_OAK', 'oak');

/**
 * Пороги перехода: стадия => минимальное количество завершённых сессий.
 */
define('PLANT_STAGE_THRESHOLDS', [
    PLANT_STAGE_SEED        => 0,
    PLANT_STAGE_SPROUT      => 6,
    PLANT_STAGE_YOUNG_PLANT => 16,
    PLANT_STAGE_ADULT_PLANT => 31,
    PLANT_STAGE_FLOWERING   => 61,
    PLANT_STAGE_OAK         => 101,
]);

define('PLANT_STAGES', [
    PLANT_STAGE_SEED,
    PLANT_STAGE_SPROUT,
    PLANT_STAGE_YOUNG_PLANT,
    PLANT_STAGE_ADULT_PLANT,
    PLANT_STAGE_FLOWERING,
    PLANT_STAGE_OAK,
]);

define('PLANT_IMAGE_URLS', [
    PLANT_STAGE_SEED        => WEB_ROOT . '/assets/images/plant/stage_seed.jpg?v=release',
    PLANT_STAGE_SPROUT      => WEB_ROOT . '/assets/images/plant/stage_sprout.jpg?v=release',
    PLANT_STAGE_YOUNG_PLANT => WEB_ROOT . '/assets/images/plant/stage_young_plant.jpg?v=release',
    PLANT_STAGE_ADULT_PLANT => WEB_ROOT . '/assets/images/plant/stage_adult_plant.jpg?v=release',
    PLANT_STAGE_FLOWERING   => WEB_ROOT . '/assets/images/plant/stage_flowering.jpg?v=release',
    PLANT_STAGE_OAK         => WEB_ROOT . '/assets/images/plant/stage_oak.jpg?v=release',
]);

//  6. СТАТУСЫ СЕССИЙ ЧТЕНИЯ  //

define('SESSION_STATUS_ACTIVE', 'active');
define('SESSION_STATUS_PAUSED', 'paused');
define('SESSION_STATUS_COMPLETED', 'completed');
define('SESSION_STATUS_CANCELLED', 'cancelled');

define('SESSION_STATUSES', [
    SESSION_STATUS_ACTIVE,
    SESSION_STATUS_PAUSED,
    SESSION_STATUS_COMPLETED,
    SESSION_STATUS_CANCELLED,
]);

//  7. ТАЙМЕР / ПОМОДОРО  //

define('DEFAULT_WORK_DURATION', 1500);        // 25 минут в секундах
define('DEFAULT_SHORT_BREAK', 300);           // 5 минут
define('DEFAULT_LONG_BREAK', 1800);           // 30 минут
define('DEFAULT_POMODORO_BEFORE_LONG_BREAK', 4);

define('MIN_WORK_DURATION', 300);             // 5 минут
define('MAX_WORK_DURATION', 7200);            // 2 часа
define('MIN_SHORT_BREAK', 60);               // 1 минута
define('MAX_SHORT_BREAK', 1800);             // 30 минут
define('MIN_LONG_BREAK', 300);               // 5 минут
define('MAX_LONG_BREAK', 3600);              // 1 час
define('MIN_POMODORO_BEFORE_LONG_BREAK', 2);
define('MAX_POMODORO_BEFORE_LONG_BREAK', 10);

//  7.1. ЦЕЛИ ЧТЕНИЯ  //

define('GOAL_TYPE_DAILY', 'daily');
define('GOAL_TYPE_WEEKLY', 'weekly');
define('GOAL_TYPE_MONTHLY', 'monthly');
define('GOAL_TYPE_YEARLY', 'yearly');

define('GOAL_TYPES', [
    GOAL_TYPE_DAILY,
    GOAL_TYPE_WEEKLY,
    GOAL_TYPE_MONTHLY,
    GOAL_TYPE_YEARLY,
]);

define('MIN_GOAL_TARGET_MINUTES', 1);
define('MAX_GOAL_TARGET_MINUTES', 14400);     // 10 дней

// 8. ДРУЖБА  //

define('FRIEND_REQUEST_PENDING', 'pending');
define('FRIEND_REQUEST_ACCEPTED', 'accepted');
define('FRIEND_REQUEST_REJECTED', 'rejected');

define('MAX_FRIENDS_PER_USER', 500);

//  9. КЛУБЫ  //

define('CLUB_ROLE_MEMBER', 'member');
define('CLUB_ROLE_MODERATOR', 'moderator');
define('CLUB_ROLE_CREATOR', 'creator');

define('CLUB_JOIN_REQUEST_PENDING', 'pending');
define('CLUB_JOIN_REQUEST_ACCEPTED', 'accepted');
define('CLUB_JOIN_REQUEST_REJECTED', 'rejected');

define('CLUB_CATALOG_FILTER_ALL', 'all');
define('CLUB_CATALOG_FILTER_MY', 'my');
define('CLUB_CATALOG_FILTER_PUBLIC', 'public');
define('CLUB_CATALOG_FILTER_PRIVATE', 'private');
define('CLUB_CATALOG_FILTER_PENDING', 'pending');

define('CLUB_CATALOG_FILTERS', [
    CLUB_CATALOG_FILTER_ALL,
    CLUB_CATALOG_FILTER_MY,
    CLUB_CATALOG_FILTER_PUBLIC,
    CLUB_CATALOG_FILTER_PRIVATE,
    CLUB_CATALOG_FILTER_PENDING,
]);

define('MAX_CLUB_NAME_LENGTH', 255);
define('MAX_CLUB_DESCRIPTION_LENGTH', 2000);
define('MAX_CLUBS_PER_USER', 50);
define('MAX_MEMBERS_PER_CLUB', 500);

//  10. ПУБЛИКАЦИИ  //

define('MAX_PUBLICATION_TEXT_LENGTH', 5000);
define('MAX_COMMENT_TEXT_LENGTH', 2000);

//  11. ПАГИНАЦИЯ  //

define('PAGINATION_DEFAULT_PAGE', 1);
define('PAGINATION_DEFAULT_PER_PAGE', 20);
define('PAGINATION_MAX_PER_PAGE', 100);

//  12. ЧАТ  //

define('CHAT_POLL_INTERVAL_MS', 5000); // 5 секунд
define('MAX_MESSAGE_TEXT_LENGTH', 5000);
define('MESSAGES_PER_PAGE', 50);

//  13. ЗАМЕТКИ ЧТЕНИЯ  //

define('NOTE_TYPE_QUOTE',    'quote');
define('NOTE_TYPE_THOUGHT',  'thought');
define('NOTE_TYPE_QUESTION', 'question');
define('NOTE_TYPE_IDEA',     'idea');
define('MAX_NOTE_TEXT_LENGTH', 4000);
define('NOTES_PER_PAGE', 50);

//  14. СТАТИСТИКА  //

define('STATISTICS_DAYS_DEFAULT', 365);
define('STATISTICS_DAYS_MAX', 730);
define('STATISTICS_TOP_BOOKS_LIMIT', 10);

//  15. АДМИНИСТРИРОВАНИЕ  //

define('ADMIN_RECENT_ACTIVITY_DEFAULT_LIMIT', 20);
define('ADMIN_RECENT_ACTIVITY_MIN_LIMIT', 1);
define('ADMIN_RECENT_ACTIVITY_MAX_LIMIT', 100);
define('ADMIN_MERGE_SEARCH_LIMIT', 10);
define('MAX_BLOCK_REASON_LENGTH', 500);

//  16. СИСТЕМНЫЕ ЗНАЧЕНИЯ  //

define('SECONDS_PER_MINUTE', 60);
define('SECONDS_PER_HOUR', 3600);
define('DEFAULT_TEXT_MAX_LENGTH', 10000);
