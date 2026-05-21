<?php
/**
 * Singleton-подключение к базе данных через PDO
 *
 * НАЗНАЧЕНИЕ:
 * Единственная точка получения PDO-соединения.
 * Гарантирует одно подключение на запрос (Singleton).
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/database.php';

// 2. ЕДИНСТВЕННОЕ PDO-ПОДКЛЮЧЕНИЕ  //

/** @var PDO|null Единственный экземпляр PDO-соединения. */
$_database_instance = null;


function get_database_connection(): PDO {
    global $_database_instance;

    if ($_database_instance === null) {
        $_database_instance = new PDO(DB_DSN, DB_USER, DB_PASSWORD, DB_OPTIONS);
    }

    return $_database_instance;
}
