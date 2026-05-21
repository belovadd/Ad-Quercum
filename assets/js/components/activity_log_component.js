/**
 * КОМПОНЕНТ: ActivityLog — Лог недавних событий (admin / statistics) 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает `<ul class="activity-log">` со списком событий: иконка по типу,
 *   текст с акцентами/ссылками через шаблон + `parts`, время. Безопасно вставляет
 *   подстановки через DOM-узлы — `{name}`, `{title}` и т. п. оборачиваются
 *   в `<strong>` или ссылку через DOM-операции.
 */

function renderActivityLog(props) {
    const p = props || {};
    const items = Array.isArray(p.items) ? p.items : [];

    const list = document.createElement('ul');
    list.className = 'activity-log';

    items.forEach((entry) => {
        list.appendChild(buildActivityItem(entry || {}));
    });

    return list;
}

function buildActivityItem(entry) {
    const li = document.createElement('li');
    li.className = 'activity-item';

    // --- Иконка ---
    const meta = activityTypeMeta(entry.type);
    const iconWrap = document.createElement('div');
    iconWrap.className = 'activity-icon ' + meta.cssClass;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', meta.icon);
    iconWrap.appendChild(icon);
    li.appendChild(iconWrap);

    // --- Контент ---
    const content = document.createElement('div');
    content.className = 'activity-content';

    const text = document.createElement('div');
    text.className = 'activity-text';
    appendActivityText(text, entry);
    content.appendChild(text);

    if (entry.time) {
        const time = document.createElement('div');
        time.className = 'activity-time';
        time.textContent = formatActivityTime(entry.time);
        content.appendChild(time);
    }

    li.appendChild(content);
    return li;
}

function appendActivityText(container, entry) {
    if (entry.template && entry.parts) {
        const re = /\{([a-zA-Z0-9_]+)\}/g;
        const template = String(entry.template);
        let lastIndex = 0;
        let match;
        while ((match = re.exec(template)) !== null) {
            if (match.index > lastIndex) {
                container.appendChild(document.createTextNode(template.slice(lastIndex, match.index)));
            }
            const key = match[1];
            const value = entry.parts[key];
            if (value !== undefined && value !== null) {
                container.appendChild(buildActivityPart(value));
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < template.length) {
            container.appendChild(document.createTextNode(template.slice(lastIndex)));
        }
        return;
    }
    container.textContent = Utils.safeText(entry.text, '');
}

function buildActivityPart(value) {
    const isLinkPart = value && typeof value === 'object' && value.href;
    const element = document.createElement(isLinkPart ? 'a' : 'strong');
    const text = isLinkPart ? value.text : value;

    element.textContent = Utils.safeText(text, '');

    if (isLinkPart) {
        element.href = String(value.href);
        element.className = 'activity-link';
    }

    return element;
}

function activityTypeMeta(type) {
    if (type === 'user_register') return { icon: 'user-plus', cssClass: 'activity-icon-user' };
    if (type === 'book_create') return { icon: 'book-plus', cssClass: 'activity-icon-book' };
    if (type === 'edition_create') return { icon: 'book-plus', cssClass: 'activity-icon-book' };
    if (type === 'book_approve') return { icon: 'check-circle', cssClass: 'activity-icon-mod' };
    if (type === 'publication_create') return { icon: 'message-square', cssClass: 'activity-icon-user' };
    if (type === 'club_create') return { icon: 'users-round', cssClass: 'activity-icon-user' };
    if (type === 'block') return { icon: 'ban', cssClass: 'activity-icon-warn' };
    return { icon: 'circle-dot', cssClass: '' };
}

function formatActivityTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const pad = (n) => String(n).padStart(2, '0');
    const time = pad(date.getHours()) + ':' + pad(date.getMinutes());

    const now = new Date();

    const isSameDay = (a, b) =>
        a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();

    if (isSameDay(date, now)) {
        return 'Сегодня, ' + time;
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(date, yesterday)) {
        return 'Вчера, ' + time;
    }
    return Utils.formatDate(dateString) + ', ' + time;
}

window.renderActivityLog = renderActivityLog;
