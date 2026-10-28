"use client";

import { Card, PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

export default function MyRatingPage() {
  const [items, setItems] = useState<
    Array<{
      totalPoints: string;
      stabilityApplied: boolean;
      discipline: { name: string };
      entries: Array<{
        basePoints: number;
        coefficient: string;
        finalPoints: string;
        competition: { name: string };
      }>;
    }>
  >([]);
  useEffect(() => {
    api<typeof items>("/ratings/me?season=2026").then(setItems);
  }, []);
  return (
    <div>
      <PageTitle title="Мой рейтинг" subtitle="Сезон 2026" />
      {items.map((item) => (
        <Card key={item.discipline.name}>
          <p>
            {item.discipline.name}: {item.totalPoints}
            {item.stabilityApplied ? " (×1,2)" : ""}
          </p>
          <ul className="mt-2 text-sm text-[#71829b]">
            {item.entries.map((entry) => (
              <li key={entry.competition.name}>
                {entry.competition.name}: {entry.basePoints} ×{" "}
                {entry.coefficient} = {entry.finalPoints}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
