"use client";

import { Card, PageTitle, Skeleton, StatCard } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
import { DataState } from "@/components/data-state";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { name: string; count: number };

type Data = {
  demoLabel: string;
  total: number;
  organizations: number;
  officialCompetitions: number;
  dynamics: Array<{ year: number; count: number }>;
  byDiscipline: Row[];
  byMunicipality: Row[];
  byAgeGroup: Row[];
};

export default function DevelopmentPage() {
  const state = useApi<Data>("/reports/development");
  const data = state.data;

  if (!data) {
    return <DataState {...state} retry={state.reload} />;
  }
  return (
    <div>
      <PageTitle
        title="Показатели развития вида спорта"
        subtitle={data.demoLabel}
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Спортсмены в реестре" value={data.total} />
        <StatCard label="Организации" value={data.organizations} />
        <StatCard
          label="Официальные соревнования"
          value={data.officialCompetitions}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-medium">Динамика численности</h2>
          <p className="mb-4 text-xs text-[#71829b]">
            Накопительно по году начала занятий
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dynamics}>
                <CartesianGrid stroke="#e1eaf5" strokeDasharray="4 4" />
                <XAxis dataKey="year" stroke="#71829b" />
                <YAxis stroke="#71829b" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#f4f8fd",
                    border: "1px solid #e1eaf5",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Спортсмены"
                  stroke="#1680ff"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Спортсмены по дисциплинам</h2>
          <p className="mb-4 text-xs text-[#71829b]">
            Один спортсмен может заниматься несколькими дисциплинами
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.byDiscipline}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <CartesianGrid stroke="#e1eaf5" strokeDasharray="4 4" />
                <XAxis type="number" stroke="#71829b" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#71829b"
                  width={150}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#f4f8fd",
                    border: "1px solid #e1eaf5",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Спортсмены"
                  fill="#1680ff"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Распределение по муниципалитетам</h2>
          <p className="mb-4 text-xs text-[#71829b]">
            География регионального отделения
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byMunicipality}>
                <CartesianGrid stroke="#e1eaf5" strokeDasharray="4 4" />
                <XAxis
                  dataKey="name"
                  stroke="#71829b"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#71829b" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#f4f8fd",
                    border: "1px solid #e1eaf5",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Спортсмены"
                  fill="#1680ff"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Возрастные группы</h2>
          <p className="mb-4 text-xs text-[#71829b]">
            Расчёт по дате рождения на текущую дату
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byAgeGroup}>
                <CartesianGrid stroke="#e1eaf5" strokeDasharray="4 4" />
                <XAxis dataKey="name" stroke="#71829b" />
                <YAxis stroke="#71829b" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#f4f8fd",
                    border: "1px solid #e1eaf5",
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Спортсмены"
                  fill="#f2b84b"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
