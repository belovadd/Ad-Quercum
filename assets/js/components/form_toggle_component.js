/**
 *  КОМПОНЕНТ: FormToggle — Переключатель (switch) для форм 
 *
 * НАЗНАЧЕНИЕ:
 *   Возвращает `<label class="form-toggle">` с круглой «дорожкой»-треком и точкой,
 *   справа — текст-лейбл, и опциональный подзаголовок. Click переключает состояние
 *   и вызывает `onChange(newValue)`.
 */

function renderFormToggle(props) {
    const p = props || {};
    let value = Boolean(p.value);

    const label = document.createElement('label');
    label.className = 'form-toggle';

    // --- Трек и точка ---
    const track = document.createElement('span');
    track.className = 'form-toggle-track';
    if (value) track.classList.add('is-on');

    const dot = document.createElement('span');
    dot.className = 'form-toggle-dot';
    track.appendChild(dot);

    label.appendChild(track);

    // --- Блок подписи и подсказки ---
    const textBlock = document.createElement('span');
    textBlock.className = 'form-toggle-label';
    textBlock.textContent = Utils.safeText(p.label, '');
    label.appendChild(textBlock);

    if (p.hint) {
        const hint = document.createElement('span');
        hint.className = 'form-toggle-hint';
        hint.textContent = p.hint;
        label.appendChild(hint);
    }

    // --- Обработчик клика ---
    label.addEventListener('click', (event) => {
        event.preventDefault();
        value = !value;
        if (value) {
            track.classList.add('is-on');
        } else {
            track.classList.remove('is-on');
        }
        label.dataset.value = value ? '1' : '0';
        if (typeof p.onChange === 'function') {
            p.onChange(value);
        }
    });

    label.dataset.value = value ? '1' : '0';
    return label;
}

window.renderFormToggle = renderFormToggle;
