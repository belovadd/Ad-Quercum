/**
 *  СЕРВИС: AdminService — API-вызовы админ-панели 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к `api/admin.php`. Покрывает: статистику, пользователей,
 * модерацию произведений, модерацию изданий, слияние дубликатов.
 */

class AdminService {

    // СТАТИСТИКА //

    static async getStatistics() {
        return await ApiClient.request('admin.php?action=get_statistics', 'GET');
    }

    static async getRecentActivity(limit = ADMIN_RECENT_ACTIVITY_DEFAULT_LIMIT) {
        return await ApiClient.request(
            'admin.php?action=get_recent_activity&limit=' + limit,
            'GET'
        );
    }

    //  ПОЛЬЗОВАТЕЛИ  //

    static async getUsers(params = {}) {
        const sp = new URLSearchParams({ action: 'get_users' });
        if (params.query) sp.set('query', params.query);
        if (params.role) sp.set('role', params.role);
        if (params.is_blocked !== undefined) {
            sp.set('is_blocked', params.is_blocked ? '1' : '0');
        }
        if (params.page) sp.set('page', params.page);
        if (params.per_page) sp.set('per_page', params.per_page);
        return await ApiClient.request('admin.php?' + sp, 'GET');
    }

    static async getUser(userId) {
        return await ApiClient.request(
            'admin.php?action=get_user&user_id=' + userId, 'GET'
        );
    }

    static async updateRole(userId, role) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'update_role',
            user_id: userId,
            role: role,
        });
    }

    static async updateUser(userId, data) {
        const payload = Object.assign({}, data || {}, {
            action: 'update_user',
            user_id: userId,
        });
        return await ApiClient.request('admin.php', 'POST', payload);
    }

    static async blockUser(userId, reason) {
        const payload = {
            action: 'block_user',
            user_id: userId,
        };
        if (reason !== undefined && reason !== null && reason !== '') {
            payload.reason = reason;
        }
        return await ApiClient.request('admin.php', 'POST', payload);
    }

    static async unblockUser(userId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'unblock_user',
            user_id: userId,
        });
    }

    static async deleteUser(userId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'delete_user',
            user_id: userId,
        });
    }

    static async uploadUserAvatar(userId, file) {
        const formData = new FormData();
        formData.append('action', 'upload_user_avatar');
        formData.append('user_id', userId);
        formData.append('avatar', file);
        return await ApiClient.upload('admin.php', formData);
    }

    static async removeUserAvatar(userId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'remove_user_avatar',
            user_id: userId,
        });
    }

    //  МОДЕРАЦИЯ ПРОИЗВЕДЕНИЙ  //

    static async getPendingBooks(page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        return await ApiClient.request(
            'admin.php?action=get_pending_books&page=' + page + '&per_page=' + perPage,
            'GET'
        );
    }

    static async getAllBooks(params = {}) {
        const sp = new URLSearchParams({ action: 'get_all_books' });
        if (params.query) sp.set('query', params.query);
        if (params.moderation_status) sp.set('moderation_status', params.moderation_status);
        if (params.page) sp.set('page', params.page);
        if (params.per_page) sp.set('per_page', params.per_page);
        return await ApiClient.request('admin.php?' + sp, 'GET');
    }

    static async getBookForAdmin(bookId) {
        return await ApiClient.request(
            'admin.php?action=get_book&book_id=' + bookId, 'GET'
        );
    }

    static async approveBook(bookId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'approve_book',
            book_id: bookId,
        });
    }

    static async rejectBook(bookId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'reject_book',
            book_id: bookId,
        });
    }

    static async mergeBook(sourceBookId, targetBookId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'merge_book',
            source_book_id: sourceBookId,
            target_book_id: targetBookId,
        });
    }

    static async listDuplicates(page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        return await ApiClient.request(
            'admin.php?action=list_duplicates&page=' + page + '&per_page=' + perPage,
            'GET'
        );
    }

    static async searchBooksForMerge(query, exclude) {
        return await ApiClient.request(
            'admin.php?action=search_books_for_merge'
            + '&query=' + encodeURIComponent(query)
            + '&exclude=' + exclude,
            'GET'
        );
    }

    // МОДЕРАЦИЯ ИЗДАНИЙ  //

    static async getPendingEditions(page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        return await ApiClient.request(
            'admin.php?action=get_pending_editions&page=' + page + '&per_page=' + perPage,
            'GET'
        );
    }

    static async getAllEditions(params = {}) {
        const sp = new URLSearchParams({ action: 'get_all_editions' });
        if (params.query) sp.set('query', params.query);
        if (params.moderation_status) sp.set('moderation_status', params.moderation_status);
        if (params.language) sp.set('language', params.language);
        if (params.type) sp.set('type', params.type);
        if (params.page) sp.set('page', params.page);
        if (params.per_page) sp.set('per_page', params.per_page);
        return await ApiClient.request('admin.php?' + sp, 'GET');
    }

    static async getEdition(editionId) {
        return await ApiClient.request(
            'admin.php?action=get_edition&edition_id=' + editionId, 'GET'
        );
    }

    static async approveEdition(editionId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'approve_edition',
            edition_id: editionId,
        });
    }

    static async rejectEdition(editionId) {
        return await ApiClient.request('admin.php', 'POST', {
            action: 'reject_edition',
            edition_id: editionId,
        });
    }
}
