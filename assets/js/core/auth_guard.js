/**
 * CORE: Проверка авторизации и редирект 
 *
 * НАЗНАЧЕНИЕ:
 *   Проверяет текущую сессию и перенаправляет неавторизованного пользователя
 *   на страницу входа.
 */

//  1. ПРОВЕРКА АВТОРИЗАЦИИ  //

const AuthGuard = {

    async requireAuth() {
        const session = await ApiClient.init();

        if (!session.is_authenticated) {
            PageRouter.open(PAGE_URL.LOGIN);
            return null;
        }

        return session.user;
    },

    async requireGuest() {
        const session = await ApiClient.init();

        if (session.is_authenticated) {
            PageRouter.open(PAGE_URL.LIBRARY);
            return null;
        }

        return session;
    },

    async checkAuth() {
        return await ApiClient.init();
    },
};
