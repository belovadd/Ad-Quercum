/**
 * СЕРВИС: StatisticsService — API-вызовы для модуля статистики 
 *
 * НАЗНАЧЕНИЕ:
 *   Загружает агрегированную статистику чтения, календарную активность,
 *   прогресс целей, топ книг и распределение по жанрам.
 */

//  1. КЛАСС StatisticsService //

class StatisticsService {

    static async getOverview() {
        return await ApiClient.request('statistics.php?action=get_overview', 'GET');
    }

    static async getUserOverview(userId) {
        const params = new URLSearchParams({
            action: 'get_overview',
            user_id: userId,
        });
        return await ApiClient.request('statistics.php?' + params, 'GET');
    }

    static async getDailyBreakdown(from, to) {
        const params = new URLSearchParams({
            action: 'get_daily',
            from: from,
            to: to,
        });
        return await ApiClient.request('statistics.php?' + params, 'GET');
    }

    static async getGoalProgress() {
        return await ApiClient.request('statistics.php?action=get_goals', 'GET');
    }

    static async getBookStats() {
        return await ApiClient.request('statistics.php?action=get_books', 'GET');
    }

    static async getGenreStats() {
        return await ApiClient.request('statistics.php?action=get_genres', 'GET');
    }
}
