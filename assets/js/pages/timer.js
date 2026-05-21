/**
 *  СТРАНИЦА: Таймер чтения — сессии, помодоро, настройки 
 *
 * НАЗНАЧЕНИЕ:
 * Управление таймером чтения с клиентским отсчётом (setInterval),
 * режим помодоро с длинными перерывами, встроенные настройки,
 * мини-блок растения.
 */

(function () {
'use strict';

const TimerPage = {};
window.TimerPage = TimerPage;

//  1. СОСТОЯНИЕ СТРАНИЦЫ  //

const pageState = {
    sessionId: null,
    timerStatus: 'idle',        // idle, running, paused, break
    remainingSeconds: 0,
    totalSeconds: 0,
    elapsedSeconds: 0,
    intervalId: null,
    pomodoroCount: 0,
    settings: null,
    books: [],
    selectedBook: null,
    currentUserId: null,
    plant: null,
    isLoading: false,
};

//  2. ИНИЦИАЛИЗАЦИЯ  //

async function init() {
    const user = await AuthGuard.requireAuth();
    if (!user) return;

    pageState.currentUserId = user.id;
    initNavigation(user);
    TimerRadioHandlers.init();

    await loadInitialData();

    // Пробуем восстановить из sessionStorage
    const restored = restoreFromStorage();

    // Если не восстановили — проверяем бэкенд
    if (!restored) {
        await checkActiveSession();
    }

    renderPage();
    setupEventListeners();

    if (pageState.timerStatus === 'running') {
        startCountdown();
    }

    if (pageState.sessionId) {
        TimerPage.loadAndRenderNotes();
    }
}

//  3. ЗАГРУЗКА ДАННЫХ  //

async function loadInitialData() {
    try {
        const [settings, books, plant] = await Promise.all([
            TimerService.getSettings(),
            LibraryService.searchUserLibrary({ page: PAGINATION_DEFAULT_PAGE, perPage: USER_LIBRARY_SELECT_LIMIT }),
            TimerService.getPlantState(),
        ]);

        pageState.settings = settings;
        pageState.plant = plant;
        pageState.books = books.items || [];
        pageState.selectedBook = restoreLastSelectedBook();
        syncIdleTimerDuration();
    } catch (error) {
        Notification.error('Ошибка загрузки данных');
    }
}

function renderPage() {
    renderBookSelector(pageState.books);
    renderSettingsForm();
    renderPlantMini();
    renderTimerUI();
    TimerRadioHandlers.render();
}

async function checkActiveSession() {
    try {
        const session = await TimerService.getActiveSession();

        if (session) {
            pageState.sessionId = session.id;
            pageState.totalSeconds = parseInt(session.session_duration_planned, 10);
            pageState.timerStatus = session.session_status === SESSION_STATUS.PAUSED ? 'paused' : 'running';
            pageState.remainingSeconds = pageState.totalSeconds;
            pageState.elapsedSeconds = 0;
            pageState.selectedBook = session.book_id ? {
                id: Number(session.book_id),
                text: session.book_title
                    ? session.book_title + (session.book_author ? ' — ' + session.book_author : '')
                    : 'Книга #' + session.book_id,
                edition_cover_path: session.edition_cover_path || null,
            } : null;
            saveLastSelectedBook(pageState.selectedBook);
        }
    } catch (error) {
        // Нет активной сессии — ничего не делаем
    }
}

//  4. РЕНДЕРИНГ  //

function renderTimerUI() {
    const container = Utils.getElement('timer-container');
    if (!container) return;

    syncIdleTimerDuration();
    Utils.clearChildren(container);

    const timerElement = renderTimerDisplay({
        remainingSeconds: pageState.remainingSeconds,
        totalSeconds: pageState.totalSeconds,
        status: pageState.timerStatus,
        onStart: handleStart,
        onPause: handlePause,
        onResume: handleResume,
        onCancel: handleCancel,
        onSkipBreak: handleSkipBreak,
        currentBook: pageState.selectedBook,
    });

    container.appendChild(timerElement);

    // Показать/скрыть секции в зависимости от статуса
    const isIdle = pageState.timerStatus === 'idle';
    const bookBindingSection = Utils.getElement('book-binding-section');
    const bookSelector = Utils.getElement('book-selector-section');
    const bookInfoSection = Utils.getElement('book-info-section');

    if (bookBindingSection) {
        if (isIdle) {
            Utils.showElement(bookBindingSection);
        } else {
            Utils.hideElement(bookBindingSection);
        }
    }

    if (bookSelector) {
        if (isIdle) {
            Utils.showElement(bookSelector);
        } else {
            Utils.hideElement(bookSelector);
        }
    }

    if (bookInfoSection) {
        Utils.hideElement(bookInfoSection);
    }

    const settingsBox = Utils.getElement('settings-box');
    if (settingsBox) {
        if (isIdle) {
            Utils.showElement(settingsBox);
        } else {
            Utils.hideElement(settingsBox);
        }
    }

    // Помодоро-инфо
    renderPomodoroInfo();

    // Заметки доступны только когда сессия запущена и привязана книга.
    TimerPage.toggleNotesSections();

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function renderBookSelector(books) {
    const root = Utils.getElement('book-binding-search');
    if (!root) return;

    Utils.clearChildren(root);
    root.appendChild(renderTimerBookSearchComponent({
        books: books,
        selectedBook: pageState.selectedBook,
        onSelect: function (book) {
            pageState.selectedBook = book;
            saveLastSelectedBook(book);
        },
        onClear: function () {
            pageState.selectedBook = null;
            clearLastSelectedBook();
        },
    }));
}

function renderBookInfo() {
    const textEl = Utils.getElement('book-info-text');
    if (!textEl) return;

    if (pageState.selectedBook) {
        textEl.textContent = pageState.selectedBook.text;
        textEl.classList.remove('muted-text');
    } else {
        textEl.textContent = 'Привязка к книге отсутствует';
        textEl.classList.add('muted-text');
    }
}

function renderSettingsForm() {
    if (!pageState.settings) return;

    const workDurationInput = Utils.getElement('setting-work-duration');
    const shortBreakInput = Utils.getElement('setting-short-break');
    const soundCheckbox = Utils.getElement('setting-sound-enabled');

    if (workDurationInput) {
        renderTimerSelectOptions(workDurationInput, TIMER_WORK_DURATION_PRESETS);
        workDurationInput.value = String(secondsToMinutes(pageState.settings.setting_work_duration));
    }

    if (shortBreakInput) {
        renderTimerSelectOptions(shortBreakInput, TIMER_SHORT_BREAK_PRESETS);
        shortBreakInput.value = String(secondsToMinutes(pageState.settings.setting_short_break));
    }

    if (soundCheckbox) {
        soundCheckbox.checked = parseInt(pageState.settings.is_sound_enabled, 10) === 1;
    }
}

function renderTimerSelectOptions(selectElement, presets) {
    if (selectElement.options.length > 0) return;

    presets.forEach(function (preset) {
        const option = document.createElement('option');
        option.value = String(preset.minutes);
        option.textContent = preset.label;
        selectElement.appendChild(option);
    });
}

function secondsToMinutes(seconds) {
    const parsedSeconds = parseInt(seconds, 10);
    return Number.isFinite(parsedSeconds)
        ? Math.floor(parsedSeconds / SECONDS_PER_MINUTE)
        : 0;
}

function minutesToSeconds(minutes) {
    return minutes * SECONDS_PER_MINUTE;
}

function timerLimitMinutes(limitSeconds) {
    return Math.floor(limitSeconds / SECONDS_PER_MINUTE);
}

function getWorkDurationSeconds() {
    if (!pageState.settings) return TIMER_DEFAULTS.WORK_DURATION;

    const duration = parseInt(pageState.settings.setting_work_duration, 10);
    return Number.isFinite(duration) && duration > 0 ? duration : TIMER_DEFAULTS.WORK_DURATION;
}

function syncIdleTimerDuration() {
    if (pageState.timerStatus !== 'idle') return;

    const duration = getWorkDurationSeconds();
    pageState.totalSeconds = duration;
    pageState.remainingSeconds = duration;
    pageState.elapsedSeconds = 0;
}

function renderPlantMini() {
    const container = Utils.getElement('plant-mini');
    if (!container || !pageState.plant) return;

    Utils.clearChildren(container);

    const plantElement = renderPlantDisplay({
        stage: pageState.plant.stage,
        imageUrl: pageState.plant.image_url,
        sessionCount: pageState.plant.session_count_completed,
        nextStage: pageState.plant.next_stage,
        sessionsToNext: pageState.plant.sessions_to_next,
        compact: true,
    });

    const plantImage = plantElement.querySelector('.plant-icon-large');
    if (plantImage) {
        plantImage.classList.add('is-clickable');
        plantImage.setAttribute('role', 'button');
        plantImage.setAttribute('tabindex', '0');
        plantImage.setAttribute('aria-label', 'Открыть страницу растения');
        plantImage.addEventListener('click', openPlantPage);
        plantImage.addEventListener('keydown', handlePlantImageKeydown);
    }

    container.appendChild(plantElement);

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function openPlantPage() {
    PageRouter.open(PAGE_URL.PLANT);
}

function handlePlantImageKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    openPlantPage();
}

function renderPomodoroInfo() {
    const container = Utils.getElement('pomodoro-info');
    const section = Utils.getElement('pomodoro-info-section');
    if (!container) return;

    Utils.clearChildren(container);
    if (section) {
        Utils.hideElement(section);
    }
}

//  5. ЛОГИКА ТАЙМЕРА  //

function startCountdown() {
    stopCountdown();

    pageState.intervalId = setInterval(function () {
        if (pageState.remainingSeconds <= 0) {
            stopCountdown();
            handleTimerComplete();
            return;
        }

        pageState.remainingSeconds--;
        pageState.elapsedSeconds++;
        updateTimerDisplay();
    }, TIMER_TICK_INTERVAL_MS);
}

function stopCountdown() {
    if (pageState.intervalId !== null) {
        clearInterval(pageState.intervalId);
        pageState.intervalId = null;
    }
}

function updateTimerDisplay() {
    const container = Utils.getElement('timer-container');
    if (!container) return;

    const timeElement = container.querySelector('.timer-time');

    if (timeElement) {
        timeElement.textContent = Utils.formatTime(pageState.remainingSeconds);
    }

    const progressBar = container.querySelector('.timer-progress-fill');

    if (progressBar && pageState.totalSeconds > 0) {
        const percentage = Math.min(100, Math.max(0, (pageState.elapsedSeconds / pageState.totalSeconds) * 100));
        progressBar.style.width = percentage + '%';
    }
}

async function handleTimerComplete() {
    if (pageState.timerStatus === 'break') {
        // Перерыв закончился
        playNotificationSound();
        pageState.timerStatus = 'idle';
        pageState.elapsedSeconds = 0;
        syncIdleTimerDuration();
        clearStorage();
        renderTimerUI();
        Notification.success('Перерыв окончен. Готовы продолжить?');
        return;
    }

    if (pageState.timerStatus === 'running' && pageState.sessionId) {
        // Сессия чтения завершена
        playNotificationSound();

        try {
            const result = await TimerService.completeSession(pageState.sessionId, pageState.elapsedSeconds);

            // Обновляем plant
            if (result.plant) {
                pageState.plant = result.plant;
                renderPlantMini();

                if (result.plant.grew) {
                    const newStageLabel = PLANT_STAGE_LABELS[result.plant.new_stage] || result.plant.new_stage;
                    Notification.success('Ваше растение выросло! Новая стадия: ' + newStageLabel);
                }
            }

            pageState.pomodoroCount++;

            // Проверяем помодоро-цикл
            const pomodoroThreshold = pageState.settings
                ? parseInt(pageState.settings.setting_pomodoro_before_long_break, 10)
                : TIMER_DEFAULTS.POMODORO_BEFORE_LONG_BREAK;

            if (pageState.pomodoroCount > 0 && pageState.pomodoroCount % pomodoroThreshold === 0) {
                // Длинный перерыв
                startBreak(true);
                Notification.success('Отличная работа! Время для длинного перерыва');
            } else {
                // Короткий перерыв
                startBreak(false);
                Notification.success('Сессия завершена! Короткий перерыв');
            }
        } catch (error) {
            Notification.error('Ошибка завершения сессии');
            resetTimer();
        }

        pageState.sessionId = null;
        clearStorage();
    }
}

function resetTimer() {
    stopCountdown();
    pageState.sessionId = null;
    pageState.timerStatus = 'idle';
    pageState.elapsedSeconds = 0;
    pageState.selectedBook = restoreLastSelectedBook();
    syncIdleTimerDuration();
    clearStorage();
    renderTimerUI();
}

//  6. ПОМОДОРО  //

function startBreak(isLong) {
    let breakDuration;

    if (isLong) {
        breakDuration = pageState.settings
            ? parseInt(pageState.settings.setting_long_break, 10)
            : TIMER_DEFAULTS.LONG_BREAK;
    } else {
        breakDuration = pageState.settings
            ? parseInt(pageState.settings.setting_short_break, 10)
            : TIMER_DEFAULTS.SHORT_BREAK;
    }

    pageState.timerStatus = 'break';
    pageState.totalSeconds = breakDuration;
    pageState.remainingSeconds = breakDuration;
    pageState.elapsedSeconds = 0;

    renderTimerUI();
    startCountdown();
}

//  7. ЗВУКОВОЕ УВЕДОМЛЕНИЕ  //

function playNotificationSound() {
    const soundEnabled = pageState.settings
        ? parseInt(pageState.settings.is_sound_enabled, 10) === 1
        : true;

    if (!soundEnabled) return;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = TIMER_NOTIFICATION_SOUND.FREQUENCY_HZ;
        oscillator.type = 'sine';
        gainNode.gain.value = TIMER_NOTIFICATION_SOUND.GAIN;

        oscillator.start();
        oscillator.stop(audioContext.currentTime + TIMER_NOTIFICATION_SOUND.DURATION_SECONDS);
    } catch (error) {
        // Web Audio API не поддерживается — пропускаем
    }
}

//  8. ХРАНИЛИЩЕ СЕССИИ  //

function saveToStorage() {
    if (pageState.timerStatus === 'idle') return;

    const data = {
        sessionId: pageState.sessionId,
        timerStatus: pageState.timerStatus,
        remainingSeconds: pageState.remainingSeconds,
        totalSeconds: pageState.totalSeconds,
        elapsedSeconds: pageState.elapsedSeconds,
        pomodoroCount: pageState.pomodoroCount,
        selectedBook: pageState.selectedBook,
        timestamp: Date.now(),
    };

    try {
        sessionStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        // sessionStorage недоступен — пропускаем
    }
}

function restoreFromStorage() {
    try {
        const raw = sessionStorage.getItem(TIMER_STORAGE_KEY);
        if (!raw) return false;

        const data = JSON.parse(raw);
        if (!data || !data.sessionId) return false;

        pageState.sessionId = data.sessionId;
        pageState.totalSeconds = data.totalSeconds;
        pageState.remainingSeconds = data.remainingSeconds;
        pageState.elapsedSeconds = data.elapsedSeconds;
        pageState.pomodoroCount = data.pomodoroCount || 0;
        pageState.selectedBook = data.selectedBook || null;

        // Восстанавливаем как «paused»
        if (data.timerStatus === 'running' || data.timerStatus === 'paused') {
            pageState.timerStatus = 'paused';
        } else if (data.timerStatus === 'break') {
            // Перерыв — сбрасываем
            clearStorage();
            return false;
        } else {
            clearStorage();
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

function clearStorage() {
    try {
        sessionStorage.removeItem(TIMER_STORAGE_KEY);
    } catch (error) {
        // sessionStorage недоступен — пропускаем
    }
}

function getLastSelectedBookStorageKey() {
    return TIMER_LAST_BOOK_STORAGE_KEY + ':' + (pageState.currentUserId || 'guest');
}

function saveLastSelectedBook(book) {
    if (!book || !book.id) return;

    try {
        localStorage.setItem(getLastSelectedBookStorageKey(), JSON.stringify(book));
    } catch (error) {
        // localStorage недоступен — пропускаем
    }
}

function restoreLastSelectedBook() {
    try {
        const raw = localStorage.getItem(getLastSelectedBookStorageKey());
        if (!raw) return null;

        const book = JSON.parse(raw);
        if (!book || !book.id || !book.text) return null;

        return {
            id: Number(book.id),
            text: String(book.text),
            edition_cover_path: book.edition_cover_path || null,
        };
    } catch (error) {
        return null;
    }
}

function clearLastSelectedBook() {
    try {
        localStorage.removeItem(getLastSelectedBookStorageKey());
    } catch (error) {
        // localStorage недоступен — пропускаем
    }
}

//  9. ОБРАБОТЧИКИ СОБЫТИЙ  //

async function handleStart() {
    if (pageState.isLoading) return;

    const workDuration = getWorkDurationSeconds();
    const bookId = pageState.selectedBook ? Number(pageState.selectedBook.id) || null : null;

    pageState.isLoading = true;

    try {
        const session = await TimerService.startSession(workDuration, bookId, true);

        pageState.sessionId = session.id;
        pageState.totalSeconds = workDuration;
        pageState.remainingSeconds = workDuration;
        pageState.elapsedSeconds = 0;
        pageState.timerStatus = 'running';

        renderTimerUI();
        startCountdown();
        TimerPage.loadAndRenderNotes();
    } catch (error) {
        Notification.error(error.message || 'Ошибка запуска сессии');
    } finally {
        pageState.isLoading = false;
    }
}

async function handlePause() {
    if (!pageState.sessionId) return;

    stopCountdown();

    try {
        await TimerService.pauseSession(pageState.sessionId);
        pageState.timerStatus = 'paused';
        renderTimerUI();
        saveToStorage();
    } catch (error) {
        Notification.error('Ошибка постановки на паузу');
        startCountdown();
    }
}

async function handleResume() {
    if (!pageState.sessionId) return;

    try {
        await TimerService.resumeSession(pageState.sessionId);
        pageState.timerStatus = 'running';
        renderTimerUI();
        startCountdown();
    } catch (error) {
        Notification.error('Ошибка возобновления сессии');
    }
}

async function handleCancel() {
    const isConfirmed = await AppConfirm.ask({
        title: 'Отменить сессию',
        message: 'Отменить текущую сессию?',
        confirmLabel: 'Отменить сессию',
        isDanger: true,
    });
    if (!isConfirmed) return;

    stopCountdown();
    TimerRadioHandlers.stop();

    if (pageState.sessionId) {
        try {
            await TimerService.cancelSession(pageState.sessionId);
        } catch (error) {
            // Сессия могла быть уже завершена
        }
    }

    Notification.success('Сессия отменена');
    resetTimer();
}

function handleSkipBreak() {
    stopCountdown();
    pageState.timerStatus = 'idle';
    pageState.elapsedSeconds = 0;
    syncIdleTimerDuration();
    renderTimerUI();
}

async function handleSaveSettings() {
    const workDurationInput = Utils.getElement('setting-work-duration');
    const shortBreakInput = Utils.getElement('setting-short-break');
    const soundCheckbox = Utils.getElement('setting-sound-enabled');

    const errors = [];
    const data = {};

    if (workDurationInput) {
        const minutes = parseInt(workDurationInput.value, 10);
        const minWorkMinutes = timerLimitMinutes(TIMER_LIMITS.WORK_DURATION_MIN);
        const maxWorkMinutes = timerLimitMinutes(TIMER_LIMITS.WORK_DURATION_MAX);
        if (isNaN(minutes) || minutes < minWorkMinutes || minutes > maxWorkMinutes) {
            errors.push('Длительность работы: от ' + minWorkMinutes + ' до ' + maxWorkMinutes + ' мин');
        } else {
            data.setting_work_duration = minutesToSeconds(minutes);
        }
    }

    if (shortBreakInput) {
        const minutes = parseInt(shortBreakInput.value, 10);
        const minBreakMinutes = timerLimitMinutes(TIMER_LIMITS.SHORT_BREAK_MIN);
        const maxBreakMinutes = timerLimitMinutes(TIMER_LIMITS.SHORT_BREAK_MAX);
        if (isNaN(minutes) || minutes < minBreakMinutes || minutes > maxBreakMinutes) {
            errors.push('Короткий перерыв: от ' + minBreakMinutes + ' до ' + maxBreakMinutes + ' мин');
        } else {
            data.setting_short_break = minutesToSeconds(minutes);
        }
    }

    if (errors.length > 0) {
        Notification.error(errors.join('. '));
        return;
    }

    if (soundCheckbox) {
        data.is_sound_enabled = soundCheckbox.checked;
    }

    if (Object.keys(data).length === 0) {
        Notification.error('Нет данных для сохранения');
        return;
    }

    try {
        const settings = await TimerService.updateSettings(data);
        pageState.settings = settings;
        syncIdleTimerDuration();
        Notification.success('Настройки сохранены');
        renderSettingsForm();
        renderTimerUI();
    } catch (error) {
        Notification.error('Ошибка сохранения настроек');
    }
}

//  10. ПРИВЯЗКА СОБЫТИЙ  //

function setupEventListeners() {
    TimerRadioHandlers.bindEvents();

    // Сохранение настроек
    ['setting-work-duration', 'setting-short-break', 'setting-sound-enabled'].forEach(function (elementId) {
        const settingElement = Utils.getElement(elementId);
        if (settingElement) {
            settingElement.addEventListener('change', handleSaveSettings);
        }
    });

    const noteAddButton = Utils.getElement('note-add-button');
    if (noteAddButton) {
        noteAddButton.addEventListener('click', TimerPage.handleAddNote);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
}

function handleBeforeUnload() {
    saveToStorage();
}

function handleVisibilityChange() {
    if (document.hidden) {
        if (pageState.timerStatus === 'running' && pageState.sessionId) {
            handlePause();
        }
        saveToStorage();
    }
}

function destroy() {
    saveToStorage();
    stopCountdown();
    TimerRadioHandlers.stop();
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
}

Object.assign(TimerPage, { state: pageState, init: init, destroy: destroy });
})();
