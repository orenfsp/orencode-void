"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";

export type CompetitionFields = {
  id: string;
  updatedAt: string;
  name: string;
  disciplineId: string;
  typeId: string;
  level: string;
  format: string;
  ageGroupId: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  description?: string | null;
  regulationUrl?: string | null;
  applicationsOpenAt: string;
  applicationsCloseAt: string;
  calendarPlanType: string;
  calendarPlanNumber?: string | null;
  ratingBand: string;
  season: number;
};
type Option = { id: string; name: string };
function localDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
const choices = {
  level: {
    REGIONAL: "Региональный",
    INTERREGIONAL: "Межрегиональный",
    NATIONAL: "Всероссийский",
  },
  format: { IN_PERSON: "Очный", ONLINE: "Онлайн", HYBRID: "Гибридный" },
  calendarPlanType: {
    REGIONAL: "Региональный",
    INTERREGIONAL: "Межрегиональный",
    FEDERAL: "Федеральный",
  },
  ratingBand: {
    REGIONAL: "Региональные соревнования",
    INTERREGIONAL: "Межрегиональные",
    RUSSIA_YOUTH: "Первенство России",
    RUSSIA_CHAMPIONSHIP: "Чемпионат России",
  },
};
export function CompetitionEditor({
  initial,
  publishedProtocol,
  onClose,
  onSaved,
}: {
  initial?: CompetitionFields;
  publishedProtocol?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const disciplines = useApi<Option[]>("/disciplines");
  const types = useApi<Option[]>("/competition-types");
  const groups = useApi<Option[]>("/age-groups");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loading = disciplines.loading || types.loading || groups.loading;
  const catalogError = disciplines.error || types.error || groups.error;
  const retry = () => {
    disciplines.reload();
    types.reload();
    groups.reload();
  };
  return (
    <Modal
      wide
      title={initial ? "Редактирование соревнования" : "Новое соревнование"}
      onClose={() => !busy && onClose()}
    >
      <DataState loading={loading} error={catalogError} retry={retry} />
      {!loading && !catalogError && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const body: Record<string, unknown> = Object.fromEntries(
              form.entries(),
            );
            for (const key of [
              "startsAt",
              "endsAt",
              "applicationsOpenAt",
              "applicationsCloseAt",
            ]) {
              const value = String(form.get(key));
              // Preserve seconds on untouched timestamps rather than silently truncating them.
              const original = initial?.[key as keyof CompetitionFields];
              body[key] =
                typeof original === "string" && localDate(original) === value
                  ? original
                  : new Date(value).toISOString();
            }
            body.season = Number(body.season);
            if (!body.regulationUrl) delete body.regulationUrl;
            if (initial) body.updatedAt = initial.updatedAt;
            setBusy(true);
            setError(null);
            try {
              await api(
                initial ? `/competitions/${initial.id}` : "/competitions",
                {
                  method: initial ? "PUT" : "POST",
                  body: JSON.stringify(body),
                },
              );
              toast.success(
                initial ? "Изменения сохранены" : "Соревнование создано",
              );
              onSaved();
            } catch (e) {
              setError(
                e instanceof Error
                  ? e.message
                  : "Не удалось сохранить соревнование",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="sm:col-span-2">
            <Field label="Название">
              <Input
                name="name"
                defaultValue={initial?.name}
                minLength={3}
                required
              />
            </Field>
          </div>
          {(
            [
              ["disciplineId", "Дисциплина", disciplines.data],
              ["typeId", "Тип соревнования", types.data],
              ["ageGroupId", "Возрастная группа", groups.data],
            ] as const
          ).map(([name, label, options]) => (
            <Field key={name} label={label}>
              <Select name={name} defaultValue={initial?.[name]} required>
                {options?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
          {(
            [
              ["level", "Уровень"],
              ["format", "Формат"],
              ["ratingBand", "Правило начисления рейтинга"],
              ["calendarPlanType", "Календарный план"],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} label={label}>
              <Select name={name} defaultValue={initial?.[name]} required>
                {Object.entries(choices[name]).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
          <Field label="Номер в календарном плане">
            <Input
              name="calendarPlanNumber"
              defaultValue={initial?.calendarPlanNumber ?? ""}
            />
          </Field>
          <Field label="Место проведения">
            <Input name="venue" defaultValue={initial?.venue} required />
          </Field>
          <Field label="Сезон">
            <Input
              name="season"
              type="number"
              min={2000}
              max={2100}
              defaultValue={initial?.season ?? new Date().getFullYear()}
              required
            />
          </Field>
          {(
            [
              ["startsAt", "Начало соревнования"],
              ["endsAt", "Окончание соревнования"],
              ["applicationsOpenAt", "Приём заявок с"],
              ["applicationsCloseAt", "Приём заявок до"],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} label={label}>
              <Input
                type="datetime-local"
                name={name}
                defaultValue={localDate(initial?.[name])}
                required
              />
            </Field>
          ))}
          <div className="sm:col-span-2 space-y-4">
            <p className="text-xs text-[#71829b]">
              Время указано в часовом поясе вашего устройства.
            </p>
            <Field label="Описание">
              <Textarea
                name="description"
                rows={3}
                defaultValue={initial?.description ?? ""}
              />
            </Field>
            <Field label="Ссылка на положение">
              <Input
                name="regulationUrl"
                type="url"
                placeholder="https://…"
                defaultValue={initial?.regulationUrl ?? ""}
              />
            </Field>
            {publishedProtocol && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                При изменении карточки опубликованный протокол станет
                черновиком. Проверьте его и опубликуйте повторно, чтобы
                результаты снова вошли в рейтинг.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Сохранение…" : "Сохранить"}
              </Button>
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={onClose}
              >
                Отмена
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
