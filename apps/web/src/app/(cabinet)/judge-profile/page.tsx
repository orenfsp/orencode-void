"use client";

import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageTitle,
  TableWrap,
} from "@/components/ui";
import { api, type AuthUser } from "@/lib/api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type JudgeProfile = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  categories: Array<{
    id: string;
    categoryCode: string;
    assignedAt: string;
    expiresAt: string;
    orderNumber: string | null;
  }>;
  categoryApplications: Array<{
    id: string;
    requestedCategory: string;
    status: string;
    submittedAt: string;
    comment: string | null;
  }>;
  assignments: Array<{
    id: string;
    position: string;
    assignedAt: string;
    endedAt: string | null;
    competition: { id: string; name: string; startsAt: string; venue: string };
  }>;
};

function currentCategory(items: JudgeProfile["categories"]) {
  const now = Date.now();
  return items
    .filter(
      (item) =>
        new Date(item.assignedAt).getTime() <= now &&
        new Date(item.expiresAt).getTime() >= now,
    )
    .sort(
      (a, b) =>
        new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
    )[0];
}

export default function JudgeProfilePage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<JudgeProfile | null>(null);
  const [requested, setRequested] = useState("Первая категория");

  async function load() {
    setProfile(await api<JudgeProfile>("/judges/me"));
  }

  useEffect(() => {
    api<AuthUser>("/auth/me").then(async (user) => {
      setMe(user);
      if (user.judgeId) {
        await load();
      }
    });
  }, []);

  if (!me) return null;
  if (!profile) {
    return <Empty title="Профиль судьи не привязан к учётной записи" />;
  }
  const active = currentCategory(profile.categories);
  const hasPending = profile.categoryApplications.some(
    (item) => item.status === "PENDING",
  );

  return (
    <div>
      <PageTitle title={fio(profile)} subtitle={me.email} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-sm text-[#71829b]">Действующая категория</p>
          <p className="mt-2 text-xl font-medium">
            {active?.categoryCode ?? "Не присвоена"}
          </p>
          {active ? (
            <p className="mt-1 text-sm text-[#71829b]">
              Присвоена {formatDate(active.assignedAt)} · действует до{" "}
              {formatDate(active.expiresAt)}
            </p>
          ) : null}
          <Link
            className="mt-3 inline-block text-sm text-[#1680ff]"
            href="/judge-categories"
          >
            История и заявки →
          </Link>
        </Card>

        <Card>
          <p className="text-sm text-[#71829b]">Назначений всего</p>
          <p className="mt-2 text-3xl font-semibold">
            {profile.assignments.length}
          </p>
          <p className="mt-1 text-sm text-[#71829b]">
            Действующих:{" "}
            {profile.assignments.filter((item) => !item.endedAt).length}
          </p>
        </Card>

        <Card>
          <h2 className="mb-2 font-medium">Заявка на категорию</h2>
          <p className="mb-3 text-xs text-[#71829b]">
            Решение принимает федерация.
          </p>
          <div className="space-y-2">
            <Field label="Желаемая категория">
              <Input
                value={requested}
                onChange={(event) => setRequested(event.target.value)}
              />
            </Field>
            <Button
              disabled={hasPending}
              onClick={async () => {
                try {
                  await api("/judge-category-applications", {
                    method: "POST",
                    body: JSON.stringify({ requestedCategory: requested }),
                  });
                  toast.success("Заявка подана");
                  await load();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Ошибка",
                  );
                }
              }}
            >
              {hasPending ? "Заявка уже на рассмотрении" : "Подать заявку"}
            </Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-3 mt-6 font-medium">Мои назначения</h2>
      {profile.assignments.length === 0 ? (
        <Empty title="Назначений пока нет" />
      ) : (
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f8fd] text-[#71829b]">
              <tr>
                <th className="px-4 py-3">Соревнование</th>
                <th className="px-4 py-3">Должность</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {profile.assignments.map((item) => (
                <tr key={item.id} className="border-t border-[#e1eaf5]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/competitions/${item.competition.id}`}
                      className="hover:text-[#1680ff]"
                    >
                      {item.competition.name}
                    </Link>
                    <div className="text-xs text-[#71829b]">
                      {item.competition.venue}
                    </div>
                  </td>
                  <td className="px-4 py-3">{item.position}</td>
                  <td className="px-4 py-3">
                    {formatDate(item.competition.startsAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={item.endedAt ? "neutral" : "ok"}>
                      {item.endedAt ? "Завершено" : "Действует"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <h2 className="mb-3 mt-6 font-medium">История категорий</h2>
      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f4f8fd] text-[#71829b]">
            <tr>
              <th className="px-4 py-3">Категория</th>
              <th className="px-4 py-3">Присвоена</th>
              <th className="px-4 py-3">Действует до</th>
              <th className="px-4 py-3">Приказ</th>
            </tr>
          </thead>
          <tbody>
            {profile.categories.map((item) => (
              <tr key={item.id} className="border-t border-[#e1eaf5]">
                <td className="px-4 py-3">{item.categoryCode}</td>
                <td className="px-4 py-3">{formatDate(item.assignedAt)}</td>
                <td className="px-4 py-3">{formatDate(item.expiresAt)}</td>
                <td className="px-4 py-3">{item.orderNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>

      <h2 className="mb-3 mt-6 font-medium">Заявки</h2>
      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f4f8fd] text-[#71829b]">
            <tr>
              <th className="px-4 py-3">Категория</th>
              <th className="px-4 py-3">Подана</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Комментарий</th>
            </tr>
          </thead>
          <tbody>
            {profile.categoryApplications.map((item) => (
              <tr key={item.id} className="border-t border-[#e1eaf5]">
                <td className="px-4 py-3">{item.requestedCategory}</td>
                <td className="px-4 py-3">{formatDate(item.submittedAt)}</td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      item.status === "APPROVED"
                        ? "ok"
                        : item.status === "PENDING"
                          ? "warn"
                          : "bad"
                    }
                  >
                    {statusLabel[item.status] ?? item.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">{item.comment ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
