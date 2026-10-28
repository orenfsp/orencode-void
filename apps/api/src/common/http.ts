export function ok<T>(data: T, meta?: Record<string, unknown>) {
  return meta
    ? { success: true as const, data, meta }
    : { success: true as const, data };
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return ok({ items, total, page, pageSize });
}
