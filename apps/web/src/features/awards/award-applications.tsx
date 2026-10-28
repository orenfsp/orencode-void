"use client";
import { useState } from "react";
import { SPORTS_RANKS } from "@fsp/shared";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  PageTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
import { toast } from "sonner";
type Person = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
};
type Application = {
  id: string;
  rankType?: string;
  requestedCategory?: string;
  status: string;
  submittedAt: string;
  comment?: string;
  athlete?: Person;
  judge?: Person;
};
export function AwardApplications({ kind }: { kind: "rank" | "judge" }) {
  const user = useUser();
  const federation = user?.activeRole === "FEDERATION";
  const judge = kind === "judge";
  const endpoint = judge
    ? "/judge-category-applications"
    : "/rank-applications";
  const state = useApi<Application[] | { categoryApplications: Application[] }>(
    judge && !federation ? "/judges/me" : endpoint,
  );
  const athletes = useApi<Person[]>(
    !judge && federation ? "/athletes/directory" : null,
  );
  const links = useApi<Array<{ status: string; athlete: Person }>>(
    !judge && user?.activeRole === "COACH" ? "/coaches/me/athletes" : null,
  );
  const [review, setReview] = useState<Application | null>(null);
  const [approve, setApprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const list = Array.isArray(state.data)
    ? state.data
    : (state.data?.categoryApplications ?? []);
  const choices =
    athletes.data ??
    links.data
      ?.filter((l) => l.status === "ACTIVE")
      .map((l) => l.athlete)
      .filter((a, i, all) => all.findIndex((v) => v.id === a.id) === i) ??
    [];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    try {
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify(
          judge
            ? { requestedCategory: values.get("category") }
            : {
                athleteId:
                  user?.activeRole === "ATHLETE"
                    ? user.athleteId
                    : values.get("athleteId"),
                rankType: values.get("rankType"),
              },
        ),
      });
      toast.success("Заявка отправлена на рассмотрение");
      form.reset();
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
        title={judge ? "Судейские категории" : "Спортивные разряды"}
        subtitle="Присвоение выполняет федерация на основании подтверждающих документов. Автоматического присвоения нет."
      />
      <DataState {...state} retry={state.reload} />
      {(!judge || !federation) && (
        <Card className="mb-6">
          <h2 className="mb-4 font-semibold">Подать заявку</h2>
          <form
            onSubmit={submit}
            className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]"
          >
            {!judge && user?.activeRole !== "ATHLETE" && (
              <Field label="Спортсмен">
                <Select name="athleteId" required>
                  <option value="">Выберите спортсмена</option>
                  {choices.map((a) => (
                    <option key={a.id} value={a.id}>
                      {fio(a)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {judge ? (
              <Field label="Запрашиваемая категория">
                <Input
                  name="category"
                  required
                  placeholder="Название категории по документу"
                />
              </Field>
            ) : (
              <Field label="Запрашиваемый разряд">
                <Select name="rankType" required>
                  {SPORTS_RANKS.map((rank) => (
                    <option key={rank}>{rank}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Button disabled={busy} type="submit">
              Подать заявку
            </Button>
          </form>
        </Card>
      )}
      <div className="space-y-3">
        {list.map((item) => (
          <Card key={item.id} className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <h2 className="font-medium">
                {item.rankType ?? item.requestedCategory}
              </h2>
              <p className="mt-1 text-sm text-[#71829b]">
                {item.athlete
                  ? fio(item.athlete)
                  : item.judge
                    ? fio(item.judge)
                    : "Моя заявка"}{" "}
                · {formatDate(item.submittedAt)}
              </p>
              {item.comment && (
                <p className="mt-2 text-sm">Комментарий: {item.comment}</p>
              )}
            </div>
            <Badge
              tone={
                item.status === "APPROVED"
                  ? "ok"
                  : item.status === "PENDING"
                    ? "warn"
                    : "bad"
              }
            >
              {statusLabel[item.status]}
            </Badge>
            {federation && item.status === "PENDING" && (
              <Button
                onClick={() => {
                  setReview(item);
                  setApprove(true);
                }}
                variant="outline"
              >
                Рассмотреть
              </Button>
            )}
          </Card>
        ))}
      </div>
      {!state.loading && !state.error && !list.length && (
        <Empty title="Заявок пока нет" />
      )}
      {review && (
        <Modal
          title={`Рассмотрение: ${review.rankType ?? review.requestedCategory}`}
          onClose={() => setReview(null)}
        >
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              setBusy(true);
              try {
                await api(`${endpoint}/${review.id}/review`, {
                  method: "POST",
                  body: JSON.stringify({
                    approve,
                    comment: String(values.get("comment") || ""),
                    ...(approve
                      ? {
                          assignedAt: String(values.get("assignedAt")),
                          expiresAt: String(values.get("expiresAt")),
                          orderNumber: String(values.get("orderNumber")),
                        }
                      : {}),
                  }),
                });
                toast.success("Решение сохранено");
                setReview(null);
                state.reload();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Решение">
              <Select
                value={String(approve)}
                onChange={(e) => setApprove(e.target.value === "true")}
              >
                <option value="true">Присвоить</option>
                <option value="false">Отклонить</option>
              </Select>
            </Field>
            {approve && (
              <>
                <p className="text-xs text-[#71829b]">
                  Введите даты и номер приказа из документа-основания.
                </p>
                <Field label="Дата присвоения">
                  <Input type="date" name="assignedAt" required />
                </Field>
                <Field label="Действует до">
                  <Input type="date" name="expiresAt" required />
                </Field>
                <Field label="Номер приказа">
                  <Input name="orderNumber" required />
                </Field>
              </>
            )}
            <Field label={approve ? "Комментарий" : "Причина отклонения"}>
              <Textarea name="comment" required={!approve} />
            </Field>
            <Button type="submit" disabled={busy}>
              Сохранить решение
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
