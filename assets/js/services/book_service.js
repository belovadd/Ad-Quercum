/**
 *  СЕРВИС: BookService — API-вызовы для модуля произведений и изданий
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к `api/books.php`. Модель: произведение (`books`) + издания
 * (`book_editions`). Поиск по полке пользователя — в `LibraryService`.
 */

class BookService {

    //  1. ЧТЕНИЕ И АВТОКОМПЛИТ  //

    static async autocomplete(query) {
        return await ApiClient.request(
            'books.php?action=autocomplete&query=' + encodeURIComponent(query),
            'GET'
        );
    }

    static async getBook(bookId) {
        return await ApiClient.request(
            'books.php?action=get&book_id=' + bookId, 'GET'
        );
    }

    static async getBookReviews(bookId, page = 1) {
        const params = new URLSearchParams({
            action: 'get_reviews',
            book_id: bookId,
            page: page,
        });
        return await ApiClient.request('books.php?' + params, 'GET');
    }

    //  2. ПРОИЗВЕДЕНИЯ  //

    static async createBook(bookData, editionData, libraryId = null) {
        const payload = {
            action: 'create_book',
            ...bookData,
            ...editionData,
        };
        if (libraryId !== null) {
            payload.library_id = libraryId;
        }
        return await ApiClient.request('books.php', 'POST', payload);
    }

    static async updateBook(bookId, bookData) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'update_book',
            book_id: bookId,
            ...bookData,
        });
    }

    static async deleteBook(bookId) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'delete_book',
            book_id: bookId,
        });
    }

    //  3. ИЗДАНИЯ  //

    static async createEdition(bookId, editionData, libraryId = null) {
        const payload = {
            action: 'create_edition',
            book_id: bookId,
            ...editionData,
        };
        if (libraryId !== null) {
            payload.library_id = libraryId;
        }
        return await ApiClient.request('books.php', 'POST', payload);
    }

    static async updateEdition(editionId, editionData) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'update_edition',
            edition_id: editionId,
            ...editionData,
        });
    }

    static async deleteEdition(editionId) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'delete_edition',
            edition_id: editionId,
        });
    }

    static async uploadEditionCover(editionId, file) {
        const formData = new FormData();
        formData.append('action', 'upload_edition_cover');
        formData.append('edition_id', editionId);
        formData.append('edition_cover', file);
        return await ApiClient.upload('books.php', formData);
    }

    //  4. СТАТУС И ОЦЕНКИ  //

    static async updateStatus(bookId, status) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'update_status',
            book_id: bookId,
            book_status: status,
        });
    }

    static async rate(bookId, rateData) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'rate',
            book_id: bookId,
            ...rateData,
        });
    }

    static async deleteReview(bookId) {
        return await ApiClient.request('books.php', 'POST', {
            action: 'delete_review',
            book_id: bookId,
        });
    }
}
