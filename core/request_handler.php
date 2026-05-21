<?php
/**
 *  Обработка HTTP-запросов — методы, авторизация, маршрутизация 
 *
 * НАЗНАЧЕНИЕ:
 * Утилиты для API-контроллеров: проверка метода, аутентификация,
 * чтение JSON-тела, маршрутизация по action.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/response_builder.php';
require_once __DIR__ . '/csrf_protector.php';

//  2. ПРОВЕРКА HTTP-МЕТОДА  //

function require_method($allowed_methods): void {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if (is_string($allowed_methods)) {
        $allowed_methods = [$allowed_methods];
    }

    if (!in_array($method, $allowed_methods, true)) {
        send_error_response('Метод ' . $method . ' не разрешён', 400);
    }

    // CSRF-проверка при POST
    if ($method === 'POST') {
        verify_csrf_token();
    }
}

//  3. АУТЕНТИФИКАЦИЯ  //

function require_authentication(): int {
    if (empty($_SESSION['user_id'])) {
        send_error_response('Необходима авторизация', 401);
    }

    return (int) $_SESSION['user_id'];
}

function get_current_user_id(): ?int {
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function get_current_user_role(): string {
    return $_SESSION['user_role'] ?? USER_ROLE_USER;
}

//  3.1. ПРОВЕРКА РОЛЕЙ //

function require_role(array $allowed_roles): int {
    $user_id = require_authentication();

    $role = get_current_user_role();

    if (!in_array($role, $allowed_roles, true)) {
        send_error_response('Недостаточно прав для выполнения действия', 403);
    }

    return $user_id;
}

function require_admin(): int {
    return require_role([USER_ROLE_ADMIN]);
}

function require_moderator(): int {
    return require_role([USER_ROLE_ADMIN, USER_ROLE_MODERATOR]);
}

//  4. ЧТЕНИЕ JSON-ТЕЛА  //

function get_json_input(): array {
    static $cached = null;

    if ($cached !== null) {
        return $cached;
    }

    $raw = file_get_contents('php://input');

    if (empty($raw)) {
        $cached = [];
        return $cached;
    }

    $data = json_decode($raw, true);

    if (!is_array($data)) {
        $cached = [];
        return $cached;
    }

    $cached = $data;
    return $cached;
}

//  5. ОПРЕДЕЛЕНИЕ ACTION  //

function get_action(): string {
    // Сначала из GET-параметра
    if (!empty($_GET['action'])) {
        return trim($_GET['action']);
    }

    // Затем из multipart/form-data или обычной формы
    if (!empty($_POST['action'])) {
        return trim((string) $_POST['action']);
    }

    // Затем из JSON-тела
    $input = get_json_input();
    if (!empty($input['action'])) {
        return trim($input['action']);
    }

    return '';
}

//  6. МАРШРУТИЗАЦИЯ  //

function route_action(array $routes): void {
    $action = get_action();

    if (empty($action)) {
        send_error_response('Не указано действие (action)', 400);
    }

    if (!isset($routes[$action])) {
        send_error_response('Неизвестное действие: ' . $action, 400);
    }

    $handler = $routes[$action];
    $handler();
}
