"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_COOKIE = exports.STABILITY_MIN_PRIZE_EVENTS = exports.STABILITY_COEFFICIENT = exports.DEFAULT_RATING_POINTS = exports.RATING_BANDS = exports.COMPETITION_LEVELS = exports.APPLICATION_STATUSES = exports.DISCIPLINE_NAMES = exports.DISCIPLINE_CODES = exports.ROLE_CODES = void 0;
exports.ROLE_CODES = [
    "FEDERATION",
    "ATHLETE",
    "COACH",
    "JUDGE",
    "MINISTRY",
];
exports.DISCIPLINE_CODES = [
    "ALGORITHMIC",
    "PRODUCT",
    "INFOSEC",
    "AI",
    "ROBOTICS",
    "UAV",
];
exports.DISCIPLINE_NAMES = {
    ALGORITHMIC: "Алгоритмическое программирование",
    PRODUCT: "Продуктовое программирование",
    INFOSEC: "Системы информационной безопасности",
    AI: "Системы искусственного интеллекта",
    ROBOTICS: "Робототехника",
    UAV: "Беспилотные авиационные системы",
};
exports.APPLICATION_STATUSES = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "WITHDRAWN",
];
exports.COMPETITION_LEVELS = [
    "REGIONAL",
    "INTERREGIONAL",
    "NATIONAL",
];
exports.RATING_BANDS = [
    "RUSSIA_CHAMPIONSHIP",
    "RUSSIA_YOUTH",
    "INTERREGIONAL",
    "REGIONAL",
];
exports.DEFAULT_RATING_POINTS = {
    RUSSIA_CHAMPIONSHIP: { 1: 100, 2: 80, 3: 60 },
    RUSSIA_YOUTH: { 1: 80, 2: 60, 3: 40 },
    INTERREGIONAL: { 1: 60, 2: 45, 3: 30 },
    REGIONAL: { 1: 40, 2: 30, 3: 20 },
};
exports.STABILITY_COEFFICIENT = 1.2;
exports.STABILITY_MIN_PRIZE_EVENTS = 2;
exports.SESSION_COOKIE = "fsp_session";
//# sourceMappingURL=index.js.map