"use client";
import { useState } from "react";
import { Button, Card, Empty, PageTitle } from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
export default function NotificationsPage() {
  const user = useUser();
  const [unread, setUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = useApi<
    Array<{
      id: string;
      title: string;
      body: string;
      createdAt: string;
      readAt: string | null;
    }>
  >(`/notifications?unread=${unread}`);
  async function mark(path: string) {
    setBusy(true);
    try {
      await api(path, { method: "PATCH" });
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageTitle
        title="Уведомления"
        subtitle="Соревнования, решения по заявкам и контроль сроков"
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="mr-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unread}
            onChange={(e) => setUnread(e.target.checked)}
          />
          Только непрочитанные
        </label>
        <Button
          disabled={busy}
          variant="outline"
          onClick={() => void mark("/notifications/read-all")}
        >
          Прочитать все
        </Button>
        {user?.activeRole === "FEDERATION" && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={async () => {
              setBusy(true);
              try {
                const result = await api<{ error?: boolean }>(
                  "/notifications/run-checks",
                  { method: "POST" },
                );
                if (result.error)
                  throw new Error("Проверка сроков завершилась с ошибкой");
                toast.success("Сроки проверены");
                state.reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setBusy(false);
              }
            }}
          >
            Проверить сроки
          </Button>
        )}
      </div>
      <DataState {...state} retry={state.reload} />
      <div className="space-y-3">
        {state.data?.map((item) => (
          <Card
            key={item.id}
            className={
              item.readAt ? "opacity-70" : "border-l-4 border-l-[#1680ff]"
            }
          >
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-[#71829b]">{item.body}</p>
            <p className="mt-3 text-xs text-[#71829b]">
              {formatDate(item.createdAt)}
            </p>
            {!item.readAt && (
              <Button
                disabled={busy}
                className="mt-2"
                variant="ghost"
                onClick={() => void mark(`/notifications/${item.id}/read`)}
              >
                Отметить прочитанным
              </Button>
            )}
          </Card>
        ))}
      </div>
      {!state.loading && !state.error && !state.data?.length && (
        <Empty title="Уведомлений пока нет" />
      )}
    </div>
  );
}
