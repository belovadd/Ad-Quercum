/**
 *  СТРАНИЦА: Обработчики радио таймера 
 *
 * НАЗНАЧЕНИЕ:
 * Управляет фоновым радио на странице таймера чтения: запуском, остановкой,
 * переключением потоков, состоянием кнопок и громкостью.
 */

(function () {
'use strict';

//  1. СОСТОЯНИЕ  //

const radioState = {
    isPlaying: false,
    isBusy: false,
    audio: null,
    requestId: 0,
    stationIndex: 0,
    volume: RADIO_DEFAULT_VOLUME,
    startTimerId: null,
    shouldPlay: false,
};

//  2. ПУБЛИЧНЫЙ API  //

function init() {
    radioState.volume = loadRadioVolumePreference();
    render();
}

function bindEvents() {
    const radioButton = Utils.getElement('radio-toggle-button');
    if (radioButton) {
        radioButton.addEventListener('click', toggle);
    }

    const radioPrevButton = Utils.getElement('radio-prev-button');
    if (radioPrevButton) {
        radioPrevButton.addEventListener('click', function () {
            switchStation(RADIO_DIRECTION_PREVIOUS);
        });
    }

    const radioNextButton = Utils.getElement('radio-next-button');
    if (radioNextButton) {
        radioNextButton.addEventListener('click', function () {
            switchStation(RADIO_DIRECTION_NEXT);
        });
    }

    const radioVolumeInput = Utils.getElement('radio-volume-input');
    if (radioVolumeInput) {
        radioVolumeInput.addEventListener('input', handleVolumeInput);
    }

    const radioVolumeDownButton = Utils.getElement('radio-volume-down-button');
    if (radioVolumeDownButton) {
        radioVolumeDownButton.addEventListener('click', function () {
            adjustVolume(RADIO_DIRECTION_PREVIOUS);
        });
    }

    const radioVolumeUpButton = Utils.getElement('radio-volume-up-button');
    if (radioVolumeUpButton) {
        radioVolumeUpButton.addEventListener('click', function () {
            adjustVolume(RADIO_DIRECTION_NEXT);
        });
    }
}

// 3. УПРАВЛЕНИЕ ВОСПРОИЗВЕДЕНИЕМ //

function toggle() {
    if (radioState.isPlaying || radioState.isBusy || radioState.shouldPlay) {
        stop();
    } else {
        void start();
    }
}

async function start() {
    clearScheduledStart();
    const station = RADIO_STATIONS[radioState.stationIndex];
    const requestId = radioState.requestId + 1;
    radioState.requestId = requestId;
    radioState.shouldPlay = true;
    radioState.isBusy = true;
    radioState.isPlaying = false;
    render();

    clearAudio();

    radioState.audio = new Audio(station.url);
    radioState.audio.volume = radioState.volume;

    try {
        await playWithTimeout(radioState.audio);
        if (requestId !== radioState.requestId) return false;

        radioState.isPlaying = true;
        return true;
    } catch (error) {
        if (requestId !== radioState.requestId) return false;

        radioState.isPlaying = false;
        radioState.shouldPlay = false;
        clearAudio();
        Notification.error(getStartErrorMessage(error));
        return false;
    } finally {
        if (requestId === radioState.requestId) {
            radioState.isBusy = false;
            radioState.shouldPlay = false;
        }
        render();
    }
}

function playWithTimeout(audio) {
    return new Promise(function (resolve, reject) {
        let isSettled = false;
        const timeoutId = window.setTimeout(function () {
            if (isSettled) return;

            isSettled = true;
            audio.pause();
            reject(createStartTimeoutError());
        }, RADIO_START_TIMEOUT_MS);

        audio.play()
            .then(function () {
                if (isSettled) return;

                isSettled = true;
                window.clearTimeout(timeoutId);
                resolve();
            })
            .catch(function (error) {
                if (isSettled) return;

                isSettled = true;
                window.clearTimeout(timeoutId);
                reject(error);
            });
    });
}

function stop() {
    radioState.requestId++;
    clearScheduledStart();
    clearAudio();

    radioState.shouldPlay = false;
    radioState.isPlaying = false;
    radioState.isBusy = false;
    render();
}

function switchStation(direction) {
    const shouldRestart = radioState.isPlaying || radioState.isBusy || radioState.shouldPlay;
    const total = RADIO_STATIONS.length;
    radioState.stationIndex = (radioState.stationIndex + direction + total) % total;

    if (shouldRestart) {
        scheduleStart();
    } else {
        render();
    }
}

function scheduleStart() {
    radioState.requestId++;
    clearScheduledStart();
    clearAudio();

    radioState.shouldPlay = true;
    radioState.isPlaying = false;
    radioState.isBusy = false;
    radioState.startTimerId = window.setTimeout(function () {
        radioState.startTimerId = null;
        void start();
    }, RADIO_SWITCH_DELAY_MS);

    render();
}

function clearScheduledStart() {
    if (!radioState.startTimerId) return;

    window.clearTimeout(radioState.startTimerId);
    radioState.startTimerId = null;
}

function clearAudio() {
    if (!radioState.audio) return;

    radioState.audio.pause();
    radioState.audio.removeAttribute('src');
    radioState.audio.load();
    radioState.audio = null;
}

function createStartTimeoutError() {
    const error = new Error(RADIO_START_TIMEOUT_CODE);
    error.name = RADIO_START_TIMEOUT_CODE;
    return error;
}

function getStartErrorMessage(error) {
    if (error && error.name === RADIO_START_TIMEOUT_CODE) {
        return 'Радио слишком долго подключается, попробуйте другую станцию';
    }

    return 'Не удалось запустить радио';
}

//  4. ГРОМКОСТЬ  //

function handleVolumeInput(event) {
    const value = Number(event.target.value);
    const volume = Number.isFinite(value)
        ? value / RADIO_VOLUME_PERCENT_FACTOR
        : RADIO_DEFAULT_VOLUME;

    setVolume(volume);
}

function adjustVolume(direction) {
    setVolume(radioState.volume + (direction * RADIO_VOLUME_STEP));
    render();
}

function setVolume(volume) {
    const safeVolume = Number.isFinite(volume) ? volume : RADIO_DEFAULT_VOLUME;
    const normalizedVolume = Math.min(RADIO_VOLUME_MAX, Math.max(RADIO_VOLUME_MIN, safeVolume));

    radioState.volume = normalizedVolume;
    if (radioState.audio) {
        radioState.audio.volume = normalizedVolume;
    }
    syncVolumeInput();
    saveRadioVolumePreference(normalizedVolume);
}

//  5. РЕНДЕРИНГ UI  //

function render() {
    const button = Utils.getElement('radio-toggle-button');
    const prevButton = Utils.getElement('radio-prev-button');
    const nextButton = Utils.getElement('radio-next-button');
    const volumeDownButton = Utils.getElement('radio-volume-down-button');
    const volumeUpButton = Utils.getElement('radio-volume-up-button');
    const statusEl = Utils.getElement('radio-status-text');
    const stationNameEl = Utils.getElement('radio-station-name');
    const volumeInput = Utils.getElement('radio-volume-input');
    const station = RADIO_STATIONS[radioState.stationIndex];

    if (statusEl) {
        statusEl.textContent = getStatusText();
    }
    if (stationNameEl) {
        stationNameEl.textContent = station.name;
    }
    syncVolumeInput(volumeInput);
    updateDisabledState(button, prevButton, nextButton, volumeDownButton, volumeUpButton);
    renderPlayButton(button);
}

function updateDisabledState(button, prevButton, nextButton, volumeDownButton, volumeUpButton) {
    [button, prevButton, nextButton].forEach(function (control) {
        if (control) control.disabled = false;
    });
    if (volumeDownButton) {
        volumeDownButton.disabled = radioState.volume <= RADIO_VOLUME_MIN;
    }
    if (volumeUpButton) {
        volumeUpButton.disabled = radioState.volume >= RADIO_VOLUME_MAX;
    }
}

function renderPlayButton(button) {
    if (!button) return;

    Utils.clearChildren(button);
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', radioState.isBusy ? 'loader-circle' : (radioState.isPlaying ? 'pause' : 'play'));
    button.appendChild(icon);
    button.setAttribute('aria-label', getToggleLabel());

    if (radioState.isPlaying) {
        button.classList.add('is-active');
    } else {
        button.classList.remove('is-active');
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function syncVolumeInput(volumeInput) {
    const input = volumeInput || Utils.getElement('radio-volume-input');
    if (!input) return;

    const volumePercent = Math.round(radioState.volume * RADIO_VOLUME_PERCENT_FACTOR);
    input.min = String(RADIO_VOLUME_MIN * RADIO_VOLUME_PERCENT_FACTOR);
    input.max = String(RADIO_VOLUME_MAX * RADIO_VOLUME_PERCENT_FACTOR);
    input.step = String(RADIO_VOLUME_INPUT_STEP);
    input.value = String(volumePercent);
    input.style.setProperty('--radio-volume-percent', volumePercent + '%');
}

function getStatusText() {
    if (radioState.isBusy || radioState.shouldPlay) return 'Подключение';
    return radioState.isPlaying ? 'Сейчас играет' : 'Выбранное радио';
}

function getToggleLabel() {
    if (radioState.isBusy || radioState.shouldPlay) return 'Остановить радио';
    return radioState.isPlaying ? 'Поставить радио на паузу' : 'Включить радио';
}

//  6. ХРАНИЛИЩЕ  //

function loadRadioVolumePreference() {
    try {
        const savedValue = localStorage.getItem(RADIO_VOLUME_STORAGE_KEY);
        if (savedValue === null) return RADIO_DEFAULT_VOLUME;
        const parsedValue = Number(savedValue);
        return Number.isFinite(parsedValue)
            ? Math.min(RADIO_VOLUME_MAX, Math.max(RADIO_VOLUME_MIN, parsedValue))
            : RADIO_DEFAULT_VOLUME;
    } catch (error) {
        return RADIO_DEFAULT_VOLUME;
    }
}

function saveRadioVolumePreference(volume) {
    try {
        localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, String(volume));
    } catch (error) {
        // Не критично: громкость всё равно применена к текущему audio.
    }
}

window.TimerRadioHandlers = {
    init: init,
    bindEvents: bindEvents,
    render: render,
    stop: stop,
};
})();
