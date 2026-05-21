<?php
/**
 * СЕРВИС: AuthService — Аутентификация, профиль, поиск пользователей 
 *
 * НАЗНАЧЕНИЕ:
 * Бизнес-логика регистрации, логина/логаута, управления профилем
 * и поиска пользователей. Не работает с HTTP напрямую.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/user_repository.php';
require_once __DIR__ . '/../repositories/library_repository.php';
require_once __DIR__ . '/../repositories/friend_repository.php';
require_once __DIR__ . '/../repositories/club_repository.php';
require_once __DIR__ . '/../repositories/social_repository.php';
require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/../core/file_uploader.php';
require_once __DIR__ . '/../core/pagination_helper.php';
require_once __DIR__ . '/../core/simple_smtp_mailer.php';

//  2. КЛАСС AuthService  //

class AuthService {

    private UserRepository $_user_repository;

    public function __construct() {
        $this->_user_repository = new UserRepository();
    }

    //  РЕГИСТРАЦИЯ  //

    public function register(
        string $email,
        string $password,
        ?string $user_profile_identifier = null,
        ?string $verification_base_url = null
    ): array {
        // Проверка уникальности email
        if ($this->_user_repository->exists_by_email($email)) {
            throw new RuntimeException('Пользователь с таким email уже существует');
        }

        // Проверка уникальности identifier (если задан)
        if ($user_profile_identifier !== null && $user_profile_identifier !== '') {
            if ($this->_user_repository->exists_by_profile_identifier($user_profile_identifier)) {
                throw new RuntimeException('Пользователь с таким идентификатором уже существует');
            }
        } else {
            $user_profile_identifier = null;
        }

        // Хеширование пароля
        $password_hash = password_hash($password, PASSWORD_BCRYPT);
        $is_email_verified = !EMAIL_VERIFICATION_ENABLED;

        // Создание пользователя
        $user_id = $this->_user_repository->insert_user(
            $email,
            $password_hash,
            $user_profile_identifier,
            $is_email_verified
        );

        try {
            $this->record_registration_legal_acceptances($user_id);

            if (EMAIL_VERIFICATION_ENABLED) {
                $this->send_email_verification($user_id, $email, $verification_base_url);

                $user = $this->_user_repository->find_by_id($user_id);
                $user['email_verification_required'] = true;
                return $user;
            }
        } catch (RuntimeException $exception) {
            $this->_user_repository->delete_by_id($user_id);
            throw $exception;
        }

        // Дипломный режим: email считается подтверждённым, пользователь сразу входит.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user_id;
        $_SESSION['user_role'] = USER_ROLE_USER;

        // Возврат данных
        return $this->_user_repository->find_by_id($user_id);
    }

    public function verify_email(string $token): array {
        if (!EMAIL_VERIFICATION_ENABLED) {
            throw new RuntimeException('Подтверждение email отключено для дипломного режима');
        }

        $token_hash = hash('sha256', $token);
        $token_data = $this->_user_repository->find_email_verification_token($token_hash);

        if ($token_data === null) {
            throw new RuntimeException('Ссылка подтверждения недействительна');
        }

        if (strtotime($token_data['time_expires']) < time()) {
            $this->_user_repository->delete_email_verification_tokens((int) $token_data['user_id']);
            throw new RuntimeException('Ссылка подтверждения устарела');
        }

        $user_id = (int) $token_data['user_id'];
        $this->_user_repository->mark_email_verified($user_id);
        $this->_user_repository->delete_email_verification_tokens($user_id);

        return $this->_user_repository->find_by_id($user_id);
    }

    private function send_email_verification(int $user_id, string $email, ?string $verification_base_url): void {
        $this->_user_repository->delete_expired_email_verification_tokens();
        $this->_user_repository->delete_email_verification_tokens($user_id);

        $token = bin2hex(random_bytes(EMAIL_VERIFICATION_TOKEN_BYTES));
        $token_hash = hash('sha256', $token);
        $expires_at = date('Y-m-d H:i:s', time() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * SECONDS_PER_HOUR);

        $this->_user_repository->create_email_verification_token($user_id, $token_hash, $expires_at);

        $verification_url = rtrim($verification_base_url ?? '', '?&')
            . (str_contains((string) $verification_base_url, '?') ? '&' : '?')
            . 'token=' . urlencode($token);

        $subject = 'Подтверждение регистрации в Ad Quercum';
        $body = "Здравствуйте!\n\n"
            . "Вы зарегистрировались в Ad Quercum. Чтобы подтвердить email, откройте ссылку:\n"
            . $verification_url . "\n\n"
            . "Ссылка действует " . EMAIL_VERIFICATION_TOKEN_TTL_HOURS . " часа(ов).\n"
            . "Если вы не регистрировались в Ad Quercum, просто проигнорируйте это письмо.\n";

        try {
            (new SimpleSmtpMailer())->send($email, $subject, $body);
        } catch (RuntimeException $exception) {
            error_log($exception->getMessage());
            throw new RuntimeException(ERROR_EMAIL_VERIFICATION_SEND_FAILED);
        }
    }

    private function record_registration_legal_acceptances(int $user_id): void {
        $this->_user_repository->insert_legal_acceptance(
            $user_id,
            LEGAL_DOCUMENT_TERMS,
            LEGAL_DOCUMENT_VERSION_CURRENT
        );
        $this->_user_repository->insert_legal_acceptance(
            $user_id,
            LEGAL_DOCUMENT_PERSONAL_DATA_CONSENT,
            LEGAL_DOCUMENT_VERSION_CURRENT
        );
    }

    // ЛОГИН / ЛОГАУТ  //

    public function login(string $email, string $password): array {
        $user = $this->_user_repository->find_by_email($email);

        if ($user === null) {
            throw new RuntimeException('Неверный email или пароль');
        }

        if (!password_verify($password, $user['user_password_hash'])) {
            throw new RuntimeException('Неверный email или пароль');
        }

        if (EMAIL_VERIFICATION_ENABLED && empty($user['is_email_verified'])) {
            throw new RuntimeException('Подтвердите email перед входом');
        }

        // Проверка блокировки
        if (!empty($user['is_blocked'])) {
            throw new RuntimeException('Ваш аккаунт заблокирован');
        }

        // Авторизация
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_role'] = $user['user_role'] ?? USER_ROLE_USER;

        // Убираем хеш пароля из ответа
        unset($user['user_password_hash']);

        return $user;
    }

    public function logout(): void {
        $_SESSION = [];

        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }

        session_destroy();
    }

    public function get_current_session(): array {
        $user_id = $_SESSION['user_id'] ?? null;
        $user = null;

        if ($user_id !== null) {
            $user = $this->_user_repository->find_by_id((int) $user_id);

            // Если пользователь не найден в БД или заблокирован — очищаем сессию
            if ($user === null || !empty($user['is_blocked'])) {
                unset($_SESSION['user_id']);
                unset($_SESSION['user_role']);
                $user = null;
            } else {
                // Обновляем роль в сессии (могла измениться через админку)
                $_SESSION['user_role'] = $user['user_role'] ?? USER_ROLE_USER;
            }
        }

        return [
            'is_authenticated' => $user !== null,
            'user'             => $user,
            'csrf_token'       => $_SESSION['csrf_token'] ?? '',
        ];
    }

    // ПРОФИЛЬ  //

    public function get_profile(int $user_id): array {
        $user = $this->_user_repository->find_by_id($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        $user['summary'] = $this->get_profile_summary($user_id);
        return $user;
    }

    public function get_profile_summary(int $user_id): array {
        $library_repository = new LibraryRepository();
        $friend_repository  = new FriendRepository();
        $club_repository    = new ClubRepository();
        $social_repository  = new SocialRepository();

        return [
            'books_count'        => $library_repository->count_unique_books_on_shelf($user_id),
            'collections_count'  => $library_repository->count_user_libraries($user_id),
            'friends_count'      => $friend_repository->count_friends($user_id),
            'clubs_count'        => $club_repository->count_clubs_by_user($user_id),
            'publications_count' => $social_repository->count_publications_by_user($user_id),
        ];
    }

    public function get_public_profile(int $target_user_id): array {
        $user = $this->_user_repository->find_by_id($target_user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if (!empty($user['is_profile_hidden'])) {
            throw new RuntimeException('Профиль скрыт');
        }

        // Возвращаем только публичные поля (включая настройки приватности,
        // чтобы фронтенд знал, какие блоки скрывать)
        return [
            'id'                      => $user['id'],
            'user_name_first'         => $user['user_name_first'],
            'user_name_last'          => $user['user_name_last'],
            'user_avatar_path'        => $user['user_avatar_path'],
            'user_profile_identifier' => $user['user_profile_identifier'],
            'user_bio'                => $user['user_bio'],
            'user_location'           => $user['user_location'],
            'user_status'             => $user['user_status'],
            'is_profile_hidden'       => $user['is_profile_hidden'],
            'is_stats_hidden'         => $user['is_stats_hidden'],
            'is_plant_hidden'         => $user['is_plant_hidden'],
            'time_created'            => $user['time_created'],
            'is_library_hidden'       => $user['is_library_hidden'],
            'is_collections_hidden'   => $user['is_collections_hidden'],
            'summary'                 => $this->get_public_profile_summary($target_user_id, $user),
        ];
    }

    public function get_public_profile_summary(int $user_id, array $user): array {
        $library_repository = new LibraryRepository();
        $friend_repository  = new FriendRepository();
        $club_repository    = new ClubRepository();
        $social_repository  = new SocialRepository();

        return [
            'books_count'        => !empty($user['is_library_hidden'])
                ? null
                : $library_repository->count_public_unique_books_on_shelf($user_id),
            'collections_count'  => !empty($user['is_collections_hidden'])
                ? null
                : $library_repository->count_public_libraries_by_user($user_id),
            'friends_count'      => $friend_repository->count_friends($user_id),
            'clubs_count'        => $club_repository->count_clubs_by_user($user_id),
            'publications_count' => $social_repository->count_publications_by_user($user_id),
        ];
    }

    public function update_profile(int $user_id, array $data): array {
        // Проверка уникальности profile_identifier
        if (!empty($data['user_profile_identifier'])) {
            $is_taken = $this->_user_repository->exists_by_profile_identifier(
                $data['user_profile_identifier'],
                $user_id
            );

            if ($is_taken) {
                throw new RuntimeException('Этот идентификатор профиля уже занят');
            }
        }

        $this->_user_repository->update_profile($user_id, $data);

        return $this->_user_repository->find_by_id($user_id);
    }

    public function change_password(int $user_id, string $current_password, string $new_password): void {
        $user = $this->_user_repository->find_by_id_with_password($user_id);

        if ($user === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        if (!empty($user['is_blocked'])) {
            throw new RuntimeException('Ваш аккаунт заблокирован');
        }

        if (!password_verify($current_password, $user['user_password_hash'])) {
            throw new RuntimeException('Текущий пароль указан неверно');
        }

        if (password_verify($new_password, $user['user_password_hash'])) {
            throw new RuntimeException('Новый пароль должен отличаться от текущего');
        }

        $password_hash = password_hash($new_password, PASSWORD_BCRYPT);
        $this->_user_repository->update_password($user_id, $password_hash);
    }

    public function upload_avatar(int $user_id, array $file): array {
        // Валидация файла
        $validation_errors = validate_uploaded_image($file);

        if (!empty($validation_errors)) {
            throw new RuntimeException(reset($validation_errors));
        }

        // Удаление старого аватара
        $current_user = $this->_user_repository->find_by_id($user_id);
        if ($current_user !== null) {
            delete_uploaded_file($current_user['user_avatar_path']);
        }

        // Сохранение нового
        $avatar_url = save_uploaded_image($file, AVATARS_PATH, AVATARS_URL);

        // Обновление в БД
        $this->_user_repository->update_avatar($user_id, $avatar_url);

        return $this->_user_repository->find_by_id($user_id);
    }

    //  ПОИСК  //

    public function search_users(string $query, int $page, int $per_page, int $current_user_id = 0): array {
        $items = $this->_user_repository->search_users($query, $page, $per_page, $current_user_id);
        $items = array_map([$this, 'normalize_search_user'], $items);
        $total_count = $this->_user_repository->count_search_results($query);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    private function normalize_search_user(array $user): array {
        $request_id = $user['friendship_request_id'] ?? null;

        $user['id'] = (int) $user['id'];
        $user['books_count'] = (int) ($user['books_count'] ?? 0);
        $user['friends_count'] = (int) ($user['friends_count'] ?? 0);
        $user['publications_count'] = (int) ($user['publications_count'] ?? 0);
        $user['friendship_status'] = $user['friendship_status'] ?? 'none';
        $user['friendship_request_id'] = $request_id === null ? null : (int) $request_id;
        $user['friendship'] = [
            'status'     => $user['friendship_status'],
            'request_id' => $user['friendship_request_id'],
        ];

        return $user;
    }
}
