/**
 *  CORE: Константы приложения Ad Quercum 
 *
 * НАЗНАЧЕНИЕ:
 * Все клиентские константы: URL API, статусы, стадии, лимиты.
 * /

//  1. API  //

/**
 * Константа BASE_PATH — автоопределение корня приложения из расположения скрипта.
 * Работает при развёртывании в любую поддиректорию.
 */

const BASE_PATH = (function () {
    const src = document.currentScript.src;
    const marker = 'assets/js/core/constants.js';
    const idx = src.indexOf(marker);
    if (idx !== -1) {
        return src.substring(0, idx);
    }
    return '/';
})();

const API_BASE_URL = BASE_PATH + 'api';

const LOGO_URL = BASE_PATH + 'uploads/ad-quercum-logo.svg';

const DEFAULT_AVATAR_URL = BASE_PATH + 'assets/images/default_avatar.png';

const DEFAULT_BOOK_COVER_URL = BASE_PATH + 'assets/images/default_book_cover.jpg';

const DEFAULT_CLUB_COVER_URL = BASE_PATH + 'assets/images/default_club_cover.jpg?v=release';

const UNKNOWN_AVATAR_URL = BASE_PATH + 'uploads/avatars/avatar_unknown.png';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = 3600;

//  1.1. РОЛИ ПОЛЬЗОВАТЕЛЕЙ  //

const USER_ROLE = {
    USER: 'user',
    MODERATOR: 'moderator',
    ADMIN: 'admin',
};

const USER_ROLE_LABELS = {
    user: 'Пользователь',
    moderator: 'Модератор',
    admin: 'Администратор',
};

//  1.2. МОДЕРАЦИЯ КНИГ И ИЗДАНИЙ  //

const BOOK_MODERATION_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

const BOOK_MODERATION_STATUS_LABELS = {
    pending: 'На модерации',
    approved: 'Одобрена',
    rejected: 'Отклонена',
};

const EDITION_MODERATION_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
};

const EDITION_MODERATION_STATUS_LABELS = {
    pending: 'На модерации',
    approved: 'Одобрено',
    rejected: 'Отклонено',
};

//  1.3. ТИПЫ ИЗДАНИЙ  //

const EDITION_TYPE = {
    PAPERBACK: 'paperback',
    HARDCOVER: 'hardcover',
    POCKET:    'pocket',
    EBOOK:     'ebook',
    AUDIOBOOK: 'audiobook',
};

const EDITION_TYPE_LABELS = {
    paperback: 'Мягкая обложка',
    hardcover: 'Твёрдая обложка',
    pocket:    'Карманное издание',
    ebook:     'Электронное',
    audiobook: 'Аудиокнига',
};

const EDITION_TYPE_ICONS = {
    paperback: 'book',
    hardcover: 'book-marked',
    pocket:    'notebook',
    ebook:     'tablet',
    audiobook: 'headphones',
};

//  1.4. АВТОКОМПЛИТ И ЛИМИТЫ ВВОДА  //

const AUTOCOMPLETE_DEBOUNCE_MS    = 280;
const AUTOCOMPLETE_MIN_QUERY_LENGTH = 2;
const AUTOCOMPLETE_MAX_RESULTS    = 10;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 255;
const MAX_NAME_LENGTH = 100;
const MAX_PROFILE_IDENTIFIER_LENGTH = 50;
const MAX_PROFILE_BIO_LENGTH = 1000;
const MAX_PROFILE_LOCATION_LENGTH = 100;
const MAX_PROFILE_STATUS_LENGTH = 255;

const MAX_BOOK_TITLE_LENGTH       = 500;
const MAX_BOOK_AUTHOR_LENGTH      = 500;
const MAX_BOOK_GENRE_LENGTH       = 100;
const MAX_BOOK_DESCRIPTION_LENGTH = 5000;
const MIN_BOOK_YEAR_PUBLISHED     = 1;
const MAX_BOOK_YEAR_PUBLISHED     = 9999;

const MAX_EDITION_ISBN_LENGTH       = 20;
const MAX_EDITION_LANGUAGE_LENGTH   = 10;
const MAX_EDITION_TRANSLATOR_LENGTH = 500;
const MAX_EDITION_PUBLISHER_LENGTH  = 255;
const MAX_EDITION_SERIES_LENGTH     = 255;
const MIN_EDITION_PAGES             = 1;
const MAX_EDITION_PAGES             = 65535;
const MAX_UPLOAD_SIZE_BYTES         = 5242880;
const ALLOWED_IMAGE_MIME_TYPES      = ['image/jpeg', 'image/png', 'image/webp'];

//  2. СТАТУСЫ КНИГ  //

const BOOK_STATUS = {
    WANT_TO_READ: 'want_to_read',
    READING: 'reading',
    FINISHED: 'finished',
};

const BOOK_STATUS_LABELS = {
    want_to_read: 'Хочу прочитать',
    reading: 'Читаю',
    finished: 'Прочитано',
};

const VISIBLE_EDITIONS_LIMIT = 3;

//  3. СТАДИИ РАСТЕНИЯ  //

const PLANT_STAGE = {
    SEED: 'seed',
    SPROUT: 'sprout',
    YOUNG_PLANT: 'young_plant',
    ADULT_PLANT: 'adult_plant',
    FLOWERING: 'flowering',
    OAK: 'oak',
};

const PLANT_STAGE_LABELS = {
    seed: 'Семечко',
    sprout: 'Росток',
    young_plant: 'Саженец',
    adult_plant: 'Деревце',
    flowering: 'Дерево',
    oak: 'Дуб из Лукоморья',
};

//  3.1. СТАТУСЫ СЕССИЙ ЧТЕНИЯ  //

const SESSION_STATUS = {
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

//  3.2. ТАЙМЕР / ПОМОДОРО  //

const TIMER_DEFAULTS = {
    WORK_DURATION: 1500,
    SHORT_BREAK: 300,
    LONG_BREAK: 1800,
    POMODORO_BEFORE_LONG_BREAK: 4,
};

const TIMER_LIMITS = {
    WORK_DURATION_MIN: 300,
    WORK_DURATION_MAX: 7200,
    SHORT_BREAK_MIN: 60,
    SHORT_BREAK_MAX: 1800,
    LONG_BREAK_MIN: 300,
    LONG_BREAK_MAX: 3600,
    POMODORO_BEFORE_LONG_BREAK_MIN: 2,
    POMODORO_BEFORE_LONG_BREAK_MAX: 10,
};

const TIMER_WORK_DURATION_PRESETS = [
    { minutes: 12, label: '12 минут' },
    { minutes: 15, label: '15 минут (Короткая)' },
    { minutes: 25, label: '25 минут (Классика)' },
    { minutes: 45, label: '45 минут (Длинная)' },
    { minutes: 60, label: '60 минут (Марафон)' },
];

const TIMER_SHORT_BREAK_PRESETS = [
    { minutes: 5, label: '5 минут' },
    { minutes: 10, label: '10 минут' },
    { minutes: 15, label: '15 минут' },
    { minutes: 20, label: '20 минут' },
];

const TIMER_NOTIFICATION_SOUND = {
    FREQUENCY_HZ: 800,
    GAIN: 0.3,
    DURATION_SECONDS: 0.3,
};

const TIMER_TICK_INTERVAL_MS = 1000;

const PLANT_STAGE_THRESHOLDS = {
    seed: 0,
    sprout: 6,
    young_plant: 16,
    adult_plant: 31,
    flowering: 61,
    oak: 101,
};

const PLANT_IMAGE_URLS = {
    seed: BASE_PATH + 'assets/images/plant/stage_seed.jpg?v=release',
    sprout: BASE_PATH + 'assets/images/plant/stage_sprout.jpg?v=release',
    young_plant: BASE_PATH + 'assets/images/plant/stage_young_plant.jpg?v=release',
    adult_plant: BASE_PATH + 'assets/images/plant/stage_adult_plant.jpg?v=release',
    flowering: BASE_PATH + 'assets/images/plant/stage_flowering.jpg?v=release',
    oak: BASE_PATH + 'assets/images/plant/stage_oak.jpg?v=release',
};

const TIMER_STORAGE_KEY = 'aq_timer_state';
const TIMER_LAST_BOOK_STORAGE_KEY = 'aq_timer_last_book';

//  3.3. РАДИО ТАЙМЕРА //

const RADIO_DEFAULT_VOLUME = 0.35;
const RADIO_VOLUME_STEP = 0.1;
const RADIO_VOLUME_MIN = 0;
const RADIO_VOLUME_MAX = 1;
const RADIO_VOLUME_PERCENT_FACTOR = 100;
const RADIO_VOLUME_INPUT_STEP = 1;
const RADIO_VOLUME_STORAGE_KEY = 'aq_radio_volume';
const RADIO_DIRECTION_PREVIOUS = -1;
const RADIO_DIRECTION_NEXT = 1;
const RADIO_START_TIMEOUT_MS = 5000;
const RADIO_SWITCH_DELAY_MS = 160;
const RADIO_START_TIMEOUT_CODE = 'RADIO_START_TIMEOUT';

const RADIO_STATIONS = [
    { name: 'Radio Mast', url: 'https://streams.radiomast.io/ref-128k-mp3-stereo' },
    { name: 'Ambient Sleeping Pill', url: 'https://radio.stereoscenic.com/asp-s' },
    { name: 'a.m. ambient', url: 'https://radio.stereoscenic.com/ama-s' },
    { name: 'Ambient Modern', url: 'https://radio.stereoscenic.com/mod-s' },
    { name: 'RadioSpiral Ambient', url: 'https://radiospiral.radio:8000/stream.mp3' },
    { name: 'RetroStrange Public Domain', url: 'https://icecast.retrostrange.com:8443/retrostrange-radio2-mp3' },
];

//  4. РОЛИ В КЛУБАХ  //

const CLUB_ROLE = {
    MEMBER: 'member',
    MODERATOR: 'moderator',
    CREATOR: 'creator',
};

const MAX_CLUB_DESCRIPTION_LENGTH = 2000;
const CLUB_CARD_DESCRIPTION_PREVIEW_LENGTH = 120;

const CLUB_ROLE_LABELS = {
    member: 'Участник',
    moderator: 'Модератор',
    creator: 'Создатель',
};

const CLUB_PUBLICATIONS_PER_PAGE = 5;
const PROFILE_PUBLICATIONS_PER_PAGE = 5;
const PUBLICATION_COMMENTS_PER_PAGE = 5;

const CLUB_JOIN_REQUEST_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
};

const CLUB_CATALOG_FILTER = {
    ALL: 'all',
    MY: 'my',
    PUBLIC: 'public',
    PRIVATE: 'private',
    PENDING: 'pending',
};

const CLUB_CATALOG_FILTER_LABELS = {
    all: 'Все',
    my: 'Мои',
    public: 'Публичные',
    private: 'Приватные',
    pending: 'Заявки',
};

//  4.1. КОЛЛЕКЦИИ  //

const MAX_LIBRARY_NAME_LENGTH = 255;
const COLLECTION_COLLAGE_COVER_LIMIT = 4;
const COLLECTION_ADD_SEARCH_LIMIT = 6;

//  4.2. ДРУЖБА  //

const FRIEND_REQUEST_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
};

const FRIENDSHIP_STATUS = {
    SELF: 'self',
    NONE: 'none',
    FRIENDS: 'friends',
    REQUEST_SENT: 'request_sent',
    REQUEST_RECEIVED: 'request_received',
};

//  5. ПУБЛИКАЦИИ  //

const MAX_PUBLICATION_TEXT_LENGTH = 5000;
const MAX_COMMENT_TEXT_LENGTH = 2000;

//  6. ПАГИНАЦИЯ  //

const PAGINATION_DEFAULT_PER_PAGE = 20;
const PAGINATION_DEFAULT_PAGE = 1;
const PAGINATION_MAX_PER_PAGE = 100;
const CLUB_CATALOG_PER_PAGE = 16;
const USER_LIBRARY_SELECT_LIMIT = PAGINATION_MAX_PER_PAGE;

const ADMIN_RECENT_ACTIVITY_DEFAULT_LIMIT = 20;
const ADMIN_CATALOG_PREVIEW_PER_PAGE = 20;

//  6.1. СТАТИСТИКА  //

const STATISTICS_DEFAULT_GOALS = {
    BOOKS_PER_YEAR: 24,
    PAGES_PER_YEAR: 10000,
    MINUTES_PER_DAY: 60,
};

const MILLISECONDS_PER_DAY = 86400000;
const STATISTICS_TOP_ITEMS_LIMIT = 5;

//  7. ЧАТ  //

const CHAT_POLL_INTERVAL_MS = 5000;
const MAX_MESSAGE_TEXT_LENGTH = 5000;
const MESSAGES_PER_PAGE = 50;

//  7.1. ЗАМЕТКИ ЧТЕНИЯ  //

const NOTE_FILTER_ALL = 'all';

const NOTE_TYPE = {
    QUOTE: 'quote',
    THOUGHT: 'thought',
    QUESTION: 'question',
    IDEA: 'idea',
};

const NOTE_TYPE_LABELS = {
    quote: 'Цитата',
    thought: 'Рассуждение',
    question: 'Вопрос',
    idea: 'Идея',
};

const NOTE_TYPE_OPTIONS = [
    { value: NOTE_TYPE.QUOTE, label: NOTE_TYPE_LABELS.quote },
    { value: NOTE_TYPE.THOUGHT, label: NOTE_TYPE_LABELS.thought },
    { value: NOTE_TYPE.QUESTION, label: NOTE_TYPE_LABELS.question },
    { value: NOTE_TYPE.IDEA, label: NOTE_TYPE_LABELS.idea },
];

const NOTE_FILTERS = [
    NOTE_FILTER_ALL,
    NOTE_TYPE.QUOTE,
    NOTE_TYPE.THOUGHT,
    NOTE_TYPE.QUESTION,
    NOTE_TYPE.IDEA,
];

const NOTES_PER_PAGE = 50;
const BOOK_NOTES_PER_PAGE = NOTES_PER_PAGE;

//  8. СТРАНИЦЫ (URL)  //

const PAGE_URL = {
    INDEX: BASE_PATH + 'public/index.html',
    LOGIN: BASE_PATH + 'public/login.html',
    REGISTER: BASE_PATH + 'public/register.html',
    TERMS: BASE_PATH + 'public/terms.html',
    PERSONAL_DATA_CONSENT: BASE_PATH + 'public/personal-data-consent.html',
    LIBRARY: BASE_PATH + 'public/library.html',
    BOOK: BASE_PATH + 'public/book.html',
    ADD_BOOK: BASE_PATH + 'public/add-book.html',
    COLLECTIONS: BASE_PATH + 'public/collections.html',
    TIMER: BASE_PATH + 'public/timer.html',
    PLANT: BASE_PATH + 'public/plant.html',
    PROFILE: BASE_PATH + 'public/profile.html',
    FRIENDS: BASE_PATH + 'public/friends.html',
    CLUBS: BASE_PATH + 'public/clubs.html',
    CLUB: BASE_PATH + 'public/club.html',
    MESSAGES: BASE_PATH + 'public/messages.html',
    USERS: BASE_PATH + 'public/users.html',
    STATISTICS: BASE_PATH + 'public/statistics.html',
    ADMIN: BASE_PATH + 'public/admin.html',
    ADMIN_USERS: BASE_PATH + 'public/admin-users.html',
    ADMIN_USER_EDIT: BASE_PATH + 'public/admin-user-edit.html',
    ADMIN_MODERATION: BASE_PATH + 'public/admin-moderation.html',
};

//  9. UI И СИСТЕМНЫЕ ЗНАЧЕНИЯ  //

const SEARCH_DEBOUNCE_MS = 400;
const CATALOG_SEARCH_DEBOUNCE_MS = 350;
const UI_TRANSITION_HIDE_DELAY_MS = 180;
const UI_FAST_RENDER_DELAY_MS = 120;

const TOAST_DISPLAY_DURATION_MS = 4000;
const TOAST_HIDE_DELAY_MS = 300;

const THEME_STORAGE_KEY = 'aq-theme';
const COOKIE_NOTICE_STORAGE_KEY = 'aq-cookie-notice-closed';
