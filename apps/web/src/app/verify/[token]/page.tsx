"use client";

import { Card, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<{
    valid: boolean;
    number: string;
    athlete: string;
    competition: string;
    discipline: string;
    place: number | null;
    issuedAt: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<NonNullable<typeof data>>(`/documents/verify/${params.token}`)
      .then(setData)
      .catch(() => setError("Справка не найдена"));
  }, [params.token]);
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <PageTitle title="Проверка справки об участии" />
      <Card>
        {error ? <p>{error}</p> : null}
        {data ? (
          <div className="space-y-2 text-sm">
            <p className={data.valid ? "text-emerald-700" : "text-amber-700"}>
              {data.valid
                ? "Документ подлинный, результат опубликован."
                : "Результат пересматривается. Подтверждение справки временно недоступно."}
            </p>
            <p>№ {data.number}</p>
            <p>Спортсмен: {data.athlete}</p>
            <p>Соревнование: {data.competition}</p>
            <p>Дисциплина: {data.discipline}</p>
            <p>Место: {data.place ?? "—"}</p>
            <p>Дата: {formatDate(data.issuedAt)}</p>
          </div>
        ) : null}
      </Card>
    </main>
  );
}
