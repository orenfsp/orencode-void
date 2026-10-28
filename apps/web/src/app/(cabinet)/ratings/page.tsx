"use client";
import { useState } from "react";
import { SPORTS_RANKS } from "@fsp/shared";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageTitle,
  Select,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio } from "@/lib/utils";
import { toast } from "sonner";
type Rating = {
  id: string;
  totalPoints: string;
  stabilityApplied: boolean;
  athlete: { lastName: string; firstName: string; middleName: string | null };
  discipline: { name: string };
  entries: Array<{
    id: string;
    basePoints: number;
    coefficient: string;
    finalPoints: string;
    competition: { name: string };
  }>;
};
export default function RatingsPage() {
  const user = useUser();
  const [season, setSeason] = useState(new Date().getFullYear());
  const [discipline, setDiscipline] = useState("");
  const [group, setGroup] = useState("");
  const [rank, setRank] = useState("");
  const [busy, setBusy] = useState(false);
  const state = useApi<Rating[]>(
    `/ratings?season=${season}${discipline ? `&disciplineId=${discipline}` : ""}${group ? `&ageGroupId=${group}` : ""}${rank ? `&minRank=${encodeURIComponent(rank)}` : ""}`,
  );
  const disciplines =
    useApi<Array<{ id: string; name: string }>>("/disciplines");
  const groups = useApi<Array<{ id: string; name: string }>>("/age-groups");
  const rules = useApi<
    Array<{ id: string; band: string; place: number; points: number }>
  >(`/ratings/rules?season=${season}`);
  return (
    <div>
      <PageTitle
        title="Рейтинг спортсменов"
        subtitle="Баллы за сезон по каждой дисциплине. Действующие дисквалификации и отстранения исключены."
      />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Field label="Сезон">
          <Input
            type="number"
            value={season}
            min={2000}
            max={2100}
            onChange={(e) => setSeason(Number(e.target.value))}
          />
        </Field>
        <Field label="Дисциплина">
          <Select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          >
            <option value="">Все дисциплины</option>
            {disciplines.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Возрастная группа">
          <Select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">Все группы</option>
            {groups.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Минимальный разряд">
          <Select value={rank} onChange={(e) => setRank(e.target.value)}>
            <option value="">Без ограничения</option>
            {SPORTS_RANKS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
      </div>
      <DataState {...state} retry={state.reload} />
      <div className="space-y-3">
        {state.data?.map((item) => (
          <Card key={item.id}>
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="font-semibold">{fio(item.athlete)}</h2>
                <p className="mt-1 text-sm text-[#71829b]">
                  {item.discipline.name}
                  {item.stabilityApplied ? " · стабильность ×1,2" : ""}
                </p>
              </div>
              <strong className="text-xl text-[#1680ff]">
                {item.totalPoints}
              </strong>
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-[#1680ff]">
                Как рассчитаны баллы
              </summary>
              <ul className="mt-3 space-y-2 text-[#71829b]">
                {item.entries.map((e) => (
                  <li key={e.id}>
                    {e.competition.name}: {e.basePoints} × {e.coefficient} ={" "}
                    {e.finalPoints}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        ))}
      </div>
      {!state.loading && !state.error && !state.data?.length && (
        <Empty title="Рейтинговых записей по выбранным условиям нет" />
      )}
      {user?.activeRole === "FEDERATION" && (
        <details className="mt-6 rounded-xl border border-[#e1eaf5] bg-white p-5">
          <summary className="cursor-pointer font-semibold">
            Настройки рейтинга
          </summary>
          <div className="my-4 flex gap-3">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/ratings/recalculate", {
                    method: "POST",
                    body: JSON.stringify({ season }),
                  });
                  state.reload();
                  toast.success("Рейтинг пересчитан");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Ошибка");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Пересчитать сезон
            </Button>
          </div>
          <p className="mb-4 text-xs text-[#71829b]">
            Изменение правила автоматически пересчитывает сезон.
          </p>
          <div className="space-y-3">
            {rules.data?.map((r) => (
              <form
                key={r.id}
                className="flex flex-wrap items-center gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const points = Number(
                    new FormData(event.currentTarget).get("points"),
                  );
                  setBusy(true);
                  try {
                    await api("/ratings/rules", {
                      method: "POST",
                      body: JSON.stringify({
                        season,
                        band: r.band,
                        place: r.place,
                        points,
                      }),
                    });
                    rules.reload();
                    state.reload();
                    toast.success("Правило обновлено");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Ошибка");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <span className="flex-1 text-sm">
                  {
                    (
                      {
                        REGIONAL: "Региональные",
                        INTERREGIONAL: "Межрегиональные",
                        RUSSIA_YOUTH: "Первенство России",
                        RUSSIA_CHAMPIONSHIP: "Чемпионат России",
                      } as Record<string, string>
                    )[r.band]
                  }
                  , место {r.place}
                </span>
                <Input
                  className="w-24"
                  name="points"
                  type="number"
                  aria-label={`Баллы за место ${r.place}`}
                  min={0}
                  required
                  defaultValue={r.points}
                />
                <Button type="submit" variant="outline" disabled={busy}>
                  Сохранить
                </Button>
              </form>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
