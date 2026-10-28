"use client";

import {
  Badge,
  Button,
  Empty,
  Field,
  Input,
  Modal,
  PageTitle,
  Select,
  TableWrap,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Organization = {
  id: string;
  name: string;
  type: string;
  municipality: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: string;
};

const typeLabel: Record<string, string> = {
  SPORTS_SCHOOL: "Спортивная школа",
  CLUB: "Клуб",
  UNIVERSITY: "Вуз",
  FEDERATION: "Федерация",
  OTHER: "Другое",
};

export default function OrganizationsPage() {
  const [items, setItems] = useState<Organization[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    setItems(await api<Organization[]>("/organizations"));
  }
  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.name, item.municipality, item.address, typeLabel[item.type]]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [items, q]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title="Организации"
          subtitle="Спортивные школы, клубы и образовательные организации региона."
        />
        <Button onClick={() => setOpen(true)}>Добавить организацию</Button>
      </div>
      <Input
        placeholder="Поиск по названию или муниципалитету"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      <div className="mt-4">
        {filtered.length === 0 ? (
          <Empty title="Организации не найдены" />
        ) : (
          <TableWrap>
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f4f8fd] text-[#71829b]">
                <tr>
                  <th className="px-4 py-3">Название</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Муниципалитет</th>
                  <th className="px-4 py-3">Контакты</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-t border-[#e1eaf5]">
                    <td className="px-4 py-3">
                      {item.name}
                      {item.address ? (
                        <div className="text-xs text-[#71829b]">
                          {item.address}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {typeLabel[item.type] ?? item.type}
                    </td>
                    <td className="px-4 py-3">{item.municipality}</td>
                    <td className="px-4 py-3 text-[#71829b]">
                      {[item.phone, item.email].filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={item.status === "ACTIVE" ? "ok" : "warn"}>
                        {item.status === "ACTIVE" ? "Активна" : "Неактивна"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await api(`/organizations/${item.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                status:
                                  item.status === "ACTIVE"
                                    ? "INACTIVE"
                                    : "ACTIVE",
                              }),
                            });
                            await load();
                          } catch (error) {
                            toast.error(
                              error instanceof Error ? error.message : "Ошибка",
                            );
                          }
                        }}
                      >
                        {item.status === "ACTIVE" ? "Отключить" : "Включить"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>

      {open ? (
        <Modal title="Новая организация" onClose={() => setOpen(false)}>
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                await api("/organizations", {
                  method: "POST",
                  body: JSON.stringify({
                    name: form.get("name"),
                    type: form.get("type"),
                    municipality: form.get("municipality"),
                    address: form.get("address") || undefined,
                    phone: form.get("phone") || undefined,
                    email: form.get("email") || undefined,
                  }),
                });
                toast.success("Организация добавлена");
                setOpen(false);
                await load();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Ошибка");
              }
            }}
          >
            <Field label="Название">
              <Input name="name" required />
            </Field>
            <Field label="Тип">
              <Select name="type" defaultValue="SPORTS_SCHOOL">
                {Object.entries(typeLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Муниципалитет">
              <Input name="municipality" required />
            </Field>
            <Field label="Адрес">
              <Input name="address" />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Телефон">
                <Input name="phone" />
              </Field>
              <Field label="Email">
                <Input name="email" type="email" />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
