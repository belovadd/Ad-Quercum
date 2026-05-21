/**
 *  CORE: PageRegistry — Реестр жизненного цикла страниц 
 *
 * НАЗНАЧЕНИЕ:
 * Хранит контроллеры страниц и запускает их после полной или AJAX-навигации.
 * Каждый page-скрипт обязан регистрировать `init` и при необходимости `destroy`.
 */

// 1. РЕЕСТР СТРАНИЦ  //

const PageRegistry = {

    _controllers: {},

    _currentPageId: null,

    _isStarted: false,

    register(pageId, controller) {
        if (!pageId || !controller || typeof controller.init !== 'function') {
            throw new Error('Некорректная регистрация страницы: ' + pageId);
        }

        this._controllers[pageId] = controller;
    },

    async start(pageId) {
        const controller = this._controllers[pageId];
        if (!controller) {
            throw new Error('Контроллер страницы не найден: ' + pageId);
        }

        this._currentPageId = pageId;
        this._isStarted = true;
        await controller.init();
    },

    destroyCurrent() {
        const pageId = this._currentPageId;
        const controller = pageId ? this._controllers[pageId] : null;

        if (controller && typeof controller.destroy === 'function') {
            try {
                controller.destroy();
            } catch (error) {
                console.error(error);
            }
        }

        this._removeTransientElements();
        this._currentPageId = null;
        this._isStarted = false;
    },

    getPageIdFromUrl(value) {
        const url = value instanceof URL ? value : new URL(value, window.location.href);
        const filename = url.pathname.split('/').pop() || 'index.html';
        return filename.replace(/\.html$/i, '');
    },

    getCurrentPageId() {
        return this._currentPageId;
    },

    _removeTransientElements() {
        document.querySelectorAll('.modal-backdrop').forEach(function (element) {
            element.remove();
        });
    },
};

window.PageRegistry = PageRegistry;
