/**
 *  CORE: PageRouter — AJAX-навигация между статическими HTML-страницами 
 *
 * НАЗНАЧЕНИЕ:
 * Загружает внутренние HTML-страницы через fetch, обновляет main/body,
 * подгружает page-скрипты и запускает контроллеры через PageRegistry.
 */

//  1. AJAX-РОУТЕР //

const PageRouter = {

    _loadedScripts: new Set(),

    _isNavigating: false,

    //  2. ИНИЦИАЛИЗАЦИЯ  //

    init() {
        this._markLoadedScripts();
        this._showTransition();

        document.addEventListener('click', this._handleDocumentClick.bind(this));
        window.addEventListener('popstate', this._handlePopState.bind(this));

        const initialPageId = PageRegistry.getPageIdFromUrl(window.location.href);
        PageRegistry.start(initialPageId)
            .then(() => this._afterPageStart({ keepScroll: true }))
            .catch(function (error) {
                console.error(error);
            })
            .finally(() => {
                this._hideTransition();
            });
    },

    open(url) {
        this.navigate(url).catch(function () {
            window.location.href = url;
        });
    },

    //  3. ПЕРЕХОДЫ  //

    async navigate(url, options = {}) {
        const targetUrl = new URL(url, window.location.href);

        if (!this._canNavigate(targetUrl)) {
            window.location.href = targetUrl.href;
            return;
        }

        if (targetUrl.href === window.location.href && !options.force) {
            return;
        }

        if (this._isNavigating) {
            return;
        }

        this._isNavigating = true;
        this._showTransition();

        try {
            const response = await fetch(targetUrl.href, { credentials: 'same-origin' });
            if (!response.ok) {
                throw new Error('Страница недоступна: ' + response.status);
            }

            const html = await response.text();
            const nextDocument = new DOMParser().parseFromString(html, 'text/html');
            const pageId = PageRegistry.getPageIdFromUrl(targetUrl);

            PageRegistry.destroyCurrent();
            this._replaceDocument(nextDocument);

            if (!options.replace) {
                history.pushState({}, nextDocument.title || document.title, targetUrl.href);
            } else {
                history.replaceState({}, nextDocument.title || document.title, targetUrl.href);
            }

            await this._loadPageScripts(nextDocument);
            await PageRegistry.start(pageId);
            this._afterPageStart();
        } catch (error) {
            console.error(error);
            window.location.href = targetUrl.href;
        } finally {
            this._isNavigating = false;
            this._hideTransition();
        }
    },

    _handlePopState() {
        this.navigate(window.location.href, { replace: true, force: true });
    },

    //  4. ПЕРЕХВАТ ССЫЛОК  //

    _handleDocumentClick(event) {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target.closest('a[href]');
        if (!link) return;

        const target = link.getAttribute('target');
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || target === '_blank' || link.hasAttribute('download')) {
            return;
        }

        const targetUrl = new URL(href, window.location.href);
        if (!this._canNavigate(targetUrl)) return;

        event.preventDefault();
        this.open(targetUrl.href);
    },

    _canNavigate(url) {
        if (url.origin !== window.location.origin) return false;
        if (!/\/public\/[^/]+\.html$/i.test(url.pathname)) return false;
        if (/\/public\/index\.html$/i.test(url.pathname)) return false;
        return true;
    },

    //  5. ЗАМЕНА ДОКУМЕНТА И СКРИПТОВ  //

    _replaceDocument(nextDocument) {
        document.title = nextDocument.title || document.title;
        this._syncCsrfToken(nextDocument);

        const currentNavigation = document.getElementById('navigation');
        const nextNavigation = nextDocument.getElementById('navigation');
        const currentMain = document.querySelector('main');
        const nextMain = nextDocument.querySelector('main');

        if (currentNavigation && nextNavigation && currentMain && nextMain) {
            document.body.className = nextDocument.body.className;
            currentMain.replaceWith(document.importNode(nextMain, true));
            this._removePageScriptsFromBody();
            return;
        }

        document.body.className = nextDocument.body.className;
        document.body.replaceChildren(...this._getBodyNodesWithoutScripts(nextDocument).map(function (node) {
            return document.importNode(node, true);
        }));
    },

    _syncCsrfToken(nextDocument) {
        const nextCsrf = nextDocument.querySelector('meta[name="csrf-token"]');
        const currentCsrf = document.querySelector('meta[name="csrf-token"]');
        if (nextCsrf && currentCsrf) {
            currentCsrf.setAttribute('content', nextCsrf.getAttribute('content') || '');
        }
    },

    _getBodyNodesWithoutScripts(nextDocument) {
        return Array.from(nextDocument.body.childNodes).filter(function (node) {
            return !(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT');
        });
    },

    _removePageScriptsFromBody() {
        document.querySelectorAll('script[src*="/assets/js/pages/"]').forEach(function (script) {
            script.remove();
        });
    },

    async _loadPageScripts(nextDocument) {
        const scripts = Array.from(nextDocument.querySelectorAll('script'));

        for (const script of scripts) {
            const src = script.getAttribute('src');
            if (!src) {
                continue;
            }

            const absoluteUrl = new URL(src, window.location.href).href;
            const isPageScript = absoluteUrl.includes('/assets/js/pages/');
            if (!isPageScript && this._loadedScripts.has(this._normalizeScriptUrl(absoluteUrl))) {
                continue;
            }

            await this._appendScript(absoluteUrl);

            if (!isPageScript) {
                this._loadedScripts.add(this._normalizeScriptUrl(absoluteUrl));
            }
        }
    },

    _appendScript(src) {
        return new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = src;
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error('Не удалось загрузить скрипт: ' + src)); };
            document.body.appendChild(script);
        });
    },

    _markLoadedScripts() {
        document.querySelectorAll('script[src]').forEach((script) => {
            const absoluteUrl = new URL(script.getAttribute('src'), window.location.href).href;
            if (!absoluteUrl.includes('/assets/js/pages/')) {
                this._loadedScripts.add(this._normalizeScriptUrl(absoluteUrl));
            }
        });
    },

    _normalizeScriptUrl(src) {
        const url = new URL(src, window.location.href);
        return url.origin + url.pathname;
    },

    _afterPageStart(options = {}) {
        if (!options.keepScroll) {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
        if (window.AuthThemeToggle && typeof window.AuthThemeToggle.init === 'function') {
            window.AuthThemeToggle.init();
        }
        if (window.SelectIconEnhancer && typeof window.SelectIconEnhancer.init === 'function') {
            window.SelectIconEnhancer.init();
        }
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    },

    _showTransition() {
        if (document.getElementById('page-transition')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'page-transition';
        overlay.className = 'page-transition is-visible';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');

        const spinner = document.createElement('div');
        spinner.className = 'page-transition-spinner';
        overlay.appendChild(spinner);

        document.body.appendChild(overlay);
        document.body.classList.add('is-page-transitioning');
    },

    _hideTransition() {
        const overlay = document.getElementById('page-transition');
        const hide = function () {
            document.body.classList.remove('is-page-transitioning', 'is-app-booting');

            if (!overlay) {
                return;
            }

            overlay.classList.remove('is-visible');
            setTimeout(function () {
                overlay.remove();
            }, UI_TRANSITION_HIDE_DELAY_MS);
        };

        requestAnimationFrame(function () {
            requestAnimationFrame(hide);
        });
    },
};

document.addEventListener('DOMContentLoaded', function () {
    PageRouter.init();
});

window.PageRouter = PageRouter;
