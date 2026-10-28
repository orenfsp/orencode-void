"use client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button, Skeleton } from "./ui";
export function DataState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-800"
      >
        <AlertCircle size={18} />
        <span className="flex-1">{error}</span>
        <Button variant="outline" onClick={retry}>
          <RefreshCw size={14} />
          Повторить
        </Button>
      </div>
    );
  if (loading)
    return (
      <div role="status" aria-label="Загрузка данных" className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  return null;
}
