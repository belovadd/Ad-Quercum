<?php
/**
 * Генерация и проверка CSRF-токенов.
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает CSRF-токен текущей сессии и проверяет заголовок
 *   `X-CSRF-Token` для POST-запросов.
 *
 */

// 1. ПОЛУЧЕНИЕ ТОКЕНА  //

function get_csrf_token(): string {
    return $_SESSION['csrf_token'] ?? '';
}

//  2. ПРОВЕРКА ТОКЕНА //

function verify_csrf_token(): void {
    $header_token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $session_token = $_SESSION['csrf_token'] ?? '';

    if (empty($header_token) || empty($session_token)) {
        send_error_response('CSRF-токен отсутствует', 403);
    }

    if (!hash_equals($session_token, $header_token)) {
        send_error_response('Недействительный CSRF-токен', 403);
    }
}
