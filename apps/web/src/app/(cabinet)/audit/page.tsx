"use client";

import { PageTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function AuditPage() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      createdAt: string;
      user: { lastName: string; firstName: string } | null;
    }>
  >([]);
  useEffect(() => {
    api<{ items: typeof items }>("/audit-logs").then((data) =>
      setItems(data.items),
    );
  }, []);
  return (
    <div>
      <PageTitle title="Журнал действий" />
      <div className="overflow-x-auto rounded-2xl border border-[#e1eaf5]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f4f8fd] text-[#71829b]">
            <tr>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Пользователь</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3">Сущность</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[#e1eaf5]">
                <td className="px-4 py-3">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  {item.user
                    ? `${item.user.lastName} ${item.user.firstName}`
                    : "—"}
                </td>
                <td className="px-4 py-3">{item.action}</td>
                <td className="px-4 py-3">{item.entityType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
