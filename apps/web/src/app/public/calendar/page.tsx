"use client";
import { useState } from "react";
import { Input, Select, Empty, PageTitle, Button } from "@/components/ui";
import { DataState } from "@/components/data-state";
import {
  CompetitionRow,
  type PublicCompetition,
} from "@/components/competition-row";
import { useApi } from "@/hooks/use-api";
export default function PublicCalendarPage() {
  const [q, setQ] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [period, setPeriod] = useState("upcoming");
  const [page, setPage] = useState(1);
  const events = useApi<{ items: PublicCompetition[]; total: number }>(
    `/competitions/public?pageSize=100&disciplineId=${discipline || ""}`.replace(
      "&disciplineId=",
      discipline ? "&disciplineId=" : "",
    ),
  );
  const disciplines =
    useApi<Array<{ id: string; name: string }>>("/disciplines");
  const filtered =
    events.data?.items.filter(
      (item) =>
        item.name.toLowerCase().includes(q.toLowerCase()) &&
        (period === "all" ||
          new Date(item.endsAt) >= new Date() === (period === "upcoming")),
    ) ?? [];
  return (
    <main className="public-container py-10">
      <PageTitle
        title="Соревнования"
        subtitle="Календарь спортивного программирования Оренбургской области"
      />
      <div className="mb-7 grid gap-3 md:grid-cols-[2fr_2fr_1fr]">
        <Input
          aria-label="Поиск соревнований"
          placeholder="Найти соревнование…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label="Дисциплина"
          value={discipline}
          onChange={(e) => {
            setDiscipline(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все дисциплины</option>
          {disciplines.data?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Период"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
        >
          <option value="upcoming">Предстоящие</option>
          <option value="past">Завершённые</option>
          <option value="all">Все события</option>
        </Select>
      </div>
      <DataState {...events} retry={events.reload} />
      <div className="space-y-3">
        {filtered.slice((page - 1) * 12, page * 12).map((item) => (
          <CompetitionRow key={item.id} item={item} />
        ))}
      </div>
      {!events.loading && !events.error && !filtered.length && (
        <Empty title="По выбранным условиям соревнований нет" />
      )}
      {filtered.length > 12 && (
        <div className="mt-6 flex items-center gap-4">
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Назад
          </Button>
          <span>
            {page} / {Math.ceil(filtered.length / 12)}
          </span>
          <Button
            disabled={page * 12 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </Button>
        </div>
      )}
    </main>
  );
}
