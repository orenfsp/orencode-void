export declare const ROLE_CODES: readonly ["FEDERATION", "ATHLETE", "COACH", "JUDGE", "MINISTRY"];
export type RoleCode = (typeof ROLE_CODES)[number];
export declare const DISCIPLINE_CODES: readonly ["ALGORITHMIC", "PRODUCT", "INFOSEC", "AI", "ROBOTICS", "UAV"];
export type DisciplineCode = (typeof DISCIPLINE_CODES)[number];
export declare const DISCIPLINE_NAMES: Record<DisciplineCode, string>;
export declare const APPLICATION_STATUSES: readonly ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export declare const COMPETITION_LEVELS: readonly ["REGIONAL", "INTERREGIONAL", "NATIONAL"];
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];
export declare const RATING_BANDS: readonly ["RUSSIA_CHAMPIONSHIP", "RUSSIA_YOUTH", "INTERREGIONAL", "REGIONAL"];
export type RatingBand = (typeof RATING_BANDS)[number];
export declare const DEFAULT_RATING_POINTS: Record<RatingBand, {
    1: number;
    2: number;
    3: number;
}>;
export declare const STABILITY_COEFFICIENT = 1.2;
export declare const STABILITY_MIN_PRIZE_EVENTS = 2;
export declare const SESSION_COOKIE = "fsp_session";
export type ApiSuccess<T> = {
    success: true;
    data: T;
    meta?: Record<string, unknown>;
};
export type ApiError = {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
};
export type Paginated<T> = {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
};
