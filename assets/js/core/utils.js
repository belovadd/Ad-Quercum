/**
 *  CORE: Утилиты — форматирование, debounce, DOM-хелперы 
 *
 * НАЗНАЧЕНИЕ:
 * Общие утилиты, используемые на всех страницах.
 */

//  1. ФОРМАТИРОВАНИЕ  //

const Utils = {

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    },

    formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
        const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
        const seconds = totalSeconds % SECONDS_PER_MINUTE;

        const pad = (num) => String(num).padStart(2, '0');

        if (hours > 0) {
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        }

        return `${pad(minutes)}:${pad(seconds)}`;
    },

    formatMinutes(minutes) {
        if (minutes < MINUTES_PER_HOUR) {
            return minutes + ' мин';
        }

        const hours = Math.floor(minutes / MINUTES_PER_HOUR);
        const remainingMinutes = minutes % MINUTES_PER_HOUR;

        if (remainingMinutes === 0) {
            return hours + ' ч';
        }

        return hours + ' ч ' + remainingMinutes + ' мин';
    },

    formatNumber(value) {
        return (Number(value) || 0).toLocaleString('ru-RU');
    },

    formatGenre(value, fallback = '') {
        const text = this.safeText(value, fallback);
        if (text === '') return '';

        const chars = Array.from(text);
        chars[0] = chars[0].toLocaleUpperCase('ru-RU');
        return chars.join('');
    },

    //  2. ЗАДЕРЖКА И ОГРАНИЧЕНИЕ ЧАСТОТЫ  //

    debounce(func, delay) {
        let timerId;
        return function (...args) {
            clearTimeout(timerId);
            timerId = setTimeout(() => func.apply(this, args), delay);
        };
    },

    //  3. DOM-ХЕЛПЕРЫ  //

    getElement(id) {
        return document.getElementById(id);
    },

    clearChildren(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    },

    showElement(element) {
        if (element) {
            element.classList.remove('is-hidden');
        }
    },

    hideElement(element) {
        if (element) {
            element.classList.add('is-hidden');
        }
    },

    //  4. URL-ПАРАМЕТРЫ  //

    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    safeText(value, fallback = '') {
        if (value === null || value === undefined) return fallback;
        const str = String(value).trim();
        return str === '' ? fallback : str;
    },

    getAvatarUrl(avatarPath) {
        const path = this.safeText(avatarPath, '');
        if (path !== '') return path;

        return typeof DEFAULT_AVATAR_URL !== 'undefined'
            ? DEFAULT_AVATAR_URL
            : '../assets/images/default_avatar.png';
    },

    setSafeText(element, value, options) {
        const opts = options || {};
        const fallback = opts.fallback !== undefined ? opts.fallback : '';
        const text = this.safeText(value, fallback);

        if (opts.hideIfEmpty && text === '') {
            this.hideElement(element);
            return;
        }
        this.showElement(element);
        element.textContent = text;
    },

    createImage(src, alt, fallbackSrc) {
        const image = document.createElement('img');
        image.src = this.safeText(src, fallbackSrc);
        image.alt = this.safeText(alt, '');

        if (fallbackSrc) {
            image.addEventListener('error', function () {
                if (image.getAttribute('src') !== fallbackSrc) {
                    image.src = fallbackSrc;
                }
            }, { once: true });
        }

        return image;
    },

    createLucideIcon(iconName, className = '') {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        if (className) {
            icon.className = className;
        }
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    },

    appendIconText(element, iconName, label) {
        if (!element) return;

        element.appendChild(this.createLucideIcon(iconName));

        const text = document.createElement('span');
        text.textContent = label;
        element.appendChild(text);
    },

    setIconText(element, iconName, label) {
        if (!element) return;

        this.clearChildren(element);
        this.appendIconText(element, iconName, label);
        this.refreshIcons();
    },

    refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    },

    getUserId(entity) {
        if (!entity) return null;
        return entity.user_id || entity.id || entity.peer_id || null;
    },

    getUserProfileUrl(entity) {
        const userId = this.getUserId(entity);
        if (!userId) return null;

        const profileUrl = typeof PAGE_URL !== 'undefined'
            ? PAGE_URL.PROFILE
            : 'profile.html';

        return profileUrl + '?user_id=' + encodeURIComponent(userId);
    },

    composeUserName(entity, fallback = 'Без имени', options) {
        const opts = options || {};
        const first = this.safeText(entity && entity.user_name_first, '');
        const last = this.safeText(entity && entity.user_name_last, '');
        const full = (first + ' ' + last).trim();
        if (full !== '') return full;

        if (opts.useIdentifier !== false) {
            const identifier = this.safeText(entity && entity.user_profile_identifier, '');
            if (identifier !== '') {
                return opts.prefixIdentifier ? '@' + identifier : identifier;
            }
        }

        if (opts.useEmail) {
            const email = this.safeText(entity && entity.user_email, '');
            if (email !== '') return email;
        }

        return fallback;
    },

    shouldScrollElementToTop(element, options) {
        if (!element || typeof element.scrollIntoView !== 'function') {
            return false;
        }

        const opts = options || {};
        const rect = element.getBoundingClientRect();
        const comfortableTop = opts.comfortableTop !== undefined ? opts.comfortableTop : 96;
        const comfortableBottom = opts.comfortableBottom !== undefined
            ? opts.comfortableBottom
            : window.innerHeight * 0.45;

        return rect.top < comfortableTop || rect.top > comfortableBottom;
    },

    scrollToElementTop(element, options) {
        if (!this.shouldScrollElementToTop(element, options)) {
            return;
        }

        const opts = options || {};
        element.scrollIntoView({
            behavior: opts.behavior || 'smooth',
            block: opts.block || 'start',
        });
    },

    showFieldError(fieldId, message, root = document) {
        const field = root.querySelector('#' + fieldId);
        const error = root.querySelector('[data-error-for="' + fieldId + '"]')
            || root.querySelector('#' + fieldId + '-error');

        if (field) {
            field.classList.add('is-invalid');
            field.classList.add('is-danger');
        }
        if (error) {
            error.textContent = message;
            this.showElement(error);
        }
    },

    clearFormErrors(root = document) {
        root.querySelectorAll('.is-invalid').forEach((field) => {
            field.classList.remove('is-invalid');
        });

        root.querySelectorAll('input.is-danger, textarea.is-danger, select.is-danger').forEach((field) => {
            field.classList.remove('is-danger');
        });

        root.querySelectorAll('[data-error-for]').forEach((error) => {
            error.textContent = '';
        });

        root.querySelectorAll('.form-error').forEach((error) => {
            error.textContent = '';
            this.hideElement(error);
        });
    },

    async runPendingAction(pendingSet, key, action, busyResult = undefined) {
        if (!pendingSet || pendingSet.has(key)) return busyResult;

        pendingSet.add(key);
        try {
            return await action();
        } finally {
            pendingSet.delete(key);
        }
    },
};

//  5. ЕДИНЫЕ SELECT-ИКОНКИ  //

const SelectIconEnhancer = {

    _observer: null,

    _selector: '.form-select, .filter-select, .member-role-select, .user-role-select, .reading-status-select, .note-type-select',

    init() {
        this.enhance(document);

        if (this._observer) {
            return;
        }

        this._observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    this.enhance(node);
                });
            });
        });

        this._observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    },

    enhance(root) {
        if (!root || typeof root.querySelectorAll !== 'function') {
            if (root && root.nodeType === Node.ELEMENT_NODE && root.matches(this._selector)) {
                this._enhanceSelect(root);
            }
            return;
        }

        if (root.nodeType === Node.ELEMENT_NODE && root.matches(this._selector)) {
            this._enhanceSelect(root);
        }

        root.querySelectorAll(this._selector).forEach((select) => {
            this._enhanceSelect(select);
        });
    },

    _enhanceSelect(select) {
        if (!select || select.dataset.selectEnhanced === 'true') {
            return;
        }

        const wrapper = document.createElement('span');
        wrapper.className = 'select-control';
        this._applyWrapperModifiers(wrapper, select);
        select.dataset.selectEnhanced = 'true';

        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        wrapper.appendChild(this._buildIcon());
    },

    _applyWrapperModifiers(wrapper, select) {
        if (select.classList.contains('form-select')) {
            wrapper.classList.add('select-control-form');
        }
        if (select.classList.contains('filter-select')) {
            wrapper.classList.add('select-control-filter');
        }
        if (select.classList.contains('member-role-select')) {
            wrapper.classList.add('select-control-member-role');
        }
        if (select.classList.contains('user-role-select')) {
            wrapper.classList.add('select-control-user-role');
        }
        if (select.classList.contains('reading-status-select')) {
            wrapper.classList.add('select-control-reading-status');
        }
        if (select.classList.contains('note-type-select')) {
            wrapper.classList.add('select-control-note-type');
        }
    },

    _buildIcon() {
        if (window.lucide && window.lucide.icons && typeof window.lucide.createElement === 'function') {
            const svg = window.lucide.createElement(window.lucide.icons.ChevronDown);
            svg.classList.add('select-control-icon');
            svg.setAttribute('aria-hidden', 'true');
            return svg;
        }

        const icon = document.createElement('i');
        icon.className = 'select-control-icon';
        icon.setAttribute('data-lucide', 'chevron-down');
        icon.setAttribute('aria-hidden', 'true');
        return icon;
    },
};

window.SelectIconEnhancer = SelectIconEnhancer;
