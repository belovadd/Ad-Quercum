/**
 *  СЕРВИС: SocialService — API-вызовы публикаций, комментариев и сообщений 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к API social.php: создание/удаление публикаций пользователей,
 * комментарии, личные сообщения. Использует ApiClient для отправки запросов.
 */

//  1. КЛАСС SocialService //

class SocialService {

    // ПУБЛИКАЦИИ  //

    static async createPublication(publicationText, bookId = null) {
        const body = {
            action: 'create_publication',
            publication_text: publicationText,
        };

        if (bookId !== null) {
            body.book_id = bookId;
        }

        return await ApiClient.request('social.php', 'POST', body);
    }

    static async getPublication(publicationId) {
        return await ApiClient.request(
            'social.php?action=get_publication&publication_id=' + publicationId, 'GET'
        );
    }

    static async getUserPublications(userId, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_user_publications',
            user_id: userId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('social.php?' + params, 'GET');
    }

    static async deletePublication(publicationId) {
        return await ApiClient.request('social.php', 'POST', {
            action: 'delete_publication',
            publication_id: publicationId,
        });
    }

    //  КОММЕНТАРИИ  //

    static async createComment(publicationId, commentText) {
        return await ApiClient.request('social.php', 'POST', {
            action: 'create_comment',
            publication_id: publicationId,
            comment_text: commentText,
        });
    }

    static async getComments(publicationId, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_comments',
            publication_id: publicationId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('social.php?' + params, 'GET');
    }

    static async deleteComment(commentId) {
        return await ApiClient.request('social.php', 'POST', {
            action: 'delete_comment',
            comment_id: commentId,
        });
    }

    // СООБЩЕНИЯ  //

    static async sendMessage(receiverId, messageText) {
        return await ApiClient.request('social.php', 'POST', {
            action: 'send_message',
            receiver_id: receiverId,
            message_text: messageText,
        });
    }

    static async getConversations() {
        return await ApiClient.request('social.php?action=get_conversations', 'GET');
    }

    static async getMessages(partnerId, page = 1, perPage = MESSAGES_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_messages',
            partner_id: partnerId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('social.php?' + params, 'GET');
    }

    static async markRead(partnerId) {
        return await ApiClient.request('social.php', 'POST', {
            action: 'mark_read',
            partner_id: partnerId,
        });
    }

    static async getUnreadCount() {
        return await ApiClient.request('social.php?action=get_unread_count', 'GET');
    }
}
