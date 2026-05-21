/**
 *  КОМПОНЕНТ: StarRating — Интерактивный рейтинг звёздами (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 * Виджет 5 звёзд для оценки книги. Кликабельные кнопки, подсветка при наведении,
 * callback при изменении. Раскладка соответствует шаблону Modern Botanical
 * (см. `!etc/design/modern-botanical/components.html` § 6 STAR RATING):
 */

//  1. РЕНДЕРИНГ ВИДЖЕТА  //

function renderStarRating(options) {
    const opts = options || {};
    const value = opts.value || 0;
    const onChange = opts.onChange || null;
    const isReadonly = onChange === null;

    const container = document.createElement('div');
    container.className = 'star-rating';
    if (isReadonly) container.classList.add('is-readonly');

    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'star-rating-star';
        star.dataset.value = i;
        star.textContent = '★'; // ★

        if (i <= value) star.classList.add('is-filled');

        if (!isReadonly) {
            star.addEventListener('mouseenter', () => highlightStars(container, i));
            star.addEventListener('click', () => {
                setRatingValue(container, i);
                onChange(i);
            });
        } else {
            star.disabled = true;
        }

        container.appendChild(star);
    }

    if (!isReadonly) {
        container.addEventListener('mouseleave', () => {
            const currentValue = parseInt(container.dataset.value || value, 10);
            highlightStars(container, currentValue);
        });
    }

    container.dataset.value = value;
    return container;
}

//  2. ВНУТРЕННИЕ ХЕЛПЕРЫ  //

function highlightStars(container, upTo) {
    const stars = container.querySelectorAll('.star-rating-star');
    stars.forEach((star) => {
        const v = parseInt(star.dataset.value, 10);
        if (v <= upTo) {
            star.classList.add('is-filled');
        } else {
            star.classList.remove('is-filled');
        }
    });
}

function setRatingValue(container, value) {
    container.dataset.value = value;
    highlightStars(container, value);
}
