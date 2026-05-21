/**
 *  СТРАНИЦА: Правовые документы — навигация и подвал
 *
 * НАЗНАЧЕНИЕ:
 *   Инициализирует правовые страницы и показывает навигацию по текущей сессии.
 *   Если API временно недоступен, страница остаётся доступной с гостевым меню.
 */

(function () {
'use strict';

async function init() {
    const user = await getSessionUser();
    initNavigation(user);
}

async function getSessionUser() {
    if (typeof ApiClient === 'undefined') {
        return null;
    }

    try {
        const session = await ApiClient.init();
        if (session && session.is_authenticated) {
            return session.user || null;
        }
    } catch (error) {
        console.warn('Не удалось проверить сессию для правовой страницы:', error);
    }

    return null;
}

function destroy() {}

PageRegistry.register('terms', {
    init: init,
    destroy: destroy,
});

PageRegistry.register('personal-data-consent', {
    init: init,
    destroy: destroy,
});
})();
