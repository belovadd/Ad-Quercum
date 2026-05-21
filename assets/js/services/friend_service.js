/**
 *  СЕРВИС: FriendService — API-вызовы системы дружбы 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к API friends.php: запросы дружбы, управление друзьями,
 * получение списков и статуса дружбы. Использует ApiClient.
 */

//  1. КЛАСС FriendService  //

class FriendService {

    static async sendRequest(receiverId) {
        return await ApiClient.request('friends.php', 'POST', {
            action: 'send_request',
            receiver_id: receiverId,
        });
    }

    static async acceptRequest(requestId) {
        return await ApiClient.request('friends.php', 'POST', {
            action: 'accept_request',
            request_id: requestId,
        });
    }

    static async rejectRequest(requestId) {
        return await ApiClient.request('friends.php', 'POST', {
            action: 'reject_request',
            request_id: requestId,
        });
    }

    static async cancelRequest(requestId) {
        return await ApiClient.request('friends.php', 'POST', {
            action: 'cancel_request',
            request_id: requestId,
        });
    }

    static async removeFriend(friendId) {
        return await ApiClient.request('friends.php', 'POST', {
            action: 'remove_friend',
            friend_id: friendId,
        });
    }

    static async getFriends(page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_friends',
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('friends.php?' + params, 'GET');
    }

    static async getIncomingRequests() {
        return await ApiClient.request('friends.php?action=get_incoming', 'GET');
    }

    static async getOutgoingRequests() {
        return await ApiClient.request('friends.php?action=get_outgoing', 'GET');
    }

    static async getFriendshipStatus(userId) {
        return await ApiClient.request('friends.php?action=get_status&user_id=' + userId, 'GET');
    }
}
