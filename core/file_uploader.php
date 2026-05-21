<?php
/**
 *  Загрузка и валидация файлов 
 *
 * НАЗНАЧЕНИЕ:
 * Безопасная загрузка изображений (аватары, обложки книг, изображения клубов).
 * Проверка MIME-типа, размера, расширения. Переименование файлов.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/response_builder.php';

//  2. ВАЛИДАЦИЯ ЗАГРУЖЕННОГО ФАЙЛА  //

function validate_uploaded_image(array $file): array {
    $errors = [];

    // Проверка наличия файла
    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        $errors['file'] = 'Файл не загружен';
        return $errors;
    }

    // Проверка ошибок загрузки
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errors['file'] = 'Ошибка при загрузке файла';
        return $errors;
    }

    // Проверка размера
    if ($file['size'] > MAX_UPLOAD_SIZE_BYTES) {
        $max_mb = MAX_UPLOAD_SIZE_BYTES / 1048576;
        $errors['file'] = 'Максимальный размер файла: ' . $max_mb . ' МБ';
        return $errors;
    }

    // Проверка MIME через finfo
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime_type = $finfo->file($file['tmp_name']);

    if (!in_array($mime_type, ALLOWED_IMAGE_TYPES, true)) {
        $errors['file'] = 'Допустимые форматы: JPG, PNG, WebP';
        return $errors;
    }

    // Проверка расширения
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (!in_array($extension, ALLOWED_IMAGE_EXTENSIONS, true)) {
        $errors['file'] = 'Недопустимое расширение файла';
        return $errors;
    }

    return $errors;
}

//  3. СОХРАНЕНИЕ ФАЙЛА  //

function save_uploaded_image(array $file, string $target_dir, string $url_prefix): string {
    // Создание директории, если не существует
    if (!is_dir($target_dir)) {
        mkdir($target_dir, 0755, true);
    }

    // Определение расширения по MIME
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime_type = $finfo->file($file['tmp_name']);

    $mime_to_ext = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    $extension = $mime_to_ext[$mime_type] ?? 'jpg';

    // Генерация уникального имени
    $filename = uniqid('img_', true) . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
    $filepath = $target_dir . '/' . $filename;

    // Перемещение файла
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        send_error_response('Ошибка сохранения файла', 500);
    }

    return $url_prefix . '/' . $filename;
}

//  4. УДАЛЕНИЕ ФАЙЛА  //

function delete_uploaded_file(?string $file_url): void {
    if ($file_url === null || $file_url === '') {
        return;
    }

    // Не удаляем дефолтные изображения
    if (strpos($file_url, '/assets/images/') !== false) {
        return;
    }

    // Убираем WEB_ROOT префикс для получения локального пути
    $local_url = $file_url;
    if (WEB_ROOT !== '' && strpos($file_url, WEB_ROOT) === 0) {
        $local_url = substr($file_url, strlen(WEB_ROOT));
    }

    $filepath = BASE_PATH . $local_url;

    if (is_file($filepath)) {
        unlink($filepath);
    }
}
