/**
 *  СТРАНИЦА: Админ-панель — дашборд со статистикой платформы 
 *
 * НАЗНАЧЕНИЕ:
 * Дашборд админ-панели: карточки со статистикой платформы
 * (пользователи, книги, публикации, клубы, сессии, модерация).
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

const pageState = {
    stats: null,
    activity: [],
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initAdminPage() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    // Проверка роли: только admin и moderator
    if (user.user_role !== USER_ROLE.ADMIN && user.user_role !== USER_ROLE.MODERATOR) {
        PageRouter.open(PAGE_URL.LIBRARY);
        return;
    }

    initNavigation(user);

    await loadDashboard();
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadDashboard() {
    try {
        const data = await Promise.all([
            AdminService.getStatistics(),
            AdminService.getRecentActivity(ADMIN_RECENT_ACTIVITY_DEFAULT_LIMIT),
        ]);
        pageState.stats = data[0];
        pageState.activity = data[1] || [];
        renderStatistics();
        renderActivity();
    } catch (error) {
        Notification.error('Не удалось загрузить данные админ-панели');
    }
}

//  4. РЕНДЕРИНГ  //

function renderStatistics() {
    const container = document.getElementById('admin-stats');
    const stats = pageState.stats;

    const cards = [
        { label: 'Пользователи', value: stats.total_users, icon: 'users', iconClass: 'admin-stat-icon-users' },
        { label: 'Книги', value: stats.total_books, icon: 'book-open', iconClass: 'admin-stat-icon-books' },
        { label: 'На модерации', value: stats.pending_books, icon: 'shield-alert', iconClass: 'admin-stat-icon-moderation' },
        { label: 'Одобрено', value: stats.approved_books, icon: 'badge-check', iconClass: 'admin-stat-icon-active' },
        { label: 'Отклонено', value: stats.rejected_books, icon: 'circle-x', iconClass: 'admin-stat-icon-moderation' },
        { label: 'Публикации', value: stats.total_publications, icon: 'newspaper', iconClass: 'admin-stat-icon-books' },
        { label: 'Сессии', value: stats.total_sessions, icon: 'timer', iconClass: 'admin-stat-icon-active' },
        { label: 'Клубы', value: stats.total_clubs, icon: 'users-round', iconClass: 'admin-stat-icon-users' },
    ];

    container.textContent = '';

    cards.forEach(function (card) {
        const item = document.createElement('article');
        item.className = 'admin-stat-card';
        if (card.label === 'На модерации' && stats.pending_books > 0) {
            item.classList.add('is-highlighted');
        }

        const iconElement = document.createElement('div');
        iconElement.className = 'admin-stat-icon ' + card.iconClass;

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', card.icon);
        iconElement.appendChild(icon);

        const info = document.createElement('div');
        info.className = 'admin-stat-info';

        const valueElement = document.createElement('div');
        valueElement.className = 'admin-stat-value';
        valueElement.textContent = String(card.value || 0);

        const labelElement = document.createElement('div');
        labelElement.className = 'admin-stat-label';
        labelElement.textContent = card.label;

        info.appendChild(valueElement);
        info.appendChild(labelElement);
        item.appendChild(iconElement);
        item.appendChild(info);
        container.appendChild(item);
    });

    if (stats.pending_books > 0) {
        const alert = document.createElement('div');
        alert.className = 'section-card admin-stat-alert';

        const alertText = document.createElement('span');
        alertText.textContent = 'Книг на модерации: ' + stats.pending_books + '. ';

        const alertLink = document.createElement('a');
        alertLink.href = PAGE_URL.ADMIN_MODERATION;
        alertLink.textContent = 'Перейти к модерации';

        alert.appendChild(alertText);
        alert.appendChild(alertLink);
        container.appendChild(alert);
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderActivity() {
    const container = document.getElementById('admin-activity-log');
    if (!container) return;

    const items = (pageState.activity || []).map(adaptActivityItem);
    const list = renderActivityLog({ items: items });
    container.replaceWith(list);
    list.id = 'admin-activity-log';

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function adaptActivityItem(item) {
    const typeMap = {
        user_registered: 'user_register',
        book_created: 'book_create',
        edition_created: 'edition_create',
        publication_created: 'publication_create',
        club_created: 'club_create',
    };

    const type = typeMap[item.activity_type] || item.activity_type;
    const title = item.ref_title || item.user_name || 'событие';
    const userPart = buildActivityUserPart(item);

    if (type === 'user_register') {
        return {
            type: type,
            time: item.time_created,
            template: '{name} зарегистрировался',
            parts: { name: userPart },
        };
    }

    if (type === 'book_create') {
        return {
            type: type,
            time: item.time_created,
            template: '{name} добавил произведение {title}',
            parts: {
                name: userPart,
                title: buildActivityBookPart(item),
            },
        };
    }

    if (type === 'edition_create') {
        return {
            type: type,
            time: item.time_created,
            template: '{name} добавил издание к {title}',
            parts: {
                name: userPart,
                title: buildActivityBookPart(item),
            },
        };
    }

    if (type === 'publication_create') {
        const hasBook = item.book_id && item.ref_title;
        return {
            type: type,
            time: item.time_created,
            template: hasBook
                ? '{name} опубликовал запись о {title}'
                : '{name} опубликовал запись',
            parts: hasBook
                ? { name: userPart, title: buildActivityBookPart(item) }
                : { name: userPart },
        };
    }

    if (type === 'club_create') {
        return {
            type: type,
            time: item.time_created,
            template: '{name} создал клуб {title}',
            parts: {
                name: userPart,
                title: buildActivityClubPart(item),
            },
        };
    }

    return {
        type: type,
        time: item.time_created,
        text: title,
    };
}

function buildActivityUserPart(item) {
    const first = Utils.safeText(item.user_name_first, '');
    const last = Utils.safeText(item.user_name_last, '');
    const fullName = (first + ' ' + last).trim();
    const text = fullName || Utils.safeText(item.user_name, Utils.safeText(item.user_email, 'Пользователь'));

    if (!item.user_id) return text;

    return {
        text: text,
        href: PAGE_URL.PROFILE + '?user_id=' + encodeURIComponent(item.user_id),
    };
}

function buildActivityBookPart(item) {
    const text = Utils.safeText(item.ref_title, 'Без названия');

    if (!item.book_id) return text;

    return {
        text: text,
        href: PAGE_URL.BOOK + '?id=' + encodeURIComponent(item.book_id),
    };
}

function buildActivityClubPart(item) {
    const text = Utils.safeText(item.ref_title, 'Без названия');

    if (!item.club_id) return text;

    return {
        text: text,
        href: PAGE_URL.CLUB + '?id=' + encodeURIComponent(item.club_id),
    };
}

//  5. ЗАПУСК  //

function destroy() {}

PageRegistry.register('admin', {
    init: initAdminPage,
    destroy: destroy,
});
})();
