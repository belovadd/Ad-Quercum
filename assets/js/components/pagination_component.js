/**
 *  КОМПОНЕНТ: Pagination — Навигация по страницам 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM-блок `<nav class="pagination">` с кнопками `[chevron-left] [1] [2] ... [N] [chevron-right]`
 *   и опциональным справа `.pagination-info` («Показано 1–20 из 124»). Если страниц
 *   ≤ 7 — все номера; иначе сжатая форма с многоточиями. Активная кнопка получает
 *   `.is-current`, неактивные prev/next — `.is-disabled`.
 *   Использование: `container.appendChild(renderPagination(props))`.
 */

//  1. РЕНДЕРИНГ ПАГИНАЦИИ  //

function renderPagination(props) {
    const p = props || {};
    const totalPages = Math.max(1, Number(p.totalPages) || 1);
    const currentPage = Math.min(totalPages, Math.max(1, Number(p.currentPage) || 1));
    const onPageChange = typeof p.onPageChange === 'function' ? p.onPageChange : null;
    const options = p.options || {};

    const nav = document.createElement('nav');
    nav.className = 'pagination';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Постраничная навигация');

    // --- Назад ---
    nav.appendChild(buildPaginationButton({
        iconName: 'chevron-left',
        ariaLabel: 'Предыдущая страница',
        disabled: currentPage === 1,
        onClick: () => { if (onPageChange) onPageChange(currentPage - 1); },
    }));

    // --- Цифры ---
    const pages = computePaginationPages(currentPage, totalPages);
    pages.forEach((entry) => {
        if (entry === '…') {
            const ell = document.createElement('span');
            ell.className = 'pagination-ellipsis';
            ell.textContent = '…';
            nav.appendChild(ell);
            return;
        }
        nav.appendChild(buildPaginationButton({
            label: String(entry),
            ariaLabel: 'Страница ' + entry,
            isCurrent: entry === currentPage,
            onClick: () => { if (onPageChange && entry !== currentPage) onPageChange(entry); },
        }));
    });

    // --- Вперёд ---
    nav.appendChild(buildPaginationButton({
        iconName: 'chevron-right',
        ariaLabel: 'Следующая страница',
        disabled: currentPage === totalPages,
        onClick: () => { if (onPageChange) onPageChange(currentPage + 1); },
    }));

    // --- Информация: опционально ---
    if (options.totalCount !== undefined && options.perPage) {
        const total = Number(options.totalCount) || 0;
        const per = Math.max(1, Number(options.perPage) || 1);
        const from = total === 0 ? 0 : (currentPage - 1) * per + 1;
        const to = Math.min(total, currentPage * per);
        const word = Utils.safeText(options.label, 'элементов');

        const info = document.createElement('span');
        info.className = 'pagination-info';
        info.textContent = total === 0
            ? 'Нет ' + word
            : 'Показано ' + from + '–' + to + ' из ' + total;
        nav.appendChild(info);
    }

    return nav;
}

//  2. ВНУТРЕННИЕ ХЕЛПЕРЫ  //

function buildPaginationButton(cfg) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pagination-btn';
    if (cfg.iconName) {
        btn.appendChild(buildPaginationIcon(cfg.iconName));
    } else {
        btn.textContent = cfg.label;
    }
    if (cfg.ariaLabel) btn.setAttribute('aria-label', cfg.ariaLabel);
    if (cfg.isCurrent) {
        btn.classList.add('is-current');
        btn.setAttribute('aria-current', 'page');
    }
    if (cfg.disabled) {
        btn.classList.add('is-disabled');
        btn.disabled = true;
    }
    if (cfg.onClick) {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            if (!btn.disabled) cfg.onClick();
        });
    }
    return btn;
}

function buildPaginationIcon(iconName) {
    if (window.lucide && window.lucide.icons && typeof window.lucide.createElement === 'function') {
        const pascalName = toLucidePascalName(iconName);
        const iconNode = window.lucide.icons[pascalName];

        if (iconNode) {
            const svg = window.lucide.createElement(iconNode);
            svg.setAttribute('data-lucide', iconName);
            svg.setAttribute('aria-hidden', 'true');
            return svg;
        }
    }

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

function toLucidePascalName(iconName) {
    return String(iconName)
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}

function computePaginationPages(current, total) {
    if (total <= 7) {
        const pages = [];
        for (let i = 1; i <= total; i++) pages.push(i);
        return pages;
    }

    const result = [1];
    const left = Math.max(2, current - 1);
    const right = Math.min(total - 1, current + 1);

    if (left > 2) result.push('…');
    for (let i = left; i <= right; i++) result.push(i);
    if (right < total - 1) result.push('…');

    result.push(total);
    return result;
}

window.renderPagination = renderPagination;
