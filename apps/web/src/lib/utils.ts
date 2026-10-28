import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fio(person: {
  lastName: string;
  firstName: string;
  middleName?: string | null;
}) {
  return [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(" ");
}

export function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("ru-RU");
}

export const statusLabel: Record<string, string> = {
  PENDING: "На рассмотрении",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  WITHDRAWN: "Отозвано",
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  ARCHIVED: "Архив",
  ACTIVE: "Активен",
  INACTIVE: "Неактивен",
  SUSPENDED: "Отстранён",
  DISQUALIFIED: "Дисквалифицирован",
};
