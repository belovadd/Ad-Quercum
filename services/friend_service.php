<?php
/**
 *  СЕРВИС: FriendService — Бизнес-логика дружбы 
 *
 * НАЗНАЧЕНИЕ:
 * Бизнес-логика отправки/принятия/отклонения/отмены запросов дружбы,
 * удаления друзей, получения списков и статуса дружбы.
 * Не работает с HTTP напрямую.
 */

//  1. ПОДКЛЮЧЕНИЕ ЗАВИСИМОСТЕЙ  //

require_once __DIR__ . '/../repositories/friend_repository.php';
require_once __DIR__ . '/../repositories/user_repository.php';
require_once __DIR__ . '/../config/constants.php';
require_once __DIR__ . '/../core/pagination_helper.php';

//  2. КЛАСС FriendService  //

class FriendService {

    private FriendRepository $_friend_repository;
    private UserRepository $_user_repository;

    public function __construct() {
        $this->_friend_repository = new FriendRepository();
        $this->_user_repository = new UserRepository();
    }

    //  ОТПРАВКА ЗАПРОСА  //

    public function send_request(int $sender_id, int $receiver_id): array {
        // Нельзя отправить запрос себе
        if ($sender_id === $receiver_id) {
            throw new RuntimeException('Нельзя отправить запрос дружбы самому себе');
        }

        // Получатель должен существовать
        $receiver = $this->_user_repository->find_by_id($receiver_id);
        if ($receiver === null) {
            throw new RuntimeException('Пользователь не найден');
        }

        // Уже друзья?
        if ($this->_friend_repository->exists_friendship($sender_id, $receiver_id)) {
            throw new RuntimeException('Вы уже друзья с этим пользователем');
        }

        // Уже есть pending запрос?
        $existing = $this->_friend_repository->find_request_between_users($sender_id, $receiver_id);
        if ($existing !== null) {
            throw new RuntimeException('Запрос дружбы уже существует');
        }

        // Лимит друзей
        $friends_count = $this->_friend_repository->count_friends($sender_id);
        if ($friends_count >= MAX_FRIENDS_PER_USER) {
            throw new RuntimeException('Достигнут лимит друзей (' . MAX_FRIENDS_PER_USER . ')');
        }

        // Переиспользуем старый обработанный запрос в том же направлении.
        $old_request = $this->_friend_repository->find_request_by_users($sender_id, $receiver_id);
        if ($old_request !== null) {
            $this->_friend_repository->reactivate_request((int) $old_request['id']);

            $reactivated_request = $this->_friend_repository->find_request_by_id((int) $old_request['id']);
            if ($reactivated_request === null) {
                throw new RuntimeException('Не удалось повторно открыть запрос дружбы');
            }

            return $reactivated_request;
        }

        // Создаём запрос
        $request_id = $this->_friend_repository->insert_request($sender_id, $receiver_id);

        return $this->_friend_repository->find_request_by_id($request_id);
    }

    //  ПРИНЯТИЕ / ОТКЛОНЕНИЕ / ОТМЕНА  //

    public function accept_request(int $user_id, int $request_id): void {
        $request = $this->validate_request_for_receiver($user_id, $request_id);

        $this->_friend_repository->update_request_status($request_id, FRIEND_REQUEST_ACCEPTED);
        $this->_friend_repository->insert_friendship_pair(
            $request['user_id_sender'],
            $request['user_id_receiver']
        );
    }

    public function reject_request(int $user_id, int $request_id): void {
        $this->validate_request_for_receiver($user_id, $request_id);

        $this->_friend_repository->delete_request($request_id);
    }

    public function cancel_request(int $user_id, int $request_id): void {
        $request = $this->find_pending_request($request_id);

        if ((int) $request['user_id_sender'] !== $user_id) {
            throw new RuntimeException('Вы не являетесь отправителем этого запроса');
        }

        $this->_friend_repository->delete_request($request_id);
    }

    //  УДАЛЕНИЕ ДРУГА  //

    public function remove_friend(int $user_id, int $friend_id): void {
        if (!$this->_friend_repository->exists_friendship($user_id, $friend_id)) {
            throw new RuntimeException('Этот пользователь не в вашем списке друзей');
        }

        $this->_friend_repository->delete_friendship_pair($user_id, $friend_id);
    }

    //  СПИСКИ  //

    public function get_friends(int $user_id, int $page, int $per_page): array {
        $items = $this->_friend_repository->find_friends($user_id, $page, $per_page);
        $total_count = $this->_friend_repository->count_friends($user_id);

        return build_pagination_payload($items, $total_count, $page, $per_page);
    }

    public function get_incoming_requests(int $user_id): array {
        return $this->_friend_repository->find_incoming_requests($user_id);
    }

    public function get_outgoing_requests(int $user_id): array {
        return $this->_friend_repository->find_outgoing_requests($user_id);
    }

    // СТАТУС ДРУЖБЫ  //

    public function get_friendship_status(int $user_id, int $other_user_id): array {
        // Проверка на себя
        if ($user_id === $other_user_id) {
            return ['status' => 'self', 'request_id' => null];
        }

        // Уже друзья?
        if ($this->_friend_repository->exists_friendship($user_id, $other_user_id)) {
            return ['status' => 'friends', 'request_id' => null];
        }

        // Есть pending запрос?
        $request = $this->_friend_repository->find_request_between_users($user_id, $other_user_id);

        if ($request !== null) {
            $is_sender = (int) $request['user_id_sender'] === $user_id;

            return [
                'status'     => $is_sender ? 'request_sent' : 'request_received',
                'request_id' => (int) $request['id'],
            ];
        }

        return ['status' => 'none', 'request_id' => null];
    }

    // ВСПОМОГАТЕЛЬНЫЕ ПРИВАТНЫЕ МЕТОДЫ //

    private function find_pending_request(int $request_id): array {
        $request = $this->_friend_repository->find_request_by_id($request_id);

        if ($request === null) {
            throw new RuntimeException('Запрос дружбы не найден');
        }

        if ($request['request_status'] !== FRIEND_REQUEST_PENDING) {
            throw new RuntimeException('Запрос дружбы уже обработан');
        }

        return $request;
    }

    private function validate_request_for_receiver(int $user_id, int $request_id): array {
        $request = $this->find_pending_request($request_id);

        if ((int) $request['user_id_receiver'] !== $user_id) {
            throw new RuntimeException('Вы не являетесь получателем этого запроса');
        }

        return $request;
    }
}
