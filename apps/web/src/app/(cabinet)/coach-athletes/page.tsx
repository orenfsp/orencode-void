"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageTitle,
  Select,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio, statusLabel } from "@/lib/utils";
import { toast } from "sonner";
type Person = { id: string; lastName: string; firstName: string };
export default function CoachAthletesPage() {
  const state = useApi<
    Array<{
      id: string;
      status: string;
      athlete: Person;
      discipline: { name: string };
    }>
  >("/coaches/me/athletes");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const directory = useApi<Person[]>(
    `/athletes/directory?q=${encodeURIComponent(q)}`,
  );
  const disciplines =
    useApi<Array<{ id: string; name: string }>>("/disciplines");
  return (
    <div>
      <PageTitle
        title="Мои спортсмены"
        subtitle="Доступ к профилю появляется после подтверждения связи спортсменом."
      />
      <DataState {...state} retry={state.reload} />
      <Card className="mb-6">
        <h2 className="mb-4 font-semibold">Запросить привязку</h2>
        <Input
          placeholder="Найти спортсмена по фамилии…"
          aria-label="Поиск спортсмена"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-4"
        />
        <form
          className="grid items-end gap-4 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault();
            const values = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api("/coaches/links", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(values)),
              });
              toast.success("Запрос отправлен спортсмену");
              state.reload();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Ошибка");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Спортсмен">
            <Select name="athleteId" required>
              <option value="">Выберите спортсмена</option>
              {directory.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {fio(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дисциплина">
            <Select name="disciplineId" required>
              {disciplines.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" disabled={busy}>
            Отправить запрос
          </Button>
        </form>
      </Card>
      <div className="space-y-3">
        {state.data?.map((link) => (
          <Card key={link.id} className="flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <h2 className="font-medium">{fio(link.athlete)}</h2>
              <p className="mt-1 text-sm text-[#71829b]">
                {link.discipline.name}
              </p>
            </div>
            <Badge tone={link.status === "ACTIVE" ? "ok" : "neutral"}>
              {statusLabel[link.status] ?? "Связь завершена"}
            </Badge>
            {link.status === "ACTIVE" && (
              <Link className="text-link" href={`/athletes/${link.athlete.id}`}>
                Открыть профиль →
              </Link>
            )}
          </Card>
        ))}
      </div>
      {!state.loading && !state.error && !state.data?.length && (
        <Empty title="Подопечных пока нет" />
      )}
    </div>
  );
}
