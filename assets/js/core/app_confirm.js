/**
 *  CORE: AppConfirm — единое модальное подтверждение действий 
 *
 * НАЗНАЧЕНИЕ:
 *   Заменяет нативный `confirm()` на стилизованную модалку проекта.
 */

const AppConfirm = {
    ask(options) {
        const config = typeof options === 'string'
            ? { message: options }
            : Object.assign({}, options || {});

        return new Promise(function (resolve) {
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop app-confirm-backdrop';

            const card = document.createElement('div');
            card.className = 'modal-card app-confirm-card';
            card.setAttribute('role', 'dialog');
            card.setAttribute('aria-modal', 'true');

            const header = document.createElement('header');
            header.className = 'modal-header';

            const title = document.createElement('h2');
            title.className = 'modal-title';
            title.textContent = config.title || 'Подтверждение';
            header.appendChild(title);

            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'btn btn-ghost btn-icon';
            close.setAttribute('aria-label', 'Закрыть окно');
            const closeIcon = document.createElement('i');
            closeIcon.setAttribute('data-lucide', 'x');
            close.appendChild(closeIcon);
            header.appendChild(close);

            card.appendChild(header);

            const message = document.createElement('p');
            message.className = 'app-confirm-message';
            message.textContent = config.message || 'Подтвердить действие?';
            card.appendChild(message);

            const actions = document.createElement('div');
            actions.className = 'modal-actions app-confirm-actions';

            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn btn-ghost';
            cancel.textContent = config.cancelLabel || 'Отмена';
            actions.appendChild(cancel);

            const confirm = document.createElement('button');
            confirm.type = 'button';
            confirm.className = config.isDanger ? 'btn btn-danger' : 'btn btn-primary';
            appendConfirmIcon(confirm, config.isDanger ? 'trash-2' : 'check', config.confirmLabel || 'Подтвердить');
            actions.appendChild(confirm);

            card.appendChild(actions);
            backdrop.appendChild(card);
            document.body.appendChild(backdrop);

            function closeWith(result) {
                document.removeEventListener('keydown', handleKeydown);
                backdrop.remove();
                resolve(result);
            }

            function handleKeydown(event) {
                if (event.key === 'Escape') closeWith(false);
            }

            close.addEventListener('click', function () { closeWith(false); });
            cancel.addEventListener('click', function () { closeWith(false); });
            confirm.addEventListener('click', function () { closeWith(true); });
            backdrop.addEventListener('click', function (event) {
                if (event.target === backdrop) closeWith(false);
            });
            document.addEventListener('keydown', handleKeydown);

            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
            confirm.focus();
        });
    },
};

function appendConfirmIcon(button, iconName, label) {
    Utils.appendIconText(button, iconName, label);
}
