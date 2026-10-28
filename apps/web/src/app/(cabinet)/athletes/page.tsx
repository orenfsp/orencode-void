"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  PageTitle,
  Select,
  TableWrap,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
import { toast } from "sonner";
type Athlete = {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  municipality: string;
  birthDate: string;
  status: string;
  organization: { name: string } | null;
};
export default function AthletesPage() {
  const user = useUser();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const state = useApi<{ items: Athlete[]; total: number }>(
    `/athletes?q=${encodeURIComponent(q)}&page=${page}&pageSize=20`,
  );
  const organizations =
    useApi<Array<{ id: string; name: string }>>("/organizations");
  const disciplines =
    useApi<Array<{ id: string; name: string }>>("/disciplines");
  const columns = useMemo<ColumnDef<Athlete>[]>(
    () => [
      {
        id: "name",
        accessorFn: fio,
        header: "ФИО",
        cell: ({ row }) => (
          <Link
            className="font-medium text-[#1680ff]"
            href={`/athletes/${row.original.id}`}
          >
            {fio(row.original)}
          </Link>
        ),
      },
      { accessorKey: "municipality", header: "Муниципалитет" },
      {
        id: "organization",
        accessorFn: (a) => a.organization?.name ?? "—",
        header: "Организация",
      },
      {
        accessorKey: "birthDate",
        header: "Дата рождения",
        cell: ({ row }) => formatDate(row.original.birthDate),
      },
      {
        accessorKey: "status",
        header: "Статус",
        cell: ({ row }) => (
          <Badge tone={row.original.status === "ACTIVE" ? "ok" : "warn"}>
            {statusLabel[row.original.status]}
          </Badge>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: state.data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-3">
        <PageTitle
          title="Реестр спортсменов"
          subtitle="Поиск по ФИО; сортировка заголовком в пределах страницы"
        />
        {user?.activeRole === "FEDERATION" && (
          <Button className="h-fit" onClick={() => setOpen(true)}>
            Добавить спортсмена
          </Button>
        )}
      </div>
      <Input
        aria-label="Поиск по ФИО"
        placeholder="Поиск по ФИО…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        className="mb-5 max-w-xl"
      />
      <DataState {...state} retry={state.reload} />
      <TableWrap>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f4f8fd] text-[#71829b]">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((h) => (
                  <th key={h.id} className="px-4 py-3">
                    <button onClick={h.column.getToggleSortingHandler()}>
                      {flexRender(h.column.columnDef.header, h.getContext())}{" "}
                      {h.column.getIsSorted() === "asc"
                        ? "↑"
                        : h.column.getIsSorted() === "desc"
                          ? "↓"
                          : "↕"}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-[#e1eaf5]">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      {!state.loading && !state.error && !state.data?.items.length && (
        <Empty title="Спортсмены не найдены" />
      )}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-[#71829b]">Всего: {state.data?.total ?? 0}</span>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <span>{page}</span>
          <Button
            variant="outline"
            disabled={page * 20 >= (state.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Далее
          </Button>
        </div>
      </div>
      {open && (
        <Modal title="Новый спортсмен" onClose={() => setOpen(false)} wide>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              setBusy(true);
              try {
                const body = {
                  lastName: values.get("lastName"),
                  firstName: values.get("firstName"),
                  middleName: String(values.get("middleName") || ""),
                  birthDate: values.get("birthDate"),
                  municipality: values.get("municipality"),
                  startedYear: Number(values.get("startedYear")),
                  ...(values.get("organizationId")
                    ? { organizationId: values.get("organizationId") }
                    : {}),
                  disciplineIds: values.getAll("disciplineIds"),
                  guardianName: String(values.get("guardianName") || ""),
                };
                await api("/athletes", {
                  method: "POST",
                  body: JSON.stringify(body),
                });
                setOpen(false);
                state.reload();
                toast.success("Спортсмен добавлен в реестр");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Ошибка");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Фамилия">
              <Input name="lastName" required />
            </Field>
            <Field label="Имя">
              <Input name="firstName" required />
            </Field>
            <Field label="Отчество">
              <Input name="middleName" />
            </Field>
            <Field label="Дата рождения">
              <Input
                name="birthDate"
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Муниципалитет">
              <Input name="municipality" required />
            </Field>
            <Field label="Год начала занятий">
              <Input
                name="startedYear"
                type="number"
                min={1950}
                max={new Date().getFullYear()}
                defaultValue={new Date().getFullYear()}
                required
              />
            </Field>
            <Field label="Организация">
              <Select name="organizationId">
                <option value="">Без организации</option>
                {organizations.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Законный представитель (для несовершеннолетних)">
              <Input name="guardianName" />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm text-[#71829b]">
                Дисциплины
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {disciplines.data?.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="disciplineIds" value={d.id} />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={busy}>
              Создать запись
            </Button>
          </form>
        </Modal>
      )}
      <Card className="mt-5 text-xs text-[#71829b]">
        Все персональные записи в демонстрационной базе фиктивные.
      </Card>
    </div>
  );
}
