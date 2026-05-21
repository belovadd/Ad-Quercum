/**
 *  КОМПОНЕНТ: EmptyStateComponent — Универсальный блок «здесь пусто»
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM-блок `.empty-state` с Lucide-иконкой, заголовком-сообщением,
 *   опциональным подзаголовком и опциональной кнопкой/ссылкой действия. Заменяет
 *   пустые места в списках (полка, публикации, друзья, клубы, чаты, комментарии),
 *   чтобы пользователь видел понятное состояние, а не белое пятно.
 *   Использование: `container.appendChild(renderEmptyState(options))`.
 */

//  1. РЕНДЕРИНГ ПУСТОГО СОСТОЯНИЯ //

function renderEmptyState(options) {
    const opts = options || {};
    const message = opts.message || 'Здесь пока пусто';
    const iconName = opts.iconName || 'inbox';

    const wrap = document.createElement('div');
    wrap.classList.add('empty-state');

    // --- Иконка ---
    const iconWrap = document.createElement('div');
    iconWrap.classList.add('empty-state-icon');

    if (opts.imageSrc) {
        iconWrap.classList.add('avatar');

        const image = document.createElement('img');
        image.src = opts.imageSrc;
        image.alt = opts.imageAlt || message;
        iconWrap.appendChild(image);
    } else {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        iconWrap.appendChild(icon);
    }

    wrap.appendChild(iconWrap);

    // --- Сообщение ---
    const messageEl = document.createElement('div');
    messageEl.classList.add('empty-state-message');
    messageEl.textContent = message;
    wrap.appendChild(messageEl);

    // --- Подзаголовок (опц.) ---
    if (opts.subtitle) {
        const subtitleEl = document.createElement('div');
        subtitleEl.classList.add('empty-state-subtitle');
        subtitleEl.textContent = opts.subtitle;
        wrap.appendChild(subtitleEl);
    }

    // --- Кнопка/ссылка действия (опц.) ---
    if (opts.actionLabel) {
        const action = (opts.onAction || !opts.actionHref)
            ? document.createElement('button')
            : document.createElement('a');

        action.className = 'btn btn-primary empty-state-action';
        action.textContent = opts.actionLabel;

        if (action.tagName === 'BUTTON') {
            action.type = 'button';
            if (opts.onAction) {
                action.addEventListener('click', opts.onAction);
            }
        } else {
            action.href = opts.actionHref;
        }

        wrap.appendChild(action);
    }

    scheduleEmptyStateIconsRefresh();

    return wrap;
}

function scheduleEmptyStateIconsRefresh() {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') {
        return;
    }

    const refresh = function () {
        window.lucide.createIcons();
    };

    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(refresh);
    } else {
        window.setTimeout(refresh, 0);
    }
}
