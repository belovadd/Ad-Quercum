<?php
/**
 *  Валидация пользовательского ввода 
 *
 * НАЗНАЧЕНИЕ:
 * Функции валидации строк, чисел, email, паролей и других данных.
 * Используются в API-контроллерах перед передачей в сервисы.
 * Ошибки накапливаются в массиве $errors для отправки клиенту.
 */

require_once __DIR__ . '/../config/constants.php';

//  1. СТРОКИ  //


function validate_required_string(array $input, string $field, int $max_length, array &$errors): string {
    $value = trim($input[$field] ?? '');

    if ($value === '') {
        $errors[$field] = 'Поле обязательно для заполнения';
        return '';
    }

    if (mb_strlen($value) > $max_length) {
        $errors[$field] = 'Максимальная длина: ' . $max_length . ' символов';
        return '';
    }

    return $value;
}

function validate_optional_string(array $input, string $field, int $max_length, array &$errors): ?string {
    if (!isset($input[$field]) || trim($input[$field]) === '') {
        return null;
    }

    $value = trim($input[$field]);

    if (mb_strlen($value) > $max_length) {
        $errors[$field] = 'Максимальная длина: ' . $max_length . ' символов';
        return null;
    }

    return $value;
}

function validate_optional_text(array $input, string $field, array &$errors, int $max_length = DEFAULT_TEXT_MAX_LENGTH): ?string {
    if (!isset($input[$field]) || trim($input[$field]) === '') {
        return null;
    }

    $value = trim($input[$field]);

    if (mb_strlen($value) > $max_length) {
        $errors[$field] = 'Максимальная длина: ' . $max_length . ' символов';
        return null;
    }

    return $value;
}

function validate_required_text(array $input, string $field, array &$errors, int $max_length = DEFAULT_TEXT_MAX_LENGTH): string {
    $value = trim($input[$field] ?? '');

    if ($value === '') {
        $errors[$field] = 'Поле обязательно для заполнения';
        return '';
    }

    if (mb_strlen($value) > $max_length) {
        $errors[$field] = 'Максимальная длина: ' . $max_length . ' символов';
        return '';
    }

    return $value;
}

//  2. ЭЛЕКТРОННАЯ ПОЧТА  //

function validate_email(array $input, array &$errors): string {
    $email = trim($input['user_email'] ?? '');
    $email = mb_strtolower($email);

    if ($email === '') {
        $errors['user_email'] = 'Email обязателен';
        return '';
    }

    if (mb_strlen($email) > MAX_EMAIL_LENGTH) {
        $errors['user_email'] = 'Email слишком длинный';
        return '';
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors['user_email'] = 'Некорректный формат email';
        return '';
    }

    return $email;
}

//  3. ПАРОЛЬ  //

function validate_password(array $input, array &$errors): string {
    $password = $input['password'] ?? '';

    if ($password === '') {
        $errors['password'] = 'Пароль обязателен';
        return '';
    }

    if (mb_strlen($password) < MIN_PASSWORD_LENGTH) {
        $errors['password'] = 'Минимальная длина пароля: ' . MIN_PASSWORD_LENGTH . ' символов';
        return '';
    }

    if (mb_strlen($password) > MAX_PASSWORD_LENGTH) {
        $errors['password'] = 'Максимальная длина пароля: ' . MAX_PASSWORD_LENGTH . ' символов';
        return '';
    }

    return $password;
}

//  4. ЧИСЛА  //

function validate_required_int(array $input, string $field, int $min, int $max, array &$errors): int {
    if (!isset($input[$field]) || $input[$field] === '') {
        $errors[$field] = 'Поле обязательно';
        return 0;
    }

    $value = filter_var($input[$field], FILTER_VALIDATE_INT);

    if ($value === false) {
        $errors[$field] = 'Значение должно быть целым числом';
        return 0;
    }

    if ($value < $min || $value > $max) {
        $errors[$field] = 'Допустимый диапазон: ' . $min . '–' . $max;
        return 0;
    }

    return $value;
}

function validate_optional_int(array $input, string $field, int $min, int $max, array &$errors): ?int {
    if (!isset($input[$field]) || $input[$field] === '') {
        return null;
    }

    $value = filter_var($input[$field], FILTER_VALIDATE_INT);

    if ($value === false) {
        $errors[$field] = 'Значение должно быть целым числом';
        return null;
    }

    if ($value < $min || $value > $max) {
        $errors[$field] = 'Допустимый диапазон: ' . $min . '–' . $max;
        return null;
    }

    return $value;
}

//  5. ПЕРЕЧИСЛЕНИЯ  //

function validate_enum(array $input, string $field, array $allowed, array &$errors): string {
    $value = trim($input[$field] ?? '');

    if ($value === '') {
        $errors[$field] = 'Поле обязательно';
        return '';
    }

    if (!in_array($value, $allowed, true)) {
        $errors[$field] = 'Недопустимое значение';
        return '';
    }

    return $value;
}

//  6. ПАГИНАЦИЯ  //

function validate_pagination(): array {
    $page = filter_var($_GET['page'] ?? PAGINATION_DEFAULT_PAGE, FILTER_VALIDATE_INT);
    $per_page = filter_var($_GET['per_page'] ?? PAGINATION_DEFAULT_PER_PAGE, FILTER_VALIDATE_INT);

    if ($page === false || $page < 1) {
        $page = PAGINATION_DEFAULT_PAGE;
    }

    if ($per_page === false || $per_page < 1) {
        $per_page = PAGINATION_DEFAULT_PER_PAGE;
    }

    if ($per_page > PAGINATION_MAX_PER_PAGE) {
        $per_page = PAGINATION_MAX_PER_PAGE;
    }

    return [
        'page'     => $page,
        'per_page' => $per_page,
    ];
}
