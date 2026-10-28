const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "Не удалось связаться с сервером. Проверьте подключение и повторите запрос.",
    );
  });
  if (response.headers.get("content-type")?.includes("application/json")) {
    const json = (await response.json()) as {
      success: boolean;
      data?: T;
      error?: { message: string };
    };
    if (!response.ok || !json.success) {
      throw new ApiError(
        response.status,
        json.error?.message ?? "Ошибка запроса",
      );
    }
    return json.data as T;
  }
  if (!response.ok) {
    throw new ApiError(response.status, "Ошибка запроса");
  }
  return undefined as T;
}

export function downloadUrl(path: string) {
  return `${API}${path}`;
}

/**
 * Скачивание файла через API с cookie-сессией. Для POST-запросов (например,
 * выпуск справки) обычная ссылка не подходит, поэтому используем blob.
 */
export async function downloadFile(
  path: string,
  init?: RequestInit,
  fallbackName = "document",
) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let message = "Не удалось сформировать документ";
    if (response.headers.get("content-type")?.includes("application/json")) {
      const json = (await response.json()) as { error?: { message?: string } };
      message = json.error?.message ?? message;
    }
    throw new ApiError(response.status, message);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const filename = encoded ? decodeURIComponent(encoded) : fallbackName;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type AuthUser = {
  id: string;
  email: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  roles: string[];
  activeRole: string;
  athleteId?: string;
  coachId?: string;
  judgeId?: string;
};
