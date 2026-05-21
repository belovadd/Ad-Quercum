<?php
/**
 *  Инициализация и настройка PHP-сессий 
 *
 * НАЗНАЧЕНИЕ:
 * Настраивает безопасные параметры cookie-сессии и гарантирует наличие CSRF-токена
 * для API-запросов текущего пользователя.
 */

require_once __DIR__ . '/constants.php';

//  1. НАСТРОЙКИ СЕССИИ  //

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? '1' : '0');
    ini_set('session.cookie_samesite', 'Strict');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');

    session_start();
}

//  2. ГЕНЕРАЦИЯ CSRF-ТОКЕНА  //

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(CSRF_TOKEN_BYTES));
}
