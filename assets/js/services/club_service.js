/**
 *  СЕРВИС: ClubService — API-вызовы системы клубов 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к API clubs.php: CRUD клубов, управление участниками,
 * поиск, загрузка изображений. Использует ApiClient.
 */

//  1. КЛАСС ClubService  //

class ClubService {

    // CRUD //

    static async createClub(data) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'create',
            ...data,
        });
    }

    static async getClub(clubId) {
        return await ApiClient.request('clubs.php?action=get&club_id=' + clubId, 'GET');
    }

    static async updateClub(clubId, data) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'update',
            club_id: clubId,
            ...data,
        });
    }

    static async deleteClub(clubId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'delete',
            club_id: clubId,
        });
    }

    static async uploadImage(clubId, file) {
        const formData = new FormData();
        formData.append('club_id', clubId);
        formData.append('club_image', file);
        return await ApiClient.upload('clubs.php?action=upload_image', formData);
    }

    //  УЧАСТНИКИ //

    static async joinClub(clubId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'join',
            club_id: clubId,
        });
    }

    static async requestJoinClub(clubId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'request_join',
            club_id: clubId,
        });
    }

    static async getJoinRequests(clubId) {
        const params = new URLSearchParams({
            action: 'get_join_requests',
            club_id: clubId,
        });
        return await ApiClient.request('clubs.php?' + params, 'GET');
    }

    static async getMyJoinRequests() {
        return await ApiClient.request('clubs.php?action=get_my_join_requests', 'GET');
    }

    static async acceptJoinRequest(requestId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'accept_join_request',
            request_id: requestId,
        });
    }

    static async rejectJoinRequest(requestId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'reject_join_request',
            request_id: requestId,
        });
    }

    static async cancelJoinRequest(requestId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'cancel_join_request',
            request_id: requestId,
        });
    }

    static async leaveClub(clubId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'leave',
            club_id: clubId,
        });
    }

    static async removeMember(clubId, userId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'remove_member',
            club_id: clubId,
            user_id: userId,
        });
    }

    static async changeRole(clubId, userId, role) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'change_role',
            club_id: clubId,
            user_id: userId,
            role: role,
        });
    }

    //  СПИСКИ  //

    static async getMembers(clubId, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_members',
            club_id: clubId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('clubs.php?' + params, 'GET');
    }

    static async getMyClubs(page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_my_clubs',
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('clubs.php?' + params, 'GET');
    }

    static async getCatalogClubs(filter = CLUB_CATALOG_FILTER.ALL, query = '', page = 1, perPage = CLUB_CATALOG_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_all',
            filter: filter,
            page: page,
            per_page: perPage,
        });

        if (query) {
            params.append('query', query);
        }

        return await ApiClient.request('clubs.php?' + params, 'GET');
    }

    static async searchClubs(query, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'search',
            query: query,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('clubs.php?' + params, 'GET');
    }

    // ПУБЛИКАЦИИ  //

    static async createClubPublication(clubId, publicationText, bookId = null) {
        const body = {
            action: 'create_publication',
            club_id: clubId,
            publication_text: publicationText,
        };

        if (bookId !== null) {
            body.book_id = bookId;
        }

        return await ApiClient.request('clubs.php', 'POST', body);
    }

    static async getClubPublications(clubId, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_publications',
            club_id: clubId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('clubs.php?' + params.toString(), 'GET');
    }

    static async deleteClubPublication(publicationId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'delete_publication',
            publication_id: publicationId,
        });
    }

    // КОММЕНТАРИИ  //

    static async createClubComment(publicationId, commentText) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'create_comment',
            publication_id: publicationId,
            comment_text: commentText,
        });
    }

    static async getClubComments(publicationId, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get_comments',
            publication_id: publicationId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('clubs.php?' + params.toString(), 'GET');
    }

    static async deleteClubComment(commentId) {
        return await ApiClient.request('clubs.php', 'POST', {
            action: 'delete_comment',
            comment_id: commentId,
        });
    }
}
