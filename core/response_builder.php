<?php
/**
 *  Формирование JSON-ответов API.
 *
 * НАЗНАЧЕНИЕ:
 *   Формирует единый JSON-контракт API для успешных и ошибочных ответов.
 */

//  1. УСПЕШНЫЙ ОТВЕТ  //

function send_success_response($data = null, string $message = 'OK', int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'success' => true,
        'data'    => $data,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

//  2. ОТВЕТ С ОШИБКОЙ  //

function send_error_response(string $message, int $code = 400, ?array $errors = null): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');

    $response = [
        'success' => false,
        'data'    => null,
        'message' => $message,
    ];

    if ($errors !== null) {
        $response['errors'] = $errors;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

    exit;
}
