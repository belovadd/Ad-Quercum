/**
 *  СЕРВИС: AuthService — API-вызовы аутентификации и пользователей 
 *
 * НАЗНАЧЕНИЕ:
 * Все вызовы к API auth.php: регистрация, логин, логаут, профиль, поиск.
 * Использует ApiClient для отправки запросов.
 */

// 1. КЛАСС AuthService  //

class AuthService {

    static async register(email, password, profileIdentifier, termsAccepted = false, personalDataAccepted = false) {
        const payload = {
            action: 'register',
            user_email: email,
            password: password,
            terms_accepted: termsAccepted,
            personal_data_accepted: personalDataAccepted,
        };
        if (profileIdentifier !== undefined && profileIdentifier !== null && profileIdentifier !== '') {
            payload.user_profile_identifier = profileIdentifier;
        }
        return await ApiClient.request('auth.php', 'POST', payload);
    }

    static async login(email, password) {
        return await ApiClient.request('auth.php', 'POST', {
            action: 'login',
            user_email: email,
            password: password,
        });
    }

    static async logout() {
        return await ApiClient.request('auth.php', 'POST', {
            action: 'logout',
        });
    }

    static async checkSession() {
        return await ApiClient.init();
    }

    static async getProfile(userId = null) {
        let endpoint = 'auth.php?action=get_profile';
        if (userId !== null) {
            endpoint += '&user_id=' + userId;
        }
        return await ApiClient.request(endpoint, 'GET');
    }

    static async updateProfile(profileData) {
        return await ApiClient.request('auth.php', 'POST', {
            action: 'update_profile',
            ...profileData,
        });
    }

    static async changePassword(currentPassword, newPassword, confirmPassword) {
        return await ApiClient.request('auth.php', 'POST', {
            action: 'change_password',
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
        });
    }

    static async uploadAvatar(file) {
        const formData = new FormData();
        formData.append('action', 'upload_avatar');
        formData.append('avatar', file);
        return await ApiClient.upload('auth.php', formData);
    }

    static async searchUsers(query, page = 1, perPage = PAGINATION_DEFAULT_PER_PAGE) {
        const params = new URLSearchParams({
            action: 'search_users',
            query: query,
            page: page,
            per_page: perPage,
        });
        return await ApiClient.request('auth.php?' + params, 'GET');
    }
}
