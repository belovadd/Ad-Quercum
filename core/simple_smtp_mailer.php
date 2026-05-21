<?php
/**
 *  SimpleSmtpMailer — минимальная SMTP-отправка писем
 *
 * НАЗНАЧЕНИЕ:
 *   Отправляет простые текстовые письма через SMTP без внешних библиотек.
 *   Используется для отключаемого подтверждения email при регистрации.
 */

// 1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../config/constants.php';

//  2. КЛАСС SimpleSmtpMailer  //

class SimpleSmtpMailer {

    /** @var resource|null SMTP-сокет. */
    private $_socket = null;

    
    public function send(string $to_email, string $subject, string $body): void {
        $this->connect();

        try {
            $this->command('EHLO ' . APP_CANONICAL_HOST, [250]);

            if (SMTP_ENCRYPTION === 'tls') {
                $this->command('STARTTLS', [220]);
                if (!stream_socket_enable_crypto($this->_socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    throw new RuntimeException('Не удалось включить TLS для SMTP');
                }
                $this->command('EHLO ' . APP_CANONICAL_HOST, [250]);
            }

            if (SMTP_USERNAME !== '') {
                $this->command('AUTH LOGIN', [334]);
                $this->command(base64_encode(SMTP_USERNAME), [334]);
                $this->command(base64_encode(SMTP_PASSWORD), [235]);
            }

            $this->command('MAIL FROM:<' . SMTP_FROM_EMAIL . '>', [250]);
            $this->command('RCPT TO:<' . $to_email . '>', [250, 251]);
            $this->command('DATA', [354]);
            $this->write($this->build_message($to_email, $subject, $body) . "\r\n.");
            $this->read([250]);
            $this->command('QUIT', [221]);
        } finally {
            $this->close();
        }
    }

    private function connect(): void {
        $scheme = SMTP_ENCRYPTION === 'ssl' ? 'ssl://' : '';
        $this->_socket = @fsockopen(
            $scheme . SMTP_HOST,
            SMTP_PORT,
            $error_code,
            $error_message,
            SMTP_TIMEOUT_SECONDS
        );

        if (!$this->_socket) {
            throw new RuntimeException('SMTP недоступен: ' . $error_message . ' (' . $error_code . ')');
        }

        stream_set_timeout($this->_socket, SMTP_TIMEOUT_SECONDS);
        $this->read([220]);
    }

    private function build_message(string $to_email, string $subject, string $body): string {
        $encoded_subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
        $encoded_from_name = '=?UTF-8?B?' . base64_encode(SMTP_FROM_NAME) . '?=';

        $headers = [
            'From: ' . $encoded_from_name . ' <' . SMTP_FROM_EMAIL . '>',
            'To: <' . $to_email . '>',
            'Subject: ' . $encoded_subject,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        return implode("\r\n", $headers) . "\r\n\r\n" . str_replace("\n.", "\n..", $body);
    }

    private function command(string $command, array $expected_codes): string {
        $this->write($command);
        return $this->read($expected_codes);
    }

    private function write(string $line): void {
        fwrite($this->_socket, $line . "\r\n");
    }

    private function read(array $expected_codes): string {
        $response = '';

        while (($line = fgets($this->_socket, 512)) !== false) {
            $response .= $line;
            if (isset($line[3]) && $line[3] === ' ') {
                break;
            }
        }

        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expected_codes, true)) {
            throw new RuntimeException('SMTP вернул неожиданный ответ: ' . trim($response));
        }

        return $response;
    }

    private function close(): void {
        if (is_resource($this->_socket)) {
            fclose($this->_socket);
        }
        $this->_socket = null;
    }
}
