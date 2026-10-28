"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Empty, PageTitle } from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { api } from "@/lib/api";
import { fio } from "@/lib/utils";
type Result = {
  id: string;
  place: number;
  score: string;
  competition: { id: string; name: string; disciplineId: string };
};
export default function MyResultsPage() {
  const user = useUser();
  const [rows, setRows] = useState<Array<Result & { name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (user?.activeRole === "COACH") {
        const links = await api<
          Array<{
            athleteId: string;
            disciplineId: string;
            status: string;
            athlete: { firstName: string; lastName: string };
          }>
        >("/coaches/me/athletes");
        const active = links.filter((l) => l.status === "ACTIVE");
        const results = await Promise.all(
          active.map(async (l) => {
            const athlete = await api<{ results: Result[] }>(
              `/athletes/${l.athleteId}`,
            );
            return athlete.results
              .filter((r) => r.competition.disciplineId === l.disciplineId)
              .map((r) => ({ ...r, name: fio(l.athlete) }));
          }),
        );
        setRows(results.flat());
      } else {
        const athlete = await api<{ results: Result[] }>("/athletes/me");
        setRows(athlete?.results.map((r) => ({ ...r, name: "" })) ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [user?.activeRole]);
  return (
    <div>
      <PageTitle
        title={
          user?.activeRole === "COACH"
            ? "Результаты подопечных"
            : "Мои результаты"
        }
        subtitle="Только опубликованные протоколы"
      />
      <DataState loading={loading} error={error} retry={load} />
      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <Link
              className="font-medium text-[#1680ff]"
              href={`/competitions/${r.competition.id}`}
            >
              {r.competition.name}
            </Link>
            <p className="mt-2 text-sm text-[#71829b]">
              {r.name && `${r.name} · `}Место {r.place} · {r.score} баллов
            </p>
          </Card>
        ))}
      </div>
      {!loading && !error && !rows.length && (
        <Empty title="Опубликованных результатов пока нет" />
      )}
    </div>
  );
}
