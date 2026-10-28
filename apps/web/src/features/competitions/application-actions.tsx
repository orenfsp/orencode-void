"use client";
import { useState } from "react";
import { Button, Field, Modal, Textarea } from "@/components/ui";
import { useUser } from "@/components/shell";
import { api } from "@/lib/api";
import { toast } from "sonner";
export function ApplicationActions({
  id,
  status,
  reload,
}: {
  id: string;
  status: string;
  reload: () => void;
}) {
  const user = useUser();
  const [reject, setReject] = useState(false);
  const [busy, setBusy] = useState(false);
  if (status !== "PENDING") return null;
  async function review(next: string, reason?: string) {
    setBusy(true);
    try {
      await api(`/competitions/applications/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ status: next, reason }),
      });
      toast.success("Статус заявки изменён");
      setReject(false);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {user?.activeRole === "FEDERATION" ? (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => void review("APPROVED")}>
            Одобрить
          </Button>
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => setReject(true)}
          >
            Отклонить
          </Button>
        </div>
      ) : (
        ["ATHLETE", "COACH"].includes(user?.activeRole ?? "") && (
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => void review("WITHDRAWN")}
          >
            Отозвать
          </Button>
        )
      )}
      {reject && (
        <Modal title="Отклонить заявку" onClose={() => setReject(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void review(
                "REJECTED",
                String(new FormData(e.currentTarget).get("reason")),
              );
            }}
          >
            <Field label="Причина отклонения">
              <Textarea name="reason" required minLength={3} />
            </Field>
            <Button disabled={busy} variant="danger" type="submit">
              Отклонить заявку
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
