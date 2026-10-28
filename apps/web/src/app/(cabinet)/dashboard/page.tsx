"use client";

import { Card, PageTitle, Skeleton } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { DataState } from "@/components/data-state";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Dash = {
  athletes: number;
  coaches: number;
  judges: number;
  organizations: number;
  pendingApps: number;
  pendingRanks: number;
  pendingCats: number;
  expiringRanks: number;
  expiringCategories: number;
  demoLabel: string;
  upcoming: Array<{
    id: string;
    name: string;
    startsAt: string;
    discipline: { name: string };
  }>;
  dynamics: Array<{ year: number; count: number }>;
};

export default function DashboardPage() {
  const state = useApi<Dash>("/reports/dashboard");
  const data = state.data;

  if (!data) {
    return <DataState {...state} retry={state.reload} />;
  }
  const cards = [
    ["Спортсмены", data.athletes],
    ["Тренеры", data.coaches],
    ["Судьи", data.judges],
    ["Организации", data.organizations],
    ["Заявки на соревнования", data.pendingApps],
    ["Заявки на разряды", data.pendingRanks],
    ["Заявки на категории", data.pendingCats],
    ["Истекающие разряды", data.expiringRanks],
    ["Истекающие категории", data.expiringCategories],
  ];
  return (
    <div>
      <PageTitle title="Обзор региона" subtitle={data.demoLabel} />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-[#71829b]">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">Динамика численности</h2>
          <p className="mb-3 text-xs text-[#71829b]">
            Накопительно по году начала занятий
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dynamics}>
                <XAxis dataKey="year" stroke="#71829b" />
                <YAxis stroke="#71829b" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#1680ff"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 font-medium">Ближайшие соревнования</h2>
          <ul className="space-y-3 text-sm">
            {data.upcoming.map((item) => (
              <li key={item.id}>
                {item.name}
                <div className="text-[#71829b]">
                  {item.discipline.name} · {formatDate(item.startsAt)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
