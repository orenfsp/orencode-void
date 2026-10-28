"use client";

import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageTitle,
  Select,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Discipline = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};
type AgeGroup = {
  id: string;
  code: string;
  name: string;
  minAge: number | null;
  maxAge: number | null;
};
type CompetitionType = { id: string; code: string; name: string };

export default function CatalogsPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [ageGroups, setAgeGroups] = useState<AgeGroup[]>([]);
  const [types, setTypes] = useState<CompetitionType[]>([]);
  const [dialog, setDialog] = useState<null | "discipline" | "age" | "type">(
    null,
  );

  async function load() {
    const [d, a, t] = await Promise.all([
      api<Discipline[]>("/disciplines"),
      api<AgeGroup[]>("/age-groups"),
      api<CompetitionType[]>("/competition-types"),
    ]);
    setDisciplines(d);
    setAgeGroups(a);
    setTypes(t);
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  return (
    <div>
      <PageTitle
        title="Дисциплины и справочники"
        subtitle="Справочники расширяемые: типы, возрастные группы и дисциплины не зашиты в бизнес-логику."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Дисциплины</h2>
            <Button variant="outline" onClick={() => setDialog("discipline")}>
              Добавить
            </Button>
          </div>
          <ul className="space-y-3 text-sm">
            {disciplines.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-[#71829b]">{item.code}</p>
                {item.description ? (
                  <p className="mt-1 text-xs text-[#71829b]">
                    {item.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Возрастные группы</h2>
            <Button variant="outline" onClick={() => setDialog("age")}>
              Добавить
            </Button>
          </div>
          <ul className="space-y-3 text-sm">
            {ageGroups.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-[#71829b]">
                  {item.code} · {item.minAge ?? "—"}–
                  {item.maxAge ?? "без ограничения"}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Типы соревнований</h2>
            <Button variant="outline" onClick={() => setDialog("type")}>
              Добавить
            </Button>
          </div>
          <ul className="space-y-3 text-sm">
            {types.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-[#71829b]">{item.code}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {dialog ? (
        <Modal
          title={
            dialog === "discipline"
              ? "Новая дисциплина"
              : dialog === "age"
                ? "Новая возрастная группа"
                : "Новый тип соревнования"
          }
          onClose={() => setDialog(null)}
        >
          <form
            className="grid gap-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                if (dialog === "discipline") {
                  await api("/disciplines", {
                    method: "POST",
                    body: JSON.stringify({
                      code: form.get("code"),
                      name: form.get("name"),
                      description: form.get("description") || undefined,
                    }),
                  });
                } else if (dialog === "age") {
                  await api("/age-groups", {
                    method: "POST",
                    body: JSON.stringify({
                      code: form.get("code"),
                      name: form.get("name"),
                      minAge: form.get("minAge")
                        ? Number(form.get("minAge"))
                        : undefined,
                      maxAge: form.get("maxAge")
                        ? Number(form.get("maxAge"))
                        : undefined,
                    }),
                  });
                } else {
                  await api("/competition-types", {
                    method: "POST",
                    body: JSON.stringify({
                      code: form.get("code"),
                      name: form.get("name"),
                    }),
                  });
                }
                toast.success("Справочник обновлён");
                setDialog(null);
                await load();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Ошибка");
              }
            }}
          >
            <Field label="Код">
              <Input name="code" required placeholder="Например, NEW_CODE" />
            </Field>
            <Field label="Название">
              <Input name="name" required />
            </Field>
            {dialog === "discipline" ? (
              <Field label="Описание">
                <Input name="description" />
              </Field>
            ) : null}
            {dialog === "age" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Минимальный возраст">
                  <Input name="minAge" type="number" min={1} max={100} />
                </Field>
                <Field label="Максимальный возраст">
                  <Input name="maxAge" type="number" min={1} max={100} />
                </Field>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit">Сохранить</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialog(null)}
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
