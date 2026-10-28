"use client";

import { Button, Card, PageTitle, Skeleton } from "@/components/ui";
import { downloadFile } from "@/lib/api";
import { useApi } from "@/hooks/use-api";
import { DataState } from "@/components/data-state";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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

type CountRow = { name: string; count: number };

type Report = {
  demoLabel: string;
  total: number;
  organizations: number;
  officialCompetitions: number;
  dynamics: Array<{ year: number; count: number }>;
  byDiscipline: CountRow[];
  byMunicipality: CountRow[];
  byAgeGroup: CountRow[];
  byOrganization: CountRow[];
};

const charts: Array<{
  title: string;
  key: keyof Pick<
    Report,
    "byDiscipline" | "byMunicipality" | "byAgeGroup" | "byOrganization"
  >;
}> = [
  { title: "По дисциплинам", key: "byDiscipline" },
  { title: "По муниципалитетам", key: "byMunicipality" },
  { title: "По возрастным группам", key: "byAgeGroup" },
  { title: "По организациям", key: "byOrganization" },
];

export default function ReportsPage() {
  const state = useApi<Report>("/reports/headcount");
  const data = state.data;
  const [downloading, setDownloading] = useState(false);

  if (!data) {
    return <DataState {...state} retry={state.reload} />;
  }

  return (
    <div>
      <PageTitle
        title="Отчёт о численности занимающихся"
        subtitle={data.demoLabel}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="text-sm">
          Всего занимающихся:{" "}
          <span className="text-lg font-semibold">{data.total}</span>
        </p>
        <Button
          variant="outline"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            try {
              await downloadFile(
                "/documents/headcount.xlsx",
                undefined,
                "otchet-chislennost.xlsx",
              );
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Ошибка экспорта",
              );
            } finally {
              setDownloading(false);
            }
          }}
        >
          Экспорт XLSX
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-medium">Динамика численности</h2>
          <p className="mb-4 text-xs text-[#71829b]">
            Накопительное количество спортсменов по году начала занятий.
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

        {charts.map((chart) => {
          const rows = data[chart.key];
          return (
            <Card key={chart.key}>
              <h2 className="mb-3 font-medium">{chart.title}</h2>
              {rows.length === 0 ? (
                <p className="text-sm text-[#71829b]">Нет данных.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rows}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid stroke="#e1eaf5" strokeDasharray="4 4" />
                      <XAxis
                        type="number"
                        stroke="#71829b"
                        allowDecimals={false}
                      />
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
                        name="Количество"
                        fill="#1680ff"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[#71829b]">
        Все показатели рассчитаны из записей реестра. Значения помечены как
        демонстрационные.
      </p>
    </div>
  );
}
