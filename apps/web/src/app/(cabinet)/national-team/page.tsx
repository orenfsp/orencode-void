"use client";
import { useState } from "react";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  PageTitle,
  Select,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useApi } from "@/hooks/use-api";
import { api, downloadFile } from "@/lib/api";
import { fio } from "@/lib/utils";
import { toast } from "sonner";
type Person = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
};
type Team = {
  id: string;
  title: string;
  season: number;
  disciplineId: string;
  ageGroupId: string;
  discipline: { name: string };
  ageGroup: { name: string };
  members: Array<{ athleteId: string; source: string; athlete: Person }>;
  history: Array<{ id: string; action: string; createdAt: string }>;
};
export default function NationalTeamPage() {
  const [season, setSeason] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const teams = useApi<Team[]>(`/national-team?season=${season}`);
  const team = teams.data?.find((t) => t.id === selected) ?? teams.data?.[0];
  const ratings = useApi<
    Array<{
      id: string;
      athleteId: string;
      totalPoints: string;
      athlete: Person;
    }>
  >(
    team
      ? `/ratings?season=${season}&disciplineId=${team.disciplineId}&ageGroupId=${team.ageGroupId}`
      : null,
  );
  const disciplines =
    useApi<Array<{ id: string; name: string }>>("/disciplines");
  const groups = useApi<Array<{ id: string; name: string }>>("/age-groups");
  const athletes = useApi<Person[]>("/athletes/directory");
  async function add(athleteId: string, source: string, note?: string) {
    if (!team) return;
    setBusy(true);
    try {
      await api(`/national-team/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ athleteId, source, note }),
      });
      toast.success("Спортсмен включён в состав");
      teams.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  async function download(ext: string) {
    try {
      await downloadFile(
        `/documents/national-team/${team?.id}.${ext}`,
        undefined,
        `сборная.${ext}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3">
        <PageTitle
          title="Сборная региона"
          subtitle="Решение об отборе принимает федерация. Возрастная группа проверяется на 31 декабря сезона."
        />
        <Button className="h-fit" onClick={() => setOpen(true)}>
          Создать состав
        </Button>
      </div>
      <div className="mb-5 flex gap-3">
        <Input
          aria-label="Сезон"
          className="max-w-32"
          type="number"
          min={2000}
          max={2100}
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
        />
        <Select
          aria-label="Состав сборной"
          value={team?.id ?? ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {teams.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      </div>
      <DataState {...teams} retry={teams.reload} />
      {team ? (
        <>
          <Card>
            <h2 className="font-semibold">{team.title}</h2>
            <p className="mt-2 text-sm text-[#71829b]">
              {team.discipline.name} · {team.ageGroup.name}
            </p>
            <div className="my-4 space-y-2">
              {team.members.map((m) => (
                <div
                  key={m.athleteId}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {fio(m.athlete)}{" "}
                    <span className="text-xs text-[#71829b]">
                      ({m.source === "RATING" ? "по рейтингу" : "ручной отбор"})
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api(
                          `/national-team/${team.id}/members/${m.athleteId}`,
                          { method: "DELETE" },
                        );
                        teams.reload();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Ошибка");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Исключить
                  </Button>
                </div>
              ))}
              {!team.members.length && (
                <p className="text-sm text-[#71829b]">Состав пока пуст.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void download("pdf")}>
                Список PDF
              </Button>
              <Button variant="outline" onClick={() => void download("docx")}>
                Проект приказа DOCX
              </Button>
            </div>
          </Card>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-semibold">Рейтинговый отбор</h2>
              <DataState {...ratings} retry={ratings.reload} />
              {ratings.data?.map((r) => (
                <div
                  key={r.id}
                  className="mb-3 flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {fio(r.athlete)} · {r.totalPoints} баллов
                  </span>
                  <Button
                    disabled={
                      busy ||
                      team.members.some((m) => m.athleteId === r.athleteId)
                    }
                    variant="outline"
                    onClick={() => void add(r.athleteId, "RATING")}
                  >
                    В состав
                  </Button>
                </div>
              ))}
              {!ratings.loading && !ratings.data?.length && (
                <p className="text-sm text-[#71829b]">
                  Нет спортсменов с рейтингом для выбранных условий.
                </p>
              )}
            </Card>
            <Card>
              <h2 className="mb-4 font-semibold">Ручной отбор</h2>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void add(
                    String(form.get("athleteId")),
                    "MANUAL",
                    String(form.get("note")),
                  );
                }}
              >
                <Field label="Спортсмен">
                  <Select name="athleteId" required>
                    <option value="">Выберите спортсмена</option>
                    {athletes.data?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {fio(a)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Основание отбора">
                  <Input name="note" required />
                </Field>
                <Button disabled={busy} type="submit">
                  Добавить в состав
                </Button>
              </form>
              <p className="mt-4 text-xs text-[#71829b]">
                Сервер проверит дисциплину, возраст и отсутствие действующей
                дисквалификации.
              </p>
            </Card>
          </div>
          <details className="mt-5 rounded-xl border border-[#e1eaf5] bg-white p-5">
            <summary className="cursor-pointer text-sm font-medium">
              История изменения состава
            </summary>
            <div className="mt-4 space-y-2 text-xs text-[#71829b]">
              {team.history.map((h) => (
                <p key={h.id}>
                  {new Date(h.createdAt).toLocaleString("ru-RU")} ·{" "}
                  {h.action === "ADD"
                    ? "Включение в состав"
                    : "Исключение из состава"}
                </p>
              ))}
            </div>
          </details>
        </>
      ) : (
        !teams.loading &&
        !teams.error && <Empty title="В этом сезоне составы ещё не созданы" />
      )}
      {open && (
        <Modal title="Новый состав сборной" onClose={() => setOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              setBusy(true);
              try {
                const created = await api<Team>("/national-team", {
                  method: "POST",
                  body: JSON.stringify({
                    ...Object.fromEntries(values),
                    season,
                  }),
                });
                setSelected(created.id);
                setOpen(false);
                teams.reload();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Ошибка");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Название">
              <Input name="title" required />
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
            <Field label="Возрастная группа">
              <Select name="ageGroupId" required>
                {groups.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" disabled={busy}>
              Создать
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
