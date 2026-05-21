/**
 *  СЕРВИС: TimerService — API-вызовы для модуля таймера и геймификации 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к API timers.php: сессии, растение, настройки, цели.
 */

//  1. КЛАСС TimerService  //

class TimerService {

    //  СЕССИИ //

    static async startSession(duration, bookId, isPomodoro) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'start',
            duration: duration,
            book_id: bookId || null,
            is_pomodoro: isPomodoro || false,
        });
    }

    static async pauseSession(sessionId) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'pause',
            session_id: sessionId,
        });
    }

    static async resumeSession(sessionId) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'resume',
            session_id: sessionId,
        });
    }

    static async completeSession(sessionId, actualDuration) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'complete',
            session_id: sessionId,
            actual_duration: actualDuration,
        });
    }

    static async cancelSession(sessionId) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'cancel',
            session_id: sessionId,
        });
    }

    static async getActiveSession() {
        return await ApiClient.request('timers.php?action=get_active', 'GET');
    }

    static async getSessionHistory(page = 1) {
        const params = new URLSearchParams({
            action: 'get_history',
            page: page,
        });
        return await ApiClient.request('timers.php?' + params, 'GET');
    }

    // НАСТРОЙКИ  //

    static async getSettings() {
        return await ApiClient.request('timers.php?action=get_settings', 'GET');
    }

    static async updateSettings(data) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'update_settings',
            ...data,
        });
    }

    //  РАСТЕНИЕ  //

    static async getPlantState() {
        return await ApiClient.request('timers.php?action=get_plant', 'GET');
    }

    static async getUserPlantState(userId) {
        const params = new URLSearchParams({
            action: 'get_plant',
            user_id: userId,
        });
        return await ApiClient.request('timers.php?' + params, 'GET');
    }

    static async getPlantHistory() {
        return await ApiClient.request('timers.php?action=get_plant_history', 'GET');
    }

    // ЦЕЛИ  //

    static async setReadingGoal(goalType, targetMinutes, periodStart) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'set_goal',
            goal_type: goalType,
            goal_target_minutes: targetMinutes,
            goal_period_start: periodStart,
        });
    }

    static async getReadingGoals() {
        return await ApiClient.request('timers.php?action=get_goals', 'GET');
    }

    // ЗАМЕТКИ ЧТЕНИЯ (reading_notes)  //

    static async createNote(data) {
        const payload = Object.assign({}, data || {}, { action: 'add_note' });
        return await ApiClient.request('timers.php', 'POST', payload);
    }

    static async listSessionNotes(sessionId) {
        return await ApiClient.request(
            'timers.php?action=list_session_notes&session_id=' + sessionId,
            'GET'
        );
    }

    static async listUserNotes(params) {
        const sp = new URLSearchParams({ action: 'list_user_notes' });
        const p = params || {};
        if (p.book_id) sp.set('book_id', p.book_id);
        if (p.page) sp.set('page', p.page);
        if (p.per_page) sp.set('per_page', p.per_page);
        return await ApiClient.request('timers.php?' + sp, 'GET');
    }

    static async deleteNote(noteId) {
        return await ApiClient.request('timers.php', 'POST', {
            action: 'delete_note',
            note_id: noteId,
        });
    }
}
