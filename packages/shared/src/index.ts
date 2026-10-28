export const ROLE_CODES = [
  "FEDERATION",
  "ATHLETE",
  "COACH",
  "JUDGE",
  "MINISTRY",
] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const DISCIPLINE_CODES = [
  "ALGORITHMIC",
  "PRODUCT",
  "INFOSEC",
  "AI",
  "ROBOTICS",
  "UAV",
] as const;
export type DisciplineCode = (typeof DISCIPLINE_CODES)[number];

export const DISCIPLINE_NAMES: Record<DisciplineCode, string> = {
  ALGORITHMIC: "Алгоритмическое программирование",
  PRODUCT: "Продуктовое программирование",
  INFOSEC: "Системы информационной безопасности",
  AI: "Системы искусственного интеллекта",
  ROBOTICS: "Робототехника",
  UAV: "Беспилотные авиационные системы",
};

export const APPLICATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const COMPETITION_LEVELS = [
  "REGIONAL",
  "INTERREGIONAL",
  "NATIONAL",
] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

export const RATING_BANDS = [
  "RUSSIA_CHAMPIONSHIP",
  "RUSSIA_YOUTH",
  "INTERREGIONAL",
  "REGIONAL",
] as const;
export type RatingBand = (typeof RATING_BANDS)[number];

export const DEFAULT_RATING_POINTS: Record<
  RatingBand,
  { 1: number; 2: number; 3: number }
> = {
  RUSSIA_CHAMPIONSHIP: { 1: 100, 2: 80, 3: 60 },
  RUSSIA_YOUTH: { 1: 80, 2: 60, 3: 40 },
  INTERREGIONAL: { 1: 60, 2: 45, 3: 30 },
  REGIONAL: { 1: 40, 2: 30, 3: 20 },
};

export const STABILITY_COEFFICIENT = 1.2;
export const STABILITY_MIN_PRIZE_EVENTS = 2;

/**
 * Порядок спортивных разрядов используется только для фильтрации реестров
 * и рейтинга. Он не заменяет нормативные требования ЕВСК.
 */
export const SPORTS_RANKS = [
  "Третий юношеский разряд",
  "Второй юношеский разряд",
  "Первый юношеский разряд",
  "Третий спортивный разряд",
  "Второй спортивный разряд",
  "Первый спортивный разряд",
  "Кандидат в мастера спорта",
  "Мастер спорта России",
  "Мастер спорта России международного класса",
] as const;

export type SportsRankType = (typeof SPORTS_RANKS)[number];

export function rankLevel(rankType: string | null | undefined): number {
  if (!rankType) {
    return -1;
  }
  const normalized = rankType.trim().toLowerCase();
  const index = SPORTS_RANKS.findIndex(
    (item) => item.toLowerCase() === normalized,
  );
  return index;
}

export function meetsMinRank(
  currentRank: string | null | undefined,
  minRank: string | null | undefined,
): boolean {
  if (!minRank) {
    return true;
  }
  const current = rankLevel(currentRank);
  const required = rankLevel(minRank);
  return current >= 0 && required >= 0 && current >= required;
}

export const SESSION_COOKIE = "fsp_session";

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
