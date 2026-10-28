"use client";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageTitle,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { DisciplineIcon } from "@/components/discipline-icon";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
import { toast } from "sonner";
import { AwardApplications } from "@/features/awards/award-applications";
type Athlete = {
  id: string;
  currentRank: { rankType: string; expiresAt: string } | null;
  ranks: Array<{
    id: string;
    rankType: string;
    assignedAt: string;
    expiresAt: string;
    orderNumber: string | null;
  }>;
  disciplines: Array<{
    discipline: { id: string; name: string; code: string; description: string };
  }>;
  coaches: Array<{
    id: string;
    status: string;
    coach: { firstName: string; lastName: string };
    discipline: { name: string };
  }>;
  antiDoping: Array<{
    id: string;
    courseName: string;
    completedAt: string;
    certificateNumber: string;
  }>;
};
export function ProfileSection({
  section,
}: {
  section: "disciplines" | "coaches" | "rank" | "anti-doping";
}) {
  const state = useApi<Athlete>("/athletes/me");
  const athlete = state.data;
  const [busy, setBusy] = useState(false);
  const titles = {
    disciplines: "Мои дисциплины",
    coaches: "Мои тренеры",
    rank: "Мой разряд",
    "anti-doping": "Антидопинговое обучение",
  };
  async function respond(id: string, status: string) {
    setBusy(true);
    try {
      await api(`/coaches/links/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      state.reload();
      toast.success("Статус связи изменён");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <PageTitle title={titles[section]} />
      <DataState {...state} retry={state.reload} />
      {!state.loading && !state.error && !athlete && (
        <Empty title="Профиль спортсмена не привязан" />
      )}
      {athlete && (
        <>
          {section === "disciplines" && (
            <div className="grid gap-4 md:grid-cols-2">
              {athlete.disciplines.map(({ discipline }) => (
                <Card key={discipline.id}>
                  <DisciplineIcon code={discipline.code} />
                  <h2 className="my-3 font-semibold">{discipline.name}</h2>
                  <p className="text-sm text-[#71829b]">
                    {discipline.description}
                  </p>
                </Card>
              ))}
            </div>
          )}
          {section === "coaches" && (
            <div className="space-y-4">
              {athlete.coaches.map((link) => (
                <Card
                  key={link.id}
                  className="flex flex-wrap items-center gap-4"
                >
                  <div className="flex-1">
                    <h2 className="font-semibold">{fio(link.coach)}</h2>
                    <p className="mt-1 text-sm text-[#71829b]">
                      {link.discipline.name}
                    </p>
                  </div>
                  <Badge>{statusLabel[link.status] ?? "Связь завершена"}</Badge>
                  {["PENDING", "SUSPENDED"].includes(link.status) && (
                    <Button
                      disabled={busy}
                      onClick={() => void respond(link.id, "ACTIVE")}
                    >
                      {link.status === "PENDING"
                        ? "Подтвердить"
                        : "Возобновить"}
                    </Button>
                  )}
                  {link.status === "ACTIVE" && (
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => void respond(link.id, "SUSPENDED")}
                    >
                      Приостановить
                    </Button>
                  )}
                  {link.status !== "ENDED" && (
                    <Button
                      disabled={busy}
                      variant="ghost"
                      onClick={() => void respond(link.id, "ENDED")}
                    >
                      {link.status === "PENDING"
                        ? "Отклонить"
                        : "Завершить связь"}
                    </Button>
                  )}
                </Card>
              ))}
              {!athlete.coaches.length && (
                <Empty title="Запросов от тренеров пока нет" />
              )}
            </div>
          )}
          {section === "rank" && (
            <>
              <Card className="mb-5">
                <h2 className="font-semibold">
                  Действующий разряд:{" "}
                  {athlete.currentRank?.rankType ?? "не присвоен"}
                </h2>
                {athlete.currentRank && (
                  <p className="mt-2 text-sm text-[#71829b]">
                    Действует до {formatDate(athlete.currentRank.expiresAt)}
                  </p>
                )}
                <h3 className="mb-3 mt-5 text-sm font-medium">
                  История присвоений
                </h3>
                {athlete.ranks.map((rank) => (
                  <p key={rank.id} className="mb-2 text-sm text-[#71829b]">
                    {rank.rankType} · {formatDate(rank.assignedAt)} —{" "}
                    {formatDate(rank.expiresAt)} · приказ{" "}
                    {rank.orderNumber ?? "не указан"}
                  </p>
                ))}
              </Card>
              <AwardApplications kind="rank" />
            </>
          )}
          {section === "anti-doping" && (
            <>
              <Card className="mb-5">
                <h2 className="mb-4 font-semibold">
                  Добавить сведения о прохождении
                </h2>
                <form
                  className="grid items-end gap-4 md:grid-cols-2"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const data = new FormData(form);
                    setBusy(true);
                    try {
                      await api(`/athletes/${athlete.id}/anti-doping`, {
                        method: "POST",
                        body: JSON.stringify(Object.fromEntries(data)),
                      });
                      toast.success("Сведения сохранены");
                      form.reset();
                      state.reload();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Ошибка");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Field label="Название курса">
                    <Input name="courseName" required />
                  </Field>
                  <Field label="Дата прохождения">
                    <Input
                      name="completedAt"
                      type="date"
                      max={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </Field>
                  <Field label="Номер сертификата">
                    <Input name="certificateNumber" />
                  </Field>
                  <Button type="submit" disabled={busy}>
                    Сохранить
                  </Button>
                </form>
              </Card>
              <div className="space-y-3">
                {athlete.antiDoping.map((r) => (
                  <Card key={r.id}>
                    <h2 className="font-medium">{r.courseName}</h2>
                    <p className="mt-2 text-sm text-[#71829b]">
                      {formatDate(r.completedAt)} · Сертификат{" "}
                      {r.certificateNumber || "не указан"}
                    </p>
                  </Card>
                ))}
              </div>
              {!athlete.antiDoping.length && (
                <Empty title="Сведения о прохождении пока не добавлены" />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
