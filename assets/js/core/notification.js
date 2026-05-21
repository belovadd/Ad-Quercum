/**
 * CORE: Toast-уведомления
 *
 * НАЗНАЧЕНИЕ:
 * Показ временных уведомлений (success, error, info) пользователю.
 * Создаёт контейнер автоматически. Уведомления исчезают по таймеру.
 */

//  1. ОБЪЕКТ УВЕДОМЛЕНИЙ  //

const Notification = {

    DISPLAY_DURATION: TOAST_DISPLAY_DURATION_MS,

    _container: null,

    _getContainer() {
        if (this._container) {
            return this._container;
        }

        this._container = document.getElementById('notification-container');

        if (!this._container) {
            this._container = document.createElement('div');
            this._container.id = 'notification-container';
            this._container.classList.add('toast-container');
            document.body.appendChild(this._container);
        }

        return this._container;
    },

    //  2. ПУБЛИЧНЫЕ МЕТОДЫ  //

    success(message) {
        this._show(message, 'toast-success');
    },

    error(message) {
        this._show(message, 'toast-error');
    },

    info(message) {
        this._show(message, 'toast-info');
    },

    //  3. ВНУТРЕННЯЯ ЛОГИКА  //

    _show(message, cssClass) {
        const container = this._getContainer();

        const toast = document.createElement('div');
        toast.classList.add('toast', cssClass);

        const messageElement = document.createElement('span');
        messageElement.className = 'toast-message';
        messageElement.textContent = message;
        toast.appendChild(messageElement);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.classList.add('toast-close');
        deleteBtn.setAttribute('aria-label', 'Закрыть уведомление');
        const closeIcon = document.createElement('i');
        closeIcon.setAttribute('data-lucide', 'x');
        deleteBtn.appendChild(closeIcon);
        deleteBtn.addEventListener('click', function() { toast.remove(); });
        toast.appendChild(deleteBtn);

        container.appendChild(toast);
        if (window.lucide) window.lucide.createIcons();

        // Удаление по таймеру
        setTimeout(() => {
            toast.classList.add('is-hiding');
            setTimeout(() => {
                toast.remove();
            }, TOAST_HIDE_DELAY_MS);
        }, this.DISPLAY_DURATION);
    },
};
