/**
 *  CORE: HTTP-клиент для взаимодействия с API 
 *
 * НАЗНАЧЕНИЕ:
 * Обёртка над fetch() с автоматическим CSRF-токеном,
 * обработкой ошибок и JSON-сериализацией.
 */

//  1. ОБЪЕКТ ApiClient  //

const ApiClient = {

    _csrfToken: '',
    _isInitialized: false,

    //  2. ИНИЦИАЛИЗАЦИЯ СЕССИИ  //

    async init() {
        const response = await fetch(API_BASE_URL + '/auth.php?action=check_session');
        const data = await this._parseJsonResponse(response);

        this._isInitialized = true;
        return data;
    },

    setCsrfToken(token) {
        this._csrfToken = token;
    },

    //  3. ОСНОВНОЙ МЕТОД ЗАПРОСА //

    async request(endpoint, method = 'GET', body = null) {
        const url = endpoint.startsWith('http') ? endpoint : API_BASE_URL + '/' + endpoint;

        const options = {
            method: method,
            headers: {},
            credentials: 'same-origin',
        };

        if (method === 'POST' && body !== null) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['X-CSRF-Token'] = this._csrfToken;
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        return await this._parseJsonResponse(response);
    },

    //  4. ОТПРАВКА ФОРМЫ С ФАЙЛАМИ  //

    async upload(endpoint, formData) {
        const url = API_BASE_URL + '/' + endpoint;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-CSRF-Token': this._csrfToken,
            },
            credentials: 'same-origin',
            body: formData,
        });

        return await this._parseJsonResponse(response);
    },

    //  5. РАЗБОР JSON-ОТВЕТА  //

    async _parseJsonResponse(response) {
        const text = await response.text();
        let json = null;

        try {
            json = JSON.parse(text);
        } catch (parseError) {
            const error = new Error('Сервер вернул некорректный JSON-ответ');
            error.status = response.status;
            error.errors = null;
            throw error;
        }

        // Обновление CSRF-токена, если пришёл в ответе
        if (json.data && json.data.csrf_token) {
            this._csrfToken = json.data.csrf_token;
        }

        if (!json.success) {
            const error = new Error(json.message || 'Ошибка сервера');
            error.status = response.status;
            error.errors = json.errors || null;
            throw error;
        }

        return json.data;
    },
};
