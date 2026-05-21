/**
 *  КОМПОНЕНТ: TimerDisplay — Таймер чтения (Modern Botanical) 
 *
 * НАЗНАЧЕНИЕ:
 * Только визуальный рендер таймера, без `setInterval`. Соответствует шаблону
 * Modern Botanical (см. `!etc/design/modern-botanical/components.html` § 8 TIMER):
 */

//  1. ЛОКАЛЬНЫЕ КОНСТАНТЫ  //

const TIMER_STATUS_LABELS = {
    idle:    'Готов к запуску',
    running: 'Идёт чтение',
    paused:  'На паузе',
    break:   'Перерыв',
};

const TIMER_STATUS_ICONS = {
    idle:    'play-circle',
    running: 'timer',
    paused:  'pause-circle',
    break:   'coffee',
};

//  2. РЕНДЕРИНГ ТАЙМЕРА  //

function renderTimerDisplay(options) {
    const status = options.status || 'idle';

    const container = document.createElement('div');
    container.className = 'timer-display';

    container.appendChild(buildTimerStatus(status));

    const time = document.createElement('div');
    time.className = 'timer-time';
    time.textContent = Utils.formatTime(options.remainingSeconds || 0);
    container.appendChild(time);

    container.appendChild(buildTimerControls(status, options));

    if (shouldShowTimerBook(status)) {
        container.appendChild(buildTimerBook(options.currentBook, options));
    }

    if (typeof options.sessionCount === 'number') {
        const session = document.createElement('div');
        session.className = 'timer-session-count';
        session.textContent = 'Завершённых сессий: ' + options.sessionCount;
        container.appendChild(session);
    }

    return container;
}

//  3. ВНУТРЕННИЕ БИЛДЕРЫ  //

function buildTimerStatus(status) {
    const wrap = document.createElement('div');
    wrap.className = 'timer-status';

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', TIMER_STATUS_ICONS[status] || 'timer');
    wrap.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = TIMER_STATUS_LABELS[status] || '';
    wrap.appendChild(label);

    return wrap;
}

function buildTimerControls(status, options) {
    const controls = document.createElement('div');
    controls.className = 'timer-controls';

    if (status === 'idle' && options.onStart) {
        controls.appendChild(makeTimerButton('play', 'Начать', 'btn btn-primary btn-lg', options.onStart));
    }

    if (status === 'running') {
        if (options.onPause) {
            controls.appendChild(makeTimerButton('pause', 'Пауза', 'btn btn-primary btn-lg', options.onPause));
        }
        if (options.onCancel) {
            controls.appendChild(makeTimerButton('x', 'Отмена', 'btn btn-outlined btn-lg', options.onCancel));
        }
    }

    if (status === 'paused') {
        if (options.onResume) {
            controls.appendChild(makeTimerButton('play', 'Продолжить', 'btn btn-primary btn-lg', options.onResume));
        }
        if (options.onCancel) {
            controls.appendChild(makeTimerButton('x', 'Отмена', 'btn btn-outlined btn-lg', options.onCancel));
        }
    }

    if (status === 'break' && options.onSkipBreak) {
        controls.appendChild(makeTimerButton('skip-forward', 'Пропустить перерыв', 'btn btn-outlined btn-lg', options.onSkipBreak));
    }

    return controls;
}

function shouldShowTimerBook(status) {
    return status === 'running' || status === 'paused';
}

function buildTimerBook(book, options) {
    const wrap = document.createElement('div');
    wrap.className = 'timer-book';

    const cover = document.createElement('div');
    cover.className = 'timer-book-cover';
    if (book) {
        cover.appendChild(Utils.createImage(
            book.edition_cover_path || book.cover_path,
            book.text,
            DEFAULT_BOOK_COVER_URL
        ));
    } else {
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'book');
        cover.appendChild(icon);
    }
    wrap.appendChild(cover);

    const info = document.createElement('div');
    info.className = 'timer-book-info';

    const text = String(book?.text || '');
    const parts = text.split(' — ');

    const title = document.createElement('div');
    title.className = 'timer-book-title';
    title.textContent = book ? (parts[0] || 'Книга') : 'Книга не выбрана';
    info.appendChild(title);

    if (book && parts.length > 1) {
        const author = document.createElement('div');
        author.className = 'timer-book-author';
        author.textContent = parts.slice(1).join(' — ');
        info.appendChild(author);
    }

    info.appendChild(buildTimerProgress(options));

    wrap.appendChild(info);
    return wrap;
}

function buildTimerProgress(options) {
    const progress = document.createElement('div');
    progress.className = 'timer-progress';

    const label = document.createElement('div');
    label.className = 'timer-progress-label';

    const bar = document.createElement('div');
    bar.className = 'timer-progress-bar';

    const fill = document.createElement('div');
    fill.className = 'timer-progress-fill';
    let percent = 0;

    if (options.totalSeconds > 0) {
        const elapsed = options.totalSeconds - options.remainingSeconds;
        percent = Math.min(100, Math.max(0, (elapsed / options.totalSeconds) * 100));
    }

    label.textContent = 'Прогресс: ' + Math.round(percent) + '%';
    fill.style.width = percent + '%';

    bar.appendChild(fill);
    progress.appendChild(label);
    progress.appendChild(bar);

    return progress;
}

function makeTimerButton(iconName, text, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    btn.appendChild(icon);

    const span = document.createElement('span');
    span.textContent = text;
    btn.appendChild(span);

    btn.addEventListener('click', onClick);
    return btn;
}
