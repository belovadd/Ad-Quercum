/**
 *  КОМПОНЕНТ: NavigationComponent — Главная навигация и подвал (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 *   Рендер sticky glass-навбара в стиле Modern Botanical: бренд слева, центральное
 *   меню разделов, справа — иконки (тема/сообщения) и аватар пользователя.
 *   Также вставляет подвал `.footer` в конец body, если он отсутствует.
 */

//  1. ГРУППЫ МЕНЮ  //

window.navigationOutsideClickHandler = window.navigationOutsideClickHandler || null;

function buildNavSections(user) {
    if (!user) {
        return [];
    }

    const sections = [
        {
            label: 'Книги',
            icon: 'library',
            items: [
                { label: 'Библиотека', url: PAGE_URL.LIBRARY, hint: 'Книги и статусы чтения' },
                { label: 'Коллекции', url: PAGE_URL.COLLECTIONS, hint: 'Тематические подборки' },
                { label: 'Добавить книгу', url: PAGE_URL.ADD_BOOK, hint: 'Новое произведение или издание' },
            ],
        },
        {
            label: 'Прогресс',
            icon: 'sprout',
            items: [
                { label: 'Таймер', url: PAGE_URL.TIMER, hint: 'Сессия сфокусированного чтения' },
                { label: 'Растение', url: PAGE_URL.PLANT, hint: 'Прогресс и стадии роста' },
                { label: 'Статистика', url: PAGE_URL.STATISTICS, hint: 'Итоги, цели и активность' },
            ],
        },
        {
            label: 'Сообщество',
            icon: 'users',
            items: [
                { label: 'Друзья', url: PAGE_URL.FRIENDS, hint: 'Список друзей' },
                { label: 'Клубы', url: PAGE_URL.CLUBS, hint: 'Книжные сообщества' },
                { label: 'Пользователи', url: PAGE_URL.USERS, hint: 'Поиск читателей' },
            ],
        },
    ];

    if (user && (user.user_role === USER_ROLE.ADMIN || user.user_role === USER_ROLE.MODERATOR)) {
        const adminItems = [
            { label: 'Дашборд', url: PAGE_URL.ADMIN, hint: 'Сводка администрирования' },
        ];

        if (user.user_role === USER_ROLE.ADMIN) {
            adminItems.push({ label: 'Пользователи', url: PAGE_URL.ADMIN_USERS, hint: 'Роли, блокировки и профили' });
        }

        adminItems.push({ label: 'Книги', url: PAGE_URL.ADMIN_MODERATION, hint: 'Книги и издания на проверке' });

        sections.push({
            label: 'Управление',
            icon: 'settings',
            items: adminItems,
        });
    }

    return sections;
}

function isCurrentPage(linkUrl, currentPath, label) {
    const linkPath = new URL(linkUrl, window.location.origin).pathname;
    if (currentPath === linkPath) {
        return true;
    }
    if (label === 'Пользователи' && linkPath.includes('admin-users') && currentPath.includes('admin-user')) {
        return true;
    }
    return false;
}

function isCurrentSection(section, currentPath) {
    return section.items.some((item) => isCurrentPage(item.url, currentPath, item.label));
}

//  2. РЕНДЕРИНГ НАВИГАЦИОННОЙ ПАНЕЛИ  //

function renderNavigation(user) {
    const nav = document.createElement('nav');
    nav.classList.add('navbar');
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'main navigation');

    const inner = document.createElement('div');
    inner.classList.add('navbar-inner');

    // ---- 1. Brand ----
    const brand = document.createElement('a');
    brand.classList.add('navbar-brand');
    brand.href = user ? PAGE_URL.LIBRARY : PAGE_URL.INDEX;
    brand.textContent = 'Ad Quercum';
    inner.appendChild(brand);

    // ---- 2. Menu (desktop) ----
    const menu = document.createElement('div');
    menu.classList.add('navbar-menu');

    const currentPath = window.location.pathname;
    buildNavSections(user).forEach((section, index) => {
        menu.appendChild(renderNavSection(section, currentPath, index));
    });

    inner.appendChild(menu);

    // ---- 3. Actions (theme + messages + avatar) ----
    const actions = document.createElement('div');
    actions.classList.add('navbar-actions');

    actions.appendChild(renderThemeToggle());

    if (user) {
        actions.appendChild(renderMessagesActionIcon());
        actions.appendChild(renderAvatar(user));
    } else {
        const loginLink = document.createElement('a');
        loginLink.classList.add('navbar-item');
        loginLink.href = PAGE_URL.LOGIN;
        loginLink.textContent = 'Войти';
        actions.appendChild(loginLink);

        const registerLink = document.createElement('a');
        registerLink.classList.add('navbar-item');
        registerLink.href = PAGE_URL.REGISTER;
        registerLink.textContent = 'Регистрация';
        actions.appendChild(registerLink);
    }

    inner.appendChild(actions);

    // ---- 4. Burger (mobile) ----
    const burger = document.createElement('div');
    burger.classList.add('navbar-burger');
    burger.setAttribute('role', 'button');
    burger.setAttribute('aria-label', 'menu');
    const burgerIcon = document.createElement('i');
    burgerIcon.setAttribute('data-lucide', 'menu');
    burger.appendChild(burgerIcon);
    burger.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(isOpen));
    });
    inner.appendChild(burger);

    nav.appendChild(inner);
    bindNavigationOutsideClick(nav);
    return nav;
}

function bindNavigationOutsideClick(nav) {
    if (window.navigationOutsideClickHandler) {
        document.removeEventListener('click', window.navigationOutsideClickHandler);
    }

    window.navigationOutsideClickHandler = function (event) {
        if (nav.contains(event.target)) return;

        closeNavigationGroups(nav);
    };

    document.addEventListener('click', window.navigationOutsideClickHandler);
}

function closeNavigationGroups(root, exceptGroup = null) {
    root.querySelectorAll('.navbar-group.is-open').forEach((group) => {
        if (group === exceptGroup) return;

        group.classList.remove('is-open');
        const toggle = group.querySelector('.navbar-group-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
}

function renderNavSection(section, currentPath, index) {
    const group = document.createElement('div');
    group.classList.add('navbar-group');
    if (isCurrentSection(section, currentPath)) {
        group.classList.add('is-active');
    }

    const dropdownId = 'navbar-dropdown-' + index;
    const toggle = document.createElement('button');
    toggle.className = 'navbar-item navbar-group-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', dropdownId);

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', section.icon);
    toggle.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = section.label;
    toggle.appendChild(label);

    const chevron = document.createElement('i');
    chevron.classList.add('navbar-group-chevron');
    chevron.setAttribute('data-lucide', 'chevron-down');
    toggle.appendChild(chevron);

    const dropdown = document.createElement('div');
    dropdown.classList.add('navbar-dropdown');
    dropdown.id = dropdownId;

    section.items.forEach((item) => {
        dropdown.appendChild(renderNavDropdownItem(item, currentPath));
    });

    group.addEventListener('mouseenter', () => {
        if (!group.parentElement) return;
        closeNavigationGroups(group.parentElement, group);
    });

    toggle.addEventListener('click', () => {
        const isOpen = group.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
        closeNavigationGroups(group.parentElement, group);
    });

    group.appendChild(toggle);
    group.appendChild(dropdown);
    return group;
}

function renderNavDropdownItem(item, currentPath) {
    const anchor = document.createElement('a');
    anchor.classList.add('navbar-dropdown-item');
    anchor.href = item.url;
    if (isCurrentPage(item.url, currentPath, item.label)) {
        anchor.classList.add('is-active');
    }

    const label = document.createElement('span');
    label.classList.add('navbar-dropdown-label');
    label.textContent = item.label;
    anchor.appendChild(label);

    const hint = document.createElement('span');
    hint.classList.add('navbar-dropdown-hint');
    hint.textContent = item.hint;
    anchor.appendChild(hint);

    return anchor;
}

function renderThemeToggle() {
    const wrapper = document.createElement('div');
    wrapper.classList.add('navbar-icon');
    wrapper.setAttribute('title', 'Переключить тему');
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('aria-label', 'Переключить тему');

    const icon = document.createElement('i');
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    icon.setAttribute('data-lucide', currentTheme === 'dark' ? 'sun' : 'moon');
    icon.id = 'themeIcon';
    wrapper.appendChild(icon);

    wrapper.addEventListener('click', toggleTheme);
    return wrapper;
}

function renderActionIcon(lucideName, url, title) {
    const link = document.createElement('a');
    link.classList.add('navbar-icon');
    link.href = url;
    link.setAttribute('title', title);
    link.setAttribute('aria-label', title);

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', lucideName);
    link.appendChild(icon);

    return link;
}

function renderMessagesActionIcon() {
    const link = renderActionIcon('mail', PAGE_URL.MESSAGES, 'Сообщения');
    link.id = 'navbar-messages-link';

    const badge = document.createElement('span');
    badge.id = 'navbar-messages-badge';
    badge.className = 'navbar-badge is-hidden';
    badge.setAttribute('aria-hidden', 'true');
    link.appendChild(badge);

    return link;
}

async function refreshNavigationUnreadCount() {
    const badge = document.getElementById('navbar-messages-badge');
    const link = document.getElementById('navbar-messages-link');
    if (!badge || !link || typeof SocialService === 'undefined') return;

    try {
        const data = await SocialService.getUnreadCount();
        const count = Number(data && data.unread_count) || 0;

        if (count <= 0) {
            badge.textContent = '';
            badge.classList.add('is-hidden');
            badge.setAttribute('aria-hidden', 'true');
            link.setAttribute('aria-label', 'Сообщения');
            return;
        }

        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('is-hidden');
        badge.removeAttribute('aria-hidden');
        link.setAttribute('aria-label', 'Сообщения, непрочитанных: ' + count);
    } catch (error) {
        badge.textContent = '';
        badge.classList.add('is-hidden');
        badge.setAttribute('aria-hidden', 'true');
    }
}

function renderAvatar(user) {
    const link = document.createElement('a');
    link.classList.add('navbar-avatar');
    link.href = PAGE_URL.PROFILE;
    link.setAttribute('title', user.user_name_first || user.user_email);

    const img = document.createElement('img');
    img.src = Utils.getAvatarUrl(user.user_avatar_path);
    img.alt = '';
    link.appendChild(img);

    return link;
}

//  3. ПЕРЕКЛЮЧАТЕЛЬ ТЕМЫ  //

function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch (error) { /* localStorage недоступен — игнорируем */ }

    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }
}

function restoreTheme() {
    try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            document.documentElement.setAttribute('data-theme', saved);
        }
    } catch (error) { /* localStorage недоступен — игнорируем */ }
}

//  4. ИНИЦИАЛИЗАЦИЯ  //

function initNavigation(user) {
    restoreTheme();

    const container = document.getElementById('navigation');
    if (container) {
        Utils.clearChildren(container);
        container.appendChild(renderNavigation(user));
    }

    if (!document.querySelector('.footer')) {
        document.body.appendChild(renderFooter());
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }

    if (user) {
        refreshNavigationUnreadCount();
    }
}

//  5. ПОДВАЛ  //

function renderFooter() {
    const footer = document.createElement('footer');
    footer.classList.add('footer');

    const brand = document.createElement('div');
    brand.classList.add('footer-brand');
    brand.textContent = 'Ad Quercum';
    footer.appendChild(brand);

    const tagline = document.createElement('div');
    tagline.classList.add('footer-tagline');
    tagline.textContent = 'Путь к Дубу — учёт чтения, таймер, друзья и сад.';
    footer.appendChild(tagline);

    const links = document.createElement('nav');
    links.classList.add('footer-links');
    links.setAttribute('aria-label', 'Правовая информация');

    const termsLink = document.createElement('a');
    termsLink.href = PAGE_URL.TERMS;
    termsLink.textContent = 'Пользовательское соглашение';
    links.appendChild(termsLink);

    const consentLink = document.createElement('a');
    consentLink.href = PAGE_URL.PERSONAL_DATA_CONSENT;
    consentLink.textContent = 'Согласие на обработку персональных данных';
    links.appendChild(consentLink);

    footer.appendChild(links);

    return footer;
}
