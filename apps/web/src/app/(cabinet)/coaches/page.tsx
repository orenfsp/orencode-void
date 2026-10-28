"use client";

import { Badge, Empty, Input, PageTitle, TableWrap } from "@/components/ui";
import { api } from "@/lib/api";
import { fio } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

type Coach = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  organization: { name: string } | null;
  disciplines: Array<{ discipline: { name: string } }>;
  user: { email: string; isActive: boolean };
  athletes?: unknown[];
};

export default function CoachesPage() {
  const [items, setItems] = useState<Coach[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<Coach[]>("/coaches")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [
        fio(item),
        item.organization?.name,
        item.user.email,
        ...item.disciplines.map((link) => link.discipline.name),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [items, q]);

  return (
    <div>
      <PageTitle
        title="Реестр тренеров"
        subtitle="Тренер получает доступ к спортсмену только после подтверждённой связи."
      />
      <Input
        placeholder="Поиск по ФИО, организации, дисциплине"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <div className="mt-4">
        {filtered.length === 0 ? (
          <Empty title="Тренеры не найдены" />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f4f8fd] text-[#71829b]">
                <tr>
                  <th className="px-4 py-3">ФИО</th>
                  <th className="px-4 py-3">Организация</th>
                  <th className="px-4 py-3">Дисциплины</th>
                  <th className="px-4 py-3">Учётная запись</th>
                  <th className="px-4 py-3">Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t border-[#e1eaf5]">
                    <td className="px-4 py-3">{fio(item)}</td>
                    <td className="px-4 py-3">
                      {item.organization?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.disciplines
                        .map((link) => link.discipline.name)
                        .join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#71829b]">
                      {item.user.email}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.user.isActive ? "ok" : "bad"}>
                        {item.user.isActive ? "Активен" : "Отключён"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
    </div>
  );
}
