"use client";

import { Badge, Card, PageTitle } from "@/components/ui";
import { api, downloadUrl } from "@/lib/api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AthleteCardPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api<Record<string, unknown>>(`/athletes/${params.id}`).then(setData);
  }, [params.id]);
  if (!data) {
    return null;
  }
  const athlete = data as {
    lastName: string;
    firstName: string;
    middleName: string | null;
    municipality: string;
    status: string;
    results: Array<{
      id: string;
      place: number;
      score: string;
      competition: { name: string };
    }>;
    ranks: Array<{ id: string; rankType: string; expiresAt: string }>;
    currentRank: { rankType: string } | null;
  };
  return (
    <div>
      <PageTitle title={fio(athlete)} subtitle={athlete.municipality} />
      <Badge>{statusLabel[athlete.status] ?? athlete.status}</Badge>
      <p className="mt-3 text-sm">
        Актуальный разряд: {athlete.currentRank?.rankType ?? "не присвоен"}
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Результаты</h2>
          <ul className="space-y-2 text-sm">
            {athlete.results.map((item) => (
              <li key={item.id}>
                {item.competition.name}: место {item.place}, {item.score}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">История разрядов</h2>
          <ul className="space-y-2 text-sm">
            {athlete.ranks.map((item) => (
              <li key={item.id}>
                {item.rankType} до {formatDate(item.expiresAt)}
              </li>
            ))}
          </ul>
          <a
            className="mt-4 inline-block text-sm text-[#1680ff]"
            href={downloadUrl(`/documents/athletes/${params.id}/history.pdf`)}
          >
            Скачать историю соревнований (PDF)
          </a>
        </Card>
      </div>
    </div>
  );
}
