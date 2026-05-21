/**
 *  КОМПОНЕНТ: ActivityCalendar — Heatmap-календарь активности (365 дней) 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает DOM-блок `.calendar-wrap` с heatmap-календарём, подписями
 *   месяцев сверху, днями недели слева и опциональной легендой снизу
 *   (`.calendar-legend`).
 *   Используется на `statistics.html` и в админке.
 *   Основной вход: `days` — массив `{date: 'YYYY-MM-DD', value: number}`.
 */

function renderActivityCalendar(props) {
    const p = props || {};
    const opts = p.options || {};
    let days = Array.isArray(p.days) ? p.days.slice() : [];

    if (opts.weeks && Number(opts.weeks) > 0) {
        const limit = Number(opts.weeks) * 7;
        if (days.length > limit) days = days.slice(days.length - limit);
    }

    // --- Уровни 0..4 от max ---
    let max = 0;
    days.forEach((day) => {
        const v = Number(day && day.value) || 0;
        if (v > max) max = v;
    });

    const wrap = document.createElement('div');
    wrap.className = 'calendar-wrap';
    const tooltip = buildActivityTooltip();

    const calendar = buildCalendarCells(days);
    const months = buildCalendarMonths(calendar.weeks);

    const layout = document.createElement('div');
    layout.className = 'activity-calendar-layout';
    layout.style.setProperty('--activity-week-count', String(calendar.week_count));

    const monthsElement = document.createElement('div');
    monthsElement.className = 'activity-months';
    months.forEach((month) => {
        const label = document.createElement('span');
        label.className = 'activity-month-label';
        label.textContent = month.label;
        label.style.setProperty('--activity-month-start', String(month.start));
        label.style.setProperty('--activity-month-span', String(month.span));
        monthsElement.appendChild(label);
    });

    const weekdaysElement = document.createElement('div');
    weekdaysElement.className = 'activity-weekdays';
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((weekday) => {
        const label = document.createElement('span');
        label.textContent = weekday;
        weekdaysElement.appendChild(label);
    });

    const grid = document.createElement('div');
    grid.className = 'activity-calendar';

    calendar.cells.forEach((day) => {
        if (!day) {
            const placeholder = document.createElement('div');
            placeholder.className = 'activity-cell is-placeholder';
            placeholder.setAttribute('aria-hidden', 'true');
            grid.appendChild(placeholder);
            return;
        }

        const value = Number(day && day.value) || 0;
        const cell = document.createElement('div');
        const level = computeActivityLevel(value, max);
        cell.className = 'activity-cell' + (level > 0 ? (' activity-cell-' + level) : ' is-empty');
        const title = composeActivityCellTitle(day && day.date, value);
        cell.tabIndex = 0;
        cell.setAttribute('aria-label', title);
        cell.setAttribute('aria-describedby', tooltip.id);
        bindActivityTooltip(cell, wrap, tooltip, title);
        grid.appendChild(cell);
    });

    layout.appendChild(monthsElement);
    layout.appendChild(weekdaysElement);
    layout.appendChild(grid);
    wrap.appendChild(layout);
    wrap.appendChild(tooltip);

    // --- Легенда ---
    if (opts.showLegend !== false) {
        wrap.appendChild(buildActivityLegend());
    }

    return wrap;
}

function buildActivityTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = 'activity-tooltip';
    tooltip.id = 'activity-tooltip-' + Math.random().toString(36).slice(2);
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');

    return tooltip;
}

function bindActivityTooltip(cell, wrap, tooltip, text) {
    cell.addEventListener('mouseenter', function () {
        showActivityTooltip(wrap, tooltip, cell, text);
    });
    cell.addEventListener('mousemove', function () {
        positionActivityTooltip(wrap, tooltip, cell);
    });
    cell.addEventListener('mouseleave', function () {
        hideActivityTooltip(tooltip);
    });
    cell.addEventListener('focus', function () {
        showActivityTooltip(wrap, tooltip, cell, text);
    });
    cell.addEventListener('blur', function () {
        hideActivityTooltip(tooltip);
    });
}

function showActivityTooltip(wrap, tooltip, cell, text) {
    tooltip.textContent = text;
    tooltip.classList.add('is-visible');
    tooltip.setAttribute('aria-hidden', 'false');
    positionActivityTooltip(wrap, tooltip, cell);
}


function hideActivityTooltip(tooltip) {
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
}

function positionActivityTooltip(wrap, tooltip, cell) {
    const wrapRect = wrap.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const sideGap = 6;

    let left = cellRect.left - wrapRect.left + (cellRect.width / 2);
    const minLeft = (tooltipRect.width / 2) + sideGap;
    const maxLeft = wrapRect.width - (tooltipRect.width / 2) - sideGap;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    const topPlacement = cellRect.top - wrapRect.top - sideGap;
    const shouldPlaceBelow = topPlacement < tooltipRect.height + sideGap;
    const top = shouldPlaceBelow
        ? cellRect.bottom - wrapRect.top + sideGap
        : topPlacement;

    tooltip.classList.toggle('is-below', shouldPlaceBelow);
    tooltip.style.setProperty('--activity-tooltip-left', String(Math.round(left)) + 'px');
    tooltip.style.setProperty('--activity-tooltip-top', String(Math.round(top)) + 'px');
}

function buildCalendarCells(days) {
    const cells = [];
    const firstDay = days[0] || null;
    const leadingEmptyCells = firstDay ? getMondayBasedWeekdayIndex(firstDay.date) : 0;

    for (let i = 0; i < leadingEmptyCells; i += 1) {
        cells.push(null);
    }

    days.forEach((day) => cells.push(day));

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    const weekCount = Math.max(1, Math.ceil(cells.length / 7));
    const weeks = [];

    for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
        const weekCells = cells.slice(weekIndex * 7, weekIndex * 7 + 7);
        weeks.push({
            index: weekIndex,
            days: weekCells.filter((day) => day !== null),
            first_day: weekCells.find((day) => day !== null) || null,
        });
    }

    return {
        cells: cells,
        weeks: weeks,
        week_count: weekCount,
    };
}

function buildCalendarMonths(weeks) {
    const months = [];
    let activeMonth = null;

    weeks.forEach((week) => {
        const date = getCalendarWeekMonthDate(week, activeMonth);
        const monthKey = date ? String(date.getFullYear()) + '-' + String(date.getMonth()) : activeMonth;

        if (!date || monthKey === activeMonth) {
            if (months.length > 0) {
                months[months.length - 1].span += 1;
            }
            return;
        }

        activeMonth = monthKey;
        months.push({
            label: getActivityMonthName(date),
            start: week.index + 1,
            span: 1,
        });
    });

    return months;
}

function getCalendarWeekMonthDate(week, activeMonth) {
    const days = Array.isArray(week.days) ? week.days : [];

    for (let index = 0; index < days.length; index += 1) {
        const date = parseActivityDate(days[index] && days[index].date);
        const monthKey = date ? String(date.getFullYear()) + '-' + String(date.getMonth()) : null;

        if (date && monthKey !== activeMonth) {
            return date;
        }
    }

    return parseActivityDate(week.first_day && week.first_day.date);
}

function getMondayBasedWeekdayIndex(dateString) {
    const date = parseActivityDate(dateString);
    if (!date) return 0;
    return (date.getDay() + 6) % 7;
}

function getActivityMonthName(date) {
    return date.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
}

function computeActivityLevel(value, max) {
    if (!value || value <= 0 || max <= 0) return 0;
    const ratio = value / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
}

function composeActivityCellTitle(dateString, value) {
    const dateText = formatActivityDateTitle(dateString);
    return capitalizeFirstLetter(dateText) + '\n' + formatActivityReadingTime(value);
}

function formatActivityDateTitle(dateString) {
    const date = parseActivityDate(dateString);
    if (!date) return Utils.safeText(dateString, 'День не указан');

    return date.toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function capitalizeFirstLetter(text) {
    const normalizedText = String(text || '');
    if (normalizedText.length === 0) return normalizedText;

    return normalizedText.charAt(0).toLocaleUpperCase('ru-RU') + normalizedText.slice(1);
}

function formatActivityReadingTime(minutes) {
    const normalizedMinutes = Math.max(0, Number(minutes) || 0);
    const hours = Math.floor(normalizedMinutes / MINUTES_PER_HOUR);
    const restMinutes = normalizedMinutes % MINUTES_PER_HOUR;
    const parts = [];

    if (hours > 0) {
        parts.push(String(hours) + ' ' + getActivityTimeWord(hours, 'час', 'часа', 'часов'));
    }

    if (restMinutes > 0 || parts.length === 0) {
        parts.push(String(restMinutes) + ' ' + getActivityTimeWord(restMinutes, 'минута', 'минуты', 'минут'));
    }

    return parts.join(' ') + ' чтения';
}

function getActivityTimeWord(value, one, few, many) {
    const normalizedValue = Math.abs(Number(value) || 0);
    const lastTwo = normalizedValue % 100;
    const lastOne = normalizedValue % 10;

    if (lastTwo >= 11 && lastTwo <= 14) {
        return many;
    }

    if (lastOne === 1) {
        return one;
    }

    if (lastOne >= 2 && lastOne <= 4) {
        return few;
    }

    return many;
}

function parseActivityDate(dateString) {
    if (!dateString) return null;

    const date = new Date(dateString + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildActivityLegend() {
    const legend = document.createElement('div');
    legend.className = 'calendar-legend';

    const less = document.createElement('span');
    less.textContent = 'Меньше';
    legend.appendChild(less);

    [0, 1, 2, 3, 4].forEach((level) => {
        const swatch = document.createElement('span');
        swatch.className = 'calendar-legend-cell' + (level > 0 ? (' activity-cell-' + level) : ' is-empty');
        legend.appendChild(swatch);
    });

    const more = document.createElement('span');
    more.textContent = 'Больше';
    legend.appendChild(more);

    return legend;
}

window.renderActivityCalendar = renderActivityCalendar;
