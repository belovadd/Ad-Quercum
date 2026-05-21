/**
 * СЕРВИС: LibraryService — API-вызовы для коллекций и полки 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к `api/libraries.php`. Полка хранит **издания**
 * (`book_editions`), не абстрактные произведения.
 */

class LibraryService {

    //  КОЛЛЕКЦИИ (CRUD)  //

    static async createLibrary(data) {
        return await ApiClient.request('libraries.php', 'POST', {
            action: 'create',
            ...data,
        });
    }

    static async getUserLibraries() {
        return await ApiClient.request('libraries.php?action=get_all', 'GET');
    }

    static async getPublicLibraries(userId) {
        return await ApiClient.request(
            'libraries.php?action=get_public&user_id=' + userId, 'GET'
        );
    }

    static async getLibrary(libraryId, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'get',
            library_id: libraryId,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('libraries.php?' + params, 'GET');
    }

    static async updateLibrary(libraryId, data) {
        return await ApiClient.request('libraries.php', 'POST', {
            action: 'update',
            library_id: libraryId,
            ...data,
        });
    }

    static async deleteLibrary(libraryId) {
        return await ApiClient.request('libraries.php', 'POST', {
            action: 'delete',
            library_id: libraryId,
        });
    }

    // ИЗДАНИЯ В КОЛЛЕКЦИЯХ  //

    static async addEdition(libraryId, editionId) {
        return await ApiClient.request('libraries.php', 'POST', {
            action: 'add_edition',
            library_id: libraryId,
            edition_id: editionId,
        });
    }

    static async addEditionToShelf(editionId) {
        return await this.addEdition(null, editionId);
    }

    static async getEditionCollections(editionId) {
        return await ApiClient.request(
            'libraries.php?action=get_edition_collections&edition_id=' + editionId,
            'GET'
        );
    }

    static async removeEdition(libraryId, editionId) {
        return await ApiClient.request('libraries.php', 'POST', {
            action: 'remove_edition',
            library_id: libraryId,
            edition_id: editionId,
        });
    }

    static async removeEditionFromShelf(editionId) {
        return await ApiClient.request('libraries.php', 'POST', {
            action: 'remove_from_shelf',
            edition_id: editionId,
        });
    }

    // ПОИСК ПО ПОЛКЕ ПОЛЬЗОВАТЕЛЯ //

    static async searchUserLibrary(params = {}) {
        const sp = new URLSearchParams({ action: 'search' });

        if (params.query)    sp.set('query', params.query);
        if (params.status)   sp.set('status', params.status);
        if (params.genre)    sp.set('genre', params.genre);
        if (params.language) sp.set('language', params.language);
        sp.set('page', params.page || 1);
        sp.set('per_page', params.perPage || PAGINATION_DEFAULT_PER_PAGE);

        return await ApiClient.request('libraries.php?' + sp, 'GET');
    }

    static async searchPublicUserLibrary(userId, params = {}) {
        const sp = new URLSearchParams({
            action: 'search_public',
            user_id: userId,
        });

        if (params.query)    sp.set('query', params.query);
        if (params.status)   sp.set('status', params.status);
        if (params.genre)    sp.set('genre', params.genre);
        if (params.language) sp.set('language', params.language);
        sp.set('page', params.page || 1);
        sp.set('per_page', params.perPage || PAGINATION_DEFAULT_PER_PAGE);

        return await ApiClient.request('libraries.php?' + sp, 'GET');
    }

    static async searchCatalog(params = {}) {
        const sp = new URLSearchParams({ action: 'search_catalog' });

        if (params.query)    sp.set('query', params.query);
        if (params.status)   sp.set('status', params.status);
        if (params.genre)    sp.set('genre', params.genre);
        if (params.language) sp.set('language', params.language);
        sp.set('page', params.page || 1);
        sp.set('per_page', params.perPage || PAGINATION_DEFAULT_PER_PAGE);

        return await ApiClient.request('libraries.php?' + sp, 'GET');
    }
}
