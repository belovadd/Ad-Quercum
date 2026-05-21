/**
 * СТРАНИЦА: Растение (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 *   Полноэкранное отображение растения пользователя: hero-блок с прогрессом,
 *   статистика роста (4 карточки), сетка стадий и таймлайн истории.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const pageState = {
    plant: null,
    history: [],
    isLoading: false,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    if (typeof initNavigation === 'function') {
        initNavigation(user);
    }

    await loadPlantData();
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadPlantData() {
    if (pageState.isLoading) return;
    pageState.isLoading = true;

    try {
        const [plant, history] = await Promise.all([
            TimerService.getPlantState(),
            TimerService.getPlantHistory(),
        ]);

        pageState.plant = plant || {};
        pageState.history = Array.isArray(history) ? history : [];

        renderPlant();
        renderStats();
        renderStagesReference();
        renderHistory();

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    } catch (error) {
        Notification.error('Ошибка загрузки данных растения');
    } finally {
        pageState.isLoading = false;
    }
}

//  4. РЕНДЕРИНГ  //

function renderPlant() {
    const container = Utils.getElement('plant-display');
    if (!container) return;
    Utils.clearChildren(container);
    if (!pageState.plant) return;

    const heroEl = renderPlantDisplay({
        stage: pageState.plant.stage,
        sessionCount: parseInt(pageState.plant.session_count_completed, 10) || 0,
        nextStage: pageState.plant.next_stage,
        sessionsToNext: parseInt(pageState.plant.sessions_to_next, 10) || 0,
        compact: false,
    });

    container.appendChild(heroEl);
}

function renderStats() {
    const container = Utils.getElement('plant-stats');
    if (!container) return;
    Utils.clearChildren(container);

    const plant = pageState.plant || {};
    const completedSessions = parseInt(plant.session_count_completed, 10) || 0;
    const totalMinutes = parseInt(plant.total_minutes_focused, 10) || 0;
    const stagesPassed = pageState.history.length;
    const booksFinished = parseInt(plant.books_finished, 10) || 0;

    const cards = [
        { label: 'Сеансов', value: String(completedSessions) },
        { label: 'Время чтения', value: Utils.formatMinutes(totalMinutes) },
        { label: 'Стадий пройдено', value: String(stagesPassed) },
        { label: 'Книг прочитано', value: String(booksFinished) },
    ];

    cards.forEach(function (card) {
        container.appendChild(buildStatCard(card));
    });
}

function buildStatCard(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'plant-stat';

    const value = document.createElement('div');
    value.className = 'plant-stat-value';
    value.textContent = cfg.value;
    wrap.appendChild(value);

    const label = document.createElement('div');
    label.className = 'plant-stat-label';
    label.textContent = cfg.label;
    wrap.appendChild(label);

    return wrap;
}

function renderStagesReference() {
    const container = Utils.getElement('plant-stages-reference');
    if (!container) return;
    Utils.clearChildren(container);

    const currentStage = pageState.plant ? pageState.plant.stage : null;
    const grid = renderPlantStages(currentStage);

    // Компонент создаёт обёртку `.plant-stages`. Сама секция уже имеет тот же
    // CSS-класс из шаблона; чтобы не дублировать, переносим её детей внутрь.
    while (grid.firstChild) {
        container.appendChild(grid.firstChild);
    }
}

function renderHistory() {
    const container = Utils.getElement('plant-history');
    if (!container) return;
    Utils.clearChildren(container);

    if (pageState.history.length === 0) {
        container.appendChild(renderEmptyState({
            message: 'История роста пуста',
            iconName: 'sprout',
            subtitle: 'Завершите первую сессию, чтобы запустить рост',
        }));
        return;
    }

    const list = document.createElement('div');
    list.className = 'timeline';

    pageState.history.forEach(function (transition) {
        const item = document.createElement('div');
        item.className = 'timeline-item';

        const dot = document.createElement('span');
        dot.className = 'timeline-dot';
        item.appendChild(dot);

        const date = document.createElement('div');
        date.className = 'timeline-date';
        date.textContent = Utils.formatDate(transition.time_created);
        item.appendChild(date);

        const title = document.createElement('div');
        title.className = 'timeline-title';
        const fromLabel = PLANT_STAGE_LABELS[transition.stage_from] || transition.stage_from || '—';
        const toLabel = PLANT_STAGE_LABELS[transition.stage_to] || transition.stage_to || '—';
        title.textContent = 'Новая стадия: ' + toLabel;
        item.appendChild(title);

        const desc = document.createElement('div');
        desc.className = 'timeline-desc';
        desc.textContent = 'Переход из стадии «' + fromLabel + '» в стадию «' + toLabel + '».';
        item.appendChild(desc);

        const xp = document.createElement('div');
        xp.className = 'timeline-xp';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'sparkles');
        xp.appendChild(icon);
        const sessions = parseInt(transition.session_count_at_transition, 10) || 0;
        const text = document.createElement('span');
        text.textContent = 'Сессий: ' + sessions;
        xp.appendChild(text);
        item.appendChild(xp);

        list.appendChild(item);
    });

    container.appendChild(list);
}

//  5. ЗАПУСК  //

function destroy() {}

PageRegistry.register('plant', {
    init: init,
    destroy: destroy,
});
})();
