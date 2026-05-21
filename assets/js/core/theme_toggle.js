/**
 *  МОДУЛЬ: Переключатель темы для auth-страниц 
 *
 * НАЗНАЧЕНИЕ:
 *   Восстанавливает тему из localStorage, привязывает кнопку theme-toggle-button
 *   и обновляет иконку moon/sun на auth-страницах без общей навигации.
 */

//  1. ВОССТАНОВЛЕНИЕ ТЕМЫ  //

(function () {
    'use strict';
    
    function restoreTheme() {
        try {
            const saved = localStorage.getItem(THEME_STORAGE_KEY);
            if (saved === 'light' || saved === 'dark') {
                document.documentElement.setAttribute('data-theme', saved);
            }
        } catch (error) { /* localStorage недоступен — игнорируем */ }
    }

    function getCurrentTheme() {
        const value = document.documentElement.getAttribute('data-theme');
        return value === 'dark' ? 'dark' : 'light';
    }

    function toggleAuthTheme() {
        const html = document.documentElement;
        const next = getCurrentTheme() === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', next);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch (error) { /* localStorage недоступен — игнорируем */ }
        updateButtonIcon(next);
    }

    function updateButtonIcon(theme) {
        const button = document.getElementById('theme-toggle-button');
        if (!button) {
            return;
        }
        const icon = button.querySelector('[data-lucide]');
        if (icon) {
            icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        }
    }

    //  2. ИНИЦИАЛИЗАЦИЯ  //

    restoreTheme();

    function init() {
        const button = document.getElementById('theme-toggle-button');
        if (button) {
            if (button.dataset.themeToggleBound === '1') {
                updateButtonIcon(getCurrentTheme());
                return;
            }
            button.dataset.themeToggleBound = '1';
            button.addEventListener('click', toggleAuthTheme);
            updateButtonIcon(getCurrentTheme());
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Экспорт в глобальный объект для отладки.
    window.AuthThemeToggle = { toggle: toggleAuthTheme, current: getCurrentTheme, init: init };
})();
