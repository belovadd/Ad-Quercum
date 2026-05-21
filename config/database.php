<?php
/**
 * Параметры подключения к базе данных MariaDB ==
 * 
 * НАЗНАЧЕНИЕ:
 * Хранит параметры подключения, DSN и PDO-опции для единого подключения приложения
 * к MariaDB/MySQL.
 */

//  1. ПАРАМЕТРЫ ПОДКЛЮЧЕНИЯ  //

define('DB_HOST', 'localhost');
define('DB_PORT', 3306);
define('DB_NAME', 'ad-quercum');
define('DB_USER', 'ad-quercum');
define('DB_PASSWORD', 'password');
define('DB_CHARSET', 'utf8mb4');

//  2. DSN И ОПЦИИ PDO //

define('DB_DSN', 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET);

// PDO::MYSQL_ATTR_INIT_COMMAND deprecated в PHP 8.5+ → Pdo\Mysql::ATTR_INIT_COMMAND.
// Используем Pdo\Mysql если доступен (PHP ≥8.4), иначе fallback на старую константу.
$_aq_init_command_key = class_exists('Pdo\\Mysql') && defined('Pdo\\Mysql::ATTR_INIT_COMMAND')
    ? \Pdo\Mysql::ATTR_INIT_COMMAND
    : PDO::MYSQL_ATTR_INIT_COMMAND;

define('DB_OPTIONS', [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    $_aq_init_command_key        => "SET NAMES '" . DB_CHARSET . "' COLLATE 'utf8mb4_unicode_ci'",
]);

unset($_aq_init_command_key);
