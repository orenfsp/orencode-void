"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Empty,
  Input,
  PageTitle,
  Select,
  TableWrap,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { ApplicationActions } from "@/features/competitions/application-actions";
import { useApi } from "@/hooks/use-api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
type Application = {
  id: string;
  status: string;
  submittedAt: string;
  rejectionReason: string | null;
  athlete: { lastName: string; firstName: string; middleName: string | null };
  competition: { id: string; name: string };
};
export default function ApplicationsPage() {
  const state = useApi<Application[]>("/applications");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const items =
    state.data?.filter(
      (a) =>
        (!status || a.status === status) &&
        `${fio(a.athlete)} ${a.competition.name}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    ) ?? [];
  return (
    <div>
      <PageTitle
        title="Заявки на соревнования"
        subtitle="Подача, рассмотрение и история решений"
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          className="max-w-md"
          aria-label="Поиск заявки"
          placeholder="Спортсмен или соревнование…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          aria-label="Статус заявки"
          className="max-w-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          {["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"].map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </Select>
      </div>
      <DataState {...state} retry={state.reload} />
      {items.length > 0 && (
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f8fd] text-[#71829b]">
              <tr>
                {[
                  "Спортсмен",
                  "Соревнование",
                  "Дата",
                  "Статус",
                  "Действия",
                ].map((label) => (
                  <th className="px-4 py-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#e1eaf5]">
                  <td className="px-4 py-4">{fio(item.athlete)}</td>
                  <td className="px-4 py-4">
                    <Link
                      href={`/competitions/${item.competition.id}`}
                      className="text-[#1680ff]"
                    >
                      {item.competition.name}
                    </Link>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {formatDate(item.submittedAt)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      tone={
                        item.status === "APPROVED"
                          ? "ok"
                          : item.status === "PENDING"
                            ? "warn"
                            : "bad"
                      }
                    >
                      {statusLabel[item.status]}
                    </Badge>
                    {item.rejectionReason && (
                      <p className="mt-2 text-xs text-[#71829b]">
                        {item.rejectionReason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <ApplicationActions
                      id={item.id}
                      status={item.status}
                      reload={state.reload}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {!state.loading && !state.error && !items.length && (
        <Empty title="Заявки не найдены" />
      )}
    </div>
  );
}
