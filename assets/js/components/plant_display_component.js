/**
 *  КОМПОНЕНТ: PlantDisplay — Растение с прогрессом (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 * Рендер «героя» растения и (опционально) сетки стадий. Раскладка соответствует
 * шаблону Modern Botanical (см. `!etc/design/modern-botanical/page-plant.html`):
 */

//  1. ЛОКАЛЬНЫЕ КОНСТАНТЫ  //

const PLANT_STAGE_ORDER = ['seed', 'sprout', 'young_plant', 'adult_plant', 'flowering', 'oak'];

const PLANT_STAGE_ICONS = {
    seed: 'circle',
    sprout: 'sprout',
    young_plant: 'leaf',
    adult_plant: 'trees',
    flowering: 'flower-2',
    oak: 'tree-pine',
};

//  2. РЕНДЕРИНГ ГЛАВНОГО БЛОКА //

function renderPlantDisplay(options) {
    const stage = options.stage || PLANT_STAGE.SEED;
    const sessionCount = options.sessionCount || 0;
    const nextStage = options.nextStage;

    const hero = document.createElement('div');
    hero.className = 'plant-hero';
    if (options.compact) hero.classList.add('plant-hero-compact');

    // Изображение стадии
    const iconLarge = document.createElement('div');
    iconLarge.className = 'plant-icon-large';
    const imageUrl = options.compact
        ? getPlantAssetUrl(stage, 'thumb')
        : (options.imageUrl || getPlantAssetUrl(stage, 'main'));
    appendPlantImage(
        iconLarge,
        stage,
        imageUrl,
        'plant-art-large'
    );
    hero.appendChild(iconLarge);

    // Название стадии
    const name = document.createElement('div');
    name.className = 'plant-name';
    name.textContent = PLANT_STAGE_LABELS[stage] || stage;
    hero.appendChild(name);

    // Подпись текущей стадии
    const subtitle = document.createElement('div');
    subtitle.className = 'plant-stage-label';
    subtitle.textContent = 'Растёт вместе с вашими знаниями';
    hero.appendChild(subtitle);

    const stageInfo = document.createElement('div');
    stageInfo.className = 'plant-stage-meta';
    stageInfo.textContent = 'Стадия ' + getPlantStageNumber(stage) + ' из ' + PLANT_STAGE_ORDER.length;
    hero.appendChild(stageInfo);

    if (options.compact) {
        const sessions = document.createElement('div');
        sessions.className = 'plant-session-count';
        sessions.textContent = 'Завершённых сессий ' + sessionCount;
        hero.appendChild(sessions);
    }

    // Прогресс до следующей стадии
    if (nextStage) {
        const xpSection = document.createElement('div');
        xpSection.className = 'plant-xp-section';

        const header = document.createElement('div');
        header.className = 'plant-xp-header';

        const value = document.createElement('span');
        value.className = 'plant-xp-value';
        value.textContent = sessionCount + ' / ' + (PLANT_STAGE_THRESHOLDS[nextStage] || sessionCount) + ' сессий';
        header.appendChild(value);

        xpSection.appendChild(header);

        const bar = document.createElement('div');
        bar.className = 'progress progress-lg';
        const fill = document.createElement('div');
        fill.className = 'progress-fill';
        fill.style.width = computeXpPercentage(stage, nextStage, sessionCount) + '%';
        bar.appendChild(fill);
        xpSection.appendChild(bar);

        const next = document.createElement('div');
        next.className = 'plant-xp-next';
        next.textContent = 'Ещё ' + (options.sessionsToNext || 0) + ' сессий до следующей стадии';
        xpSection.appendChild(next);

        hero.appendChild(xpSection);
    } else {
        const max = document.createElement('div');
        max.className = 'plant-xp-next';
        max.textContent = 'Максимальная стадия достигнута';
        hero.appendChild(max);
    }

    return hero;
}

function getPlantStageNumber(stage) {
    const index = PLANT_STAGE_ORDER.indexOf(stage);
    return index >= 0 ? index + 1 : 1;
}

//  3. СЕТКА СТАДИЙ  //

function renderPlantStages(currentStage) {
    const grid = document.createElement('div');
    grid.className = 'plant-stages';

    const currentIndex = PLANT_STAGE_ORDER.indexOf(currentStage);

    PLANT_STAGE_ORDER.forEach((stage, index) => {
        const card = document.createElement('div');
        card.className = 'plant-stage-card';
        let iconClass = 'plant-stage-icon-locked';

        if (index < currentIndex) {
            card.classList.add('is-completed');
            iconClass = 'plant-stage-icon-completed';
        } else if (index === currentIndex) {
            card.classList.add('is-current');
            iconClass = 'plant-stage-icon-current';
        } else {
            card.classList.add('is-locked');
        }

        const iconWrap = document.createElement('div');
        iconWrap.className = 'plant-stage-icon ' + iconClass;
        appendPlantImage(
            iconWrap,
            stage,
            getPlantAssetUrl(stage, 'icon'),
            'plant-stage-art'
        );
        card.appendChild(iconWrap);

        const name = document.createElement('div');
        name.className = 'plant-stage-name';
        name.textContent = PLANT_STAGE_LABELS[stage] || stage;
        card.appendChild(name);

        const threshold = document.createElement('div');
        threshold.className = 'plant-xp-next';
        threshold.textContent = (PLANT_STAGE_THRESHOLDS[stage] || 0) + '+';
        card.appendChild(threshold);

        grid.appendChild(card);
    });

    return grid;
}

//  4. ВНУТРЕННИЕ ХЕЛПЕРЫ  //

function getPlantAssetUrl(stage, variant) {
    const baseUrl = PLANT_IMAGE_URLS[stage] || '';
    if (!baseUrl || variant === 'main') return baseUrl;

    const queryIndex = baseUrl.indexOf('?');
    const path = queryIndex === -1 ? baseUrl : baseUrl.substring(0, queryIndex);
    const query = queryIndex === -1 ? '' : baseUrl.substring(queryIndex);

    return path.replace(/\.(png|jpe?g|webp)$/, '_' + variant + '.$1') + query;
}

function appendPlantImage(container, stage, imageUrl, imageClass) {
    if (!imageUrl) {
        appendPlantFallbackIcon(container, stage);
        return;
    }

    const image = document.createElement('img');
    image.className = imageClass;
    image.src = imageUrl;
    image.alt = PLANT_STAGE_LABELS[stage] || stage;
    image.loading = 'lazy';
    image.addEventListener('error', function () {
        Utils.clearChildren(container);
        appendPlantFallbackIcon(container, stage);
    }, { once: true });
    container.appendChild(image);
}

function appendPlantFallbackIcon(container, stage) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', PLANT_STAGE_ICONS[stage] || 'tree-pine');
    container.appendChild(icon);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function computeXpPercentage(stage, nextStage, sessionCount) {
    const current = PLANT_STAGE_THRESHOLDS[stage] || 0;
    const next = PLANT_STAGE_THRESHOLDS[nextStage] || 0;
    const range = next - current;
    if (range <= 0) return 0;

    const progress = sessionCount - current;
    const percent = (progress / range) * 100;
    return Math.min(100, Math.max(0, percent));
}
