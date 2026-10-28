"use client";
import { useState } from "react";
import { Button, Card, Field, Input, PageTitle } from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio, formatDate } from "@/lib/utils";
import { toast } from "sonner";
type Athlete = {
  id: string;
  birthDate: string;
  municipality: string;
  startedYear: number;
  currentRank: { rankType: string } | null;
  disciplines: Array<{ discipline: { name: string } }>;
  consents: Array<{
    id: string;
    version: string;
    grantedAt: string;
    representativeName: string | null;
  }>;
};
export default function MePage() {
  const user = useUser();
  const state = useApi<Athlete>("/athletes/me");
  const athlete = state.data;
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <PageTitle title="Мой профиль" subtitle={user?.email} />
      <DataState {...state} retry={state.reload} />
      {user && (
        <Card>
          <h2 className="text-lg font-semibold">{fio(user)}</h2>
          {athlete && (
            <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <p>
                <span className="text-[#71829b]">Муниципалитет</span>
                <br />
                {athlete.municipality}
              </p>
              <p>
                <span className="text-[#71829b]">Дата рождения</span>
                <br />
                {formatDate(athlete.birthDate)}
              </p>
              <p>
                <span className="text-[#71829b]">Начало занятий</span>
                <br />
                {athlete.startedYear}
              </p>
              <p>
                <span className="text-[#71829b]">Действующий разряд</span>
                <br />
                {athlete.currentRank?.rankType ?? "не присвоен"}
              </p>
              <p className="sm:col-span-2">
                <span className="text-[#71829b]">Дисциплины</span>
                <br />
                {athlete.disciplines.map((d) => d.discipline.name).join(", ")}
              </p>
            </div>
          )}
        </Card>
      )}
      {athlete && (
        <Card className="mt-5">
          <h2 className="mb-4 font-semibold">Согласия на обработку данных</h2>
          <div className="mb-5 space-y-2 text-sm text-[#71829b]">
            {athlete.consents.map((c) => (
              <p key={c.id}>
                Версия {c.version} · {formatDate(c.grantedAt)}
                {c.representativeName &&
                  ` · представитель: ${c.representativeName}`}
              </p>
            ))}
            {!athlete.consents.length && (
              <p>Согласия ещё не зарегистрированы.</p>
            )}
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-[#1680ff]">
              Зарегистрировать согласие
            </summary>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                setBusy(true);
                try {
                  await api(`/athletes/${athlete.id}/consents`, {
                    method: "POST",
                    body: JSON.stringify({
                      version: values.get("version"),
                      representativeName: String(
                        values.get("representativeName") || "",
                      ),
                      representativeRelation: String(
                        values.get("representativeRelation") || "",
                      ),
                    }),
                  });
                  toast.success("Факт согласия зарегистрирован");
                  state.reload();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Ошибка");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="text-xs leading-relaxed text-[#71829b] sm:col-span-2">
                Регистрация факта уже полученного согласия. Укажите версию
                текста, предоставленного федерацией. Для несовершеннолетнего
                обязательны сведения о законном представителе.
              </p>
              <Field label="Версия текста согласия">
                <Input name="version" required />
              </Field>
              <Field label="ФИО законного представителя">
                <Input name="representativeName" />
              </Field>
              <Field label="Степень родства / основание представительства">
                <Input name="representativeRelation" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" required />
                Подтверждаю факт получения согласия
              </label>
              <Button type="submit" disabled={busy}>
                Зарегистрировать
              </Button>
            </form>
          </details>
        </Card>
      )}
    </div>
  );
}
