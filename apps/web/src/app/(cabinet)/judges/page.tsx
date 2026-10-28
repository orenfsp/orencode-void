"use client";

import { Badge, Empty, Input, PageTitle, TableWrap } from "@/components/ui";
import { api } from "@/lib/api";
import { fio, formatDate } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Judge = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  user: { email: string; isActive: boolean };
  categories: Array<{
    id: string;
    categoryCode: string;
    assignedAt: string;
    expiresAt: string;
  }>;
};

function currentCategory(categories: Judge["categories"]) {
  const now = Date.now();
  return categories
    .filter((item) => new Date(item.expiresAt).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
    )[0];
}

export default function JudgesPage() {
  const [items, setItems] = useState<Judge[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api<Judge[]>("/judges")
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [
        fio(item),
        item.user.email,
        ...item.categories.map((category) => category.categoryCode),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [items, q]);

  return (
    <div>
      <PageTitle
        title="Реестр судей"
        subtitle="История категорий хранится отдельно и не перезаписывается."
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <Input
            placeholder="Поиск по ФИО или категории"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <Link className="text-sm text-[#1680ff]" href="/judge-categories">
          Заявки на судейские категории →
        </Link>
      </div>
      <div className="mt-4">
        {filtered.length === 0 ? (
          <Empty title="Судьи не найдены" />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f4f8fd] text-[#71829b]">
                <tr>
                  <th className="px-4 py-3">ФИО</th>
                  <th className="px-4 py-3">Действующая категория</th>
                  <th className="px-4 py-3">Действует до</th>
                  <th className="px-4 py-3">Всего записей</th>
                  <th className="px-4 py-3">Учётная запись</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const category = currentCategory(item.categories);
                  return (
                    <tr key={item.id} className="border-t border-[#e1eaf5]">
                      <td className="px-4 py-3">{fio(item)}</td>
                      <td className="px-4 py-3">
                        {category ? (
                          <Badge tone="ok">{category.categoryCode}</Badge>
                        ) : (
                          <Badge tone="warn">Нет действующей</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {category ? formatDate(category.expiresAt) : "—"}
                      </td>
                      <td className="px-4 py-3">{item.categories.length}</td>
                      <td className="px-4 py-3 text-[#71829b]">
                        {item.user.email}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
    </div>
  );
}
