"use client";
import { useState } from "react";
import { PageTitle, Select, Input, Card, Empty } from "@/components/ui";
import { DisciplineBadge } from "@/components/discipline-icon";
import { DataState } from "@/components/data-state";
import { useApi } from "@/hooks/use-api";
export default function PublicRatingsPage() {
  const [season, setSeason] = useState(new Date().getFullYear());
  const [discipline, setDiscipline] = useState("");
  const state = useApi<
    Array<{
      id: string;
      participant: string;
      totalPoints: string;
      stabilityApplied: boolean;
      discipline: { name: string; code: string };
    }>
  >(
    `/public/ratings?season=${season}${discipline ? `&disciplineId=${discipline}` : ""}`,
  );
  const disciplines =
    useApi<Array<{ id: string; name: string }>>("/disciplines");
  return (
    <main className="public-container py-10">
      <PageTitle
        title="Рейтинг спортсменов"
        subtitle="Демонстрационные данные. Публичный рейтинг обезличен; подробности доступны в кабинете."
      />
      <div className="mb-6 flex gap-3">
        <Input
          className="max-w-32"
          aria-label="Сезон"
          type="number"
          min={2000}
          max={2100}
          value={season}
          onChange={(e) => setSeason(Number(e.target.value))}
        />
        <Select
          aria-label="Дисциплина"
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
      </div>
      <DataState {...state} retry={state.reload} />
      <div className="space-y-3">
        {state.data?.map((r) => (
          <Card key={r.id} className="flex flex-wrap items-center gap-4">
            <span className="flex-1 font-medium">{r.participant}</span>
            <DisciplineBadge {...r.discipline} />
            {r.stabilityApplied && (
              <span className="text-xs text-[#71829b]">Стабильность ×1,2</span>
            )}
            <span className="text-xl font-semibold text-[#1680ff]">
              {r.totalPoints}
            </span>
            <span className="text-xs text-[#71829b]">баллов</span>
          </Card>
        ))}
      </div>
      {!state.loading && !state.error && !state.data?.length && (
        <Empty title="В этом сезоне ещё нет опубликованных результатов" />
      )}
    </main>
  );
}
