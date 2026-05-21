/**
 *  СТРАНИЦА: Статистика чтения — сводка, цели, активность, книги, жанры 
 *
 * НАЗНАЧЕНИЕ:
 * Страница статистики чтения с обзорными карточками, прогрессом целей,
 * календарём активности за год, топом книг и статистикой по жанрам.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ СТРАНИЦЫ //

const pageState = {
    overview: null,
    goals: [],
    daily: [],
    books: [],
    genres: [],
};

const ACTIVITY_DAYS_IN_YEAR = 365;

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function initStatisticsPage() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    initNavigation(user);

    await loadStatistics();
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadStatistics() {
    try {
        const today = new Date();
        const periodStart = new Date(today);
        periodStart.setDate(today.getDate() - (ACTIVITY_DAYS_IN_YEAR - 1));

        const fromDate = formatDateParam(periodStart);
        const toDate = formatDateParam(today);

        const [overview, goals, daily, books, genres] = await Promise.all([
            StatisticsService.getOverview(),
            StatisticsService.getGoalProgress(),
            StatisticsService.getDailyBreakdown(fromDate, toDate),
            StatisticsService.getBookStats(),
            StatisticsService.getGenreStats(),
        ]);

        pageState.overview = overview;
        pageState.goals = goals;
        pageState.daily = daily;
        pageState.books = books;
        pageState.genres = genres;

        renderOverview();
        renderGoals();
        renderDaily();
        renderBooks();
        renderGenres();
    } catch (error) {
        Notification.error('Не удалось загрузить статистику');
    }
}

//  4. РЕНДЕРИНГ: ОБЗОР  //

function renderOverview() {
    const container = Utils.getElement('stats-overview');

    if (!container || !pageState.overview) {
        return;
    }

    Utils.clearChildren(container);

    const data = pageState.overview;

    const cards = [
        {
            label: 'Книг / год',
            value: String(data.books_finished_year || data.books_finished || 0),
            icon: 'book-copy',
            iconClass: 'stat-card-icon-books',
        },
        {
            label: 'Страниц',
            value: Utils.formatNumber(data.total_pages || 0),
            icon: 'file-text',
            iconClass: 'stat-card-icon-pages',
        },
        {
            label: 'Часов',
            value: String(Math.round((data.total_minutes || 0) / MINUTES_PER_HOUR)),
            icon: 'clock',
            iconClass: 'stat-card-icon-hours',
        },
        {
            label: 'Сессий',
            value: String(data.total_sessions || 0),
            icon: 'timer',
            iconClass: 'stat-card-icon-sessions',
        },
    ];

    container.classList.add('stat-cards');

    cards.forEach(function (card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'stat-card';

        const iconElement = document.createElement('div');
        iconElement.className = 'stat-card-icon ' + card.iconClass;

        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', card.icon);
        iconElement.appendChild(icon);

        const valueElement = document.createElement('div');
        valueElement.className = 'stat-card-value';
        valueElement.textContent = card.value;

        const labelElement = document.createElement('div');
        labelElement.className = 'stat-card-label';
        labelElement.textContent = card.label;

        cardElement.appendChild(iconElement);
        cardElement.appendChild(valueElement);
        cardElement.appendChild(labelElement);
        container.appendChild(cardElement);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

//  5. РЕНДЕРИНГ: ЦЕЛИ  //

const GOAL_TYPE_LABELS = {
    books_year: 'Книги в год',
    pages_year: 'Страницы в год',
    daily_average: 'Минуты в день (среднее)',
};

const GOAL_PROGRESS_CLASSES = {
    books_year: 'progress-fill-primary',
    pages_year: 'progress-fill-accent',
    daily_average: 'progress-fill-tertiary',
};

function renderGoals() {
    const container = Utils.getElement('stats-goals');
    const periodElement = Utils.getElement('stats-goals-period');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    const goals = buildStatisticsGoals();

    if (periodElement) {
        periodElement.textContent = getGoalsPeriodLabel();
    }

    goals.forEach(function (goal) {
        const row = document.createElement('div');
        row.className = 'goal-item';

        const header = document.createElement('div');
        header.className = 'goal-header';

        const label = document.createElement('span');
        label.className = 'goal-label';
        label.textContent = GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type;

        const progress = document.createElement('span');
        progress.className = 'goal-value';
        progress.textContent = formatGoalProgress(goal);

        header.appendChild(label);
        header.appendChild(progress);

        const progressBar = document.createElement('div');
        progressBar.className = 'progress progress-lg';

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill ' + (GOAL_PROGRESS_CLASSES[goal.goal_type] || 'progress-fill-primary');
        progressFill.style.width = Math.min(goal.percentage, 100) + '%';
        progressBar.appendChild(progressFill);

        row.appendChild(header);
        row.appendChild(progressBar);
        container.appendChild(row);
    });
}

//  6. РЕНДЕРИНГ: АКТИВНОСТЬ ПО ДНЯМ  //

function renderDaily() {
    const container = Utils.getElement('stats-daily');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (pageState.daily.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'stats-empty';
        emptyMessage.textContent = 'Нет данных за этот период.';
        container.appendChild(emptyMessage);
        return;
    }

    if (typeof renderActivityCalendar === 'function') {
        container.appendChild(renderActivityCalendar({
            days: pageState.daily.map(function (day) {
                return {
                    date: day.date,
                    value: Number(day.total_minutes) || 0,
                };
            }),
            options: { showLegend: true },
        }));
    }
}

// 7. РЕНДЕРИНГ: ТОП КНИГ  //

function renderBooks() {
    const container = Utils.getElement('stats-books');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (pageState.books.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'stats-empty';
        emptyMessage.textContent = 'Нет данных о чтении книг с таймером.';
        container.appendChild(emptyMessage);
        return;
    }

    pageState.books.slice(0, STATISTICS_TOP_ITEMS_LIMIT).forEach(function (book, index) {
        const row = document.createElement('div');
        row.className = 'top-book-item';

        const rank = document.createElement('div');
        rank.className = 'top-book-rank' + (index === 0 ? ' top-book-rank-1' : '');
        rank.textContent = String(index + 1);

        const info = document.createElement('div');
        info.className = 'top-book-info';

        const title = document.createElement('div');
        title.className = 'top-book-title';
        title.textContent = book.book_title;

        const author = document.createElement('div');
        author.className = 'top-book-author';
        author.textContent = book.book_author || '';

        info.appendChild(title);
        info.appendChild(author);

        const minutesLabel = document.createElement('span');
        minutesLabel.className = 'top-book-time';
        minutesLabel.textContent = formatHoursMinutes(book.total_minutes);

        row.appendChild(rank);
        row.appendChild(info);
        row.appendChild(minutesLabel);
        container.appendChild(row);
    });
}

//  8. РЕНДЕРИНГ: ЖАНРЫ  //

function renderGenres() {
    const container = Utils.getElement('stats-genres');

    if (!container) {
        return;
    }

    Utils.clearChildren(container);

    if (pageState.genres.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'stats-empty';
        emptyMessage.textContent = 'Нет данных по жанрам.';
        container.appendChild(emptyMessage);
        return;
    }

    const maxCount = Math.max.apply(null, pageState.genres.map(function (genre) {
        return Number(genre.book_count || 0);
    }));
    const maxMinutes = Math.max.apply(null, pageState.genres.map(function (genre) {
        return Number(genre.total_minutes || 0);
    }));

    pageState.genres.slice(0, STATISTICS_TOP_ITEMS_LIMIT).forEach(function (genre, index) {
        const row = document.createElement('div');
        row.className = 'genre-item';

        const header = document.createElement('div');
        header.className = 'genre-header';

        const label = document.createElement('span');
        label.className = 'genre-label';
        label.textContent = Utils.formatGenre(genre.book_genre);

        const countLabel = document.createElement('span');
        countLabel.className = 'genre-count';
        countLabel.textContent = formatGenreCount(genre);

        header.appendChild(label);
        header.appendChild(countLabel);

        const progressBar = document.createElement('div');
        progressBar.className = 'progress progress-lg';

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill ' + getGenreProgressClass(index);
        progressFill.style.width = getGenreProgressWidth(genre, maxCount, maxMinutes) + '%';

        progressBar.appendChild(progressFill);
        row.appendChild(header);
        row.appendChild(progressBar);
        container.appendChild(row);
    });
}

//  9. ВСПОМОГАТЕЛЬНЫЕ  //

function buildStatisticsGoals() {
    const overview = pageState.overview || {};
    return [
        makeStatisticsGoal(
            'books_year',
            Number(overview.books_finished_year || overview.books_finished || 0),
            STATISTICS_DEFAULT_GOALS.BOOKS_PER_YEAR
        ),
        makeStatisticsGoal(
            'pages_year',
            Number(overview.total_pages || 0),
            STATISTICS_DEFAULT_GOALS.PAGES_PER_YEAR
        ),
        makeStatisticsGoal(
            'daily_average',
            getAverageDailyMinutes(overview.total_minutes),
            getConfiguredMinuteTarget('daily', STATISTICS_DEFAULT_GOALS.MINUTES_PER_DAY)
        ),
    ];
}

function getConfiguredMinuteTarget(goalType, fallbackValue) {
    const goal = pageState.goals.find(function (item) {
        return item.goal_type === goalType;
    });
    return goal ? Number(goal.target_minutes || fallbackValue) : fallbackValue;
}

function makeStatisticsGoal(goalType, actualValue, targetValue) {
    const normalizedActual = Math.max(0, Number(actualValue) || 0);
    const normalizedTarget = Math.max(1, Number(targetValue) || 1);

    return {
        goal_type: goalType,
        actual_value: normalizedActual,
        target_value: normalizedTarget,
        percentage: Math.min(100, Math.floor(normalizedActual / normalizedTarget * 100)),
    };
}

function getAverageDailyMinutes(totalMinutes) {
    return Math.round((Number(totalMinutes) || 0) / getElapsedYearDays());
}

function getElapsedYearDays() {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    return Math.max(1, Math.floor((now - yearStart) / MILLISECONDS_PER_DAY) + 1);
}

function formatGoalProgress(goal) {
    return Utils.formatNumber(goal.actual_value) + ' / ' + Utils.formatNumber(goal.target_value);
}

function getGoalsPeriodLabel() {
    return String(new Date().getFullYear()) + ' год';
}

function formatHoursMinutes(minutes) {
    const totalMinutes = Number(minutes) || 0;
    const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
    const restMinutes = totalMinutes % MINUTES_PER_HOUR;

    if (hours <= 0) {
        return String(restMinutes) + 'м';
    }

    return String(hours) + 'ч ' + String(restMinutes) + 'м';
}

function formatGenreCount(genre) {
    const bookCount = Number(genre.book_count || 0);

    if (bookCount > 0) {
        return String(bookCount) + ' ' + getBookCountWord(bookCount);
    }

    return Utils.formatMinutes(genre.total_minutes || 0);
}

function getBookCountWord(count) {
    const normalized = Math.abs(Number(count) || 0);
    const lastTwo = normalized % 100;
    const lastOne = normalized % 10;

    if (lastTwo >= 11 && lastTwo <= 14) {
        return 'книг';
    }

    if (lastOne === 1) {
        return 'книга';
    }

    if (lastOne >= 2 && lastOne <= 4) {
        return 'книги';
    }

    return 'книг';
}

function getGenreProgressWidth(genre, maxCount, maxMinutes) {
    const bookCount = Number(genre.book_count || 0);

    if (maxCount > 0) {
        return Math.max(4, Math.round(bookCount / maxCount * 100));
    }

    if (maxMinutes > 0) {
        return Math.max(4, Math.round((Number(genre.total_minutes) || 0) / maxMinutes * 100));
    }

    return 0;
}

function getGenreProgressClass(index) {
    const classes = [
        'progress-fill-primary',
        'progress-fill-info',
        'progress-fill-accent',
        'progress-fill-pink',
        'progress-fill-tertiary',
    ];

    return classes[index % classes.length];
}

function formatDateParam(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

// 10. ЗАПУСК  //

function destroy() {}

PageRegistry.register('statistics', {
    init: initStatisticsPage,
    destroy: destroy,
});
})();
