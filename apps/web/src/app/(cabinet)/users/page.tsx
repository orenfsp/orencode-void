"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Search, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { fio, formatDate } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/nav";

type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  roles: string[];
  isActive: boolean;
  athleteId?: string;
  updatedAt: string;
};
type Athlete = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
  birthDate: string;
};

export default function UsersPage() {
  const me = useUser();
  const allowed = me?.activeRole === "FEDERATION";
  const state = useApi<Account[]>(allowed ? "/users" : null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  if (!allowed)
    return <Empty title="Управление аккаунтами доступно федерации" />;
  const items = (state.data ?? []).filter(
    (u) =>
      `${fio(u)} ${u.email}`.toLowerCase().includes(query.toLowerCase()) &&
      (!role || u.roles.includes(role)) &&
      (!status || u.isActive === (status === "active")),
  );
  const pages = Math.max(1, Math.ceil(items.length / 12));
  const currentPage = Math.min(page, pages);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <PageTitle
          title="Учётные записи"
          subtitle="Доступ к платформе и роли сотрудников и спортсменов"
        />
        <Button onClick={() => setEditing("new")}>
          <UserPlus size={17} />
          Создать аккаунт
        </Button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-3 text-[#71829b]" />
          <Input
            aria-label="Поиск по имени или email"
            className="pl-10"
            placeholder="Имя или email"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          aria-label="Фильтр по роли"
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все роли</option>
          {Object.entries(ROLE_LABEL).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Фильтр по статусу"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </Select>
      </div>
      <DataState {...state} retry={state.reload} />
      {!state.loading && !state.error && (
        <>
          <p className="mb-3 text-sm text-[#71829b]">Найдено: {items.length}</p>
          {!items.length ? (
            <Empty title="Аккаунты не найдены" />
          ) : (
            <div className="grid gap-3">
              {items
                .slice((currentPage - 1) * 12, currentPage * 12)
                .map((u) => (
                  <Card
                    key={u.id}
                    className="flex flex-wrap items-center gap-4"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#1680ff]">
                      <ShieldCheck size={23} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {fio(u)}{" "}
                        {u.id === me.id && (
                          <span className="text-xs font-normal text-[#71829b]">
                            (вы)
                          </span>
                        )}
                      </p>
                      <p className="break-all text-sm text-[#71829b]">
                        {u.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <Badge key={r}>{ROLE_LABEL[r]}</Badge>
                        ))}
                      </div>
                    </div>
                    <Badge tone={u.isActive ? "ok" : "bad"}>
                      {u.isActive ? "Активен" : "Заблокирован"}
                    </Badge>
                    <Button
                      variant="outline"
                      aria-label={`Редактировать ${u.email}`}
                      onClick={() => setEditing(u)}
                    >
                      <Pencil size={15} />
                      <span className="hidden sm:inline">Изменить</span>
                    </Button>
                  </Card>
                ))}
            </div>
          )}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Назад
              </Button>
              <span className="text-sm">
                {currentPage} / {pages}
              </span>
              <Button
                variant="ghost"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Далее
              </Button>
            </div>
          )}
        </>
      )}
      {editing && (
        <AccountEditor
          initial={editing === "new" ? undefined : editing}
          selfId={me.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            state.reload();
          }}
        />
      )}
    </div>
  );
}

function AccountEditor({
  initial,
  selfId,
  onClose,
  onSaved,
}: {
  initial?: Account;
  selfId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initial?.roles ?? ["ATHLETE"]);
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [search, setSearch] = useState("");
  const [athleteId, setAthleteId] = useState(initial?.athleteId ?? "");
  const needAthlete = roles.includes("ATHLETE") && !initial?.athleteId;
  const athletes = useApi<Athlete[]>(
    needAthlete
      ? `/users/available-athletes?q=${encodeURIComponent(search)}`
      : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const self = initial?.id === selfId;
  return (
    <Modal
      wide
      title={initial ? "Редактирование аккаунта" : "Новый аккаунт"}
      onClose={() => !busy && onClose()}
    >
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!roles.length) {
            setError("Назначьте хотя бы одну роль");
            return;
          }
          const form = new FormData(e.currentTarget);
          const password = String(form.get("password") ?? "");
          if (password && new TextEncoder().encode(password).length > 72) {
            setError("Пароль должен занимать не более 72 байт UTF-8");
            return;
          }
          const body = {
            firstName: form.get("firstName"),
            lastName: form.get("lastName"),
            middleName: form.get("middleName"),
            email: form.get("email"),
            roles,
            isActive: active,
            ...(password ? { password } : {}),
            ...(needAthlete ? { athleteId } : {}),
            ...(initial ? { updatedAt: initial.updatedAt } : {}),
          };
          setBusy(true);
          try {
            const result = await api<{ sessionsRevoked: boolean }>(
              initial ? `/users/${initial.id}` : "/users",
              { method: initial ? "PUT" : "POST", body: JSON.stringify(body) },
            );
            toast.success("Аккаунт сохранён");
            if (self && result.sessionsRevoked) {
              router.replace("/login");
              return;
            }
            onSaved();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Не удалось сохранить аккаунт",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Фамилия">
            <Input
              name="lastName"
              defaultValue={initial?.lastName}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Имя">
            <Input
              name="firstName"
              defaultValue={initial?.firstName}
              maxLength={100}
              required
            />
          </Field>
          <Field label="Отчество">
            <Input
              name="middleName"
              defaultValue={initial?.middleName ?? ""}
              maxLength={100}
            />
          </Field>
          <Field label="Email для входа">
            <Input
              name="email"
              type="email"
              autoComplete="off"
              defaultValue={initial?.email}
              required
            />
          </Field>
        </div>
        <Field
          label={
            initial
              ? "Новый пароль (оставьте пустым, чтобы сохранить текущий)"
              : "Пароль для входа — от 10 символов"
          }
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={72}
            required={!initial}
          />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Роли аккаунта</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(ROLE_LABEL).map(([code, label]) => (
              <label
                key={code}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${roles.includes(code) ? "border-blue-200 bg-blue-50" : "border-[#e1eaf5]"}`}
              >
                <input
                  type="checkbox"
                  className="accent-[#1680ff]"
                  checked={roles.includes(code)}
                  disabled={self && code === "FEDERATION"}
                  onChange={(e) =>
                    setRoles(
                      e.target.checked
                        ? [...roles, code]
                        : roles.filter((r) => r !== code),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        {needAthlete && (
          <div className="space-y-3 rounded-xl bg-[#f4f8fd] p-4">
            <p className="text-sm">
              Выберите профиль спортсмена без аккаунта. Новый профиль можно
              создать в{" "}
              <Link href="/athletes" className="text-[#1680ff]">
                реестре спортсменов
              </Link>
              .
            </p>
            <Input
              aria-label="Поиск свободного профиля спортсмена"
              placeholder="Поиск по имени или фамилии"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setAthleteId("");
              }}
            />
            <DataState {...athletes} retry={athletes.reload} />
            <Field label="Профиль спортсмена">
              <Select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                required
              >
                <option value="">Выберите профиль</option>
                {athletes.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {fio(a)} · {formatDate(a.birthDate)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
        {initial?.athleteId && (
          <p className="text-sm text-[#71829b]">
            Аккаунт связан с{" "}
            <Link
              className="text-[#1680ff]"
              href={`/athletes/${initial.athleteId}`}
            >
              профилем спортсмена
            </Link>
            . Снятие роли сохраняет спортивную историю.
          </p>
        )}
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-[#1680ff]"
            checked={active}
            disabled={self}
            onChange={(e) => setActive(e.target.checked)}
          />
          Аккаунт активен — разрешить вход
        </label>
        {initial && (
          <p className="text-xs leading-relaxed text-[#71829b]">
            Изменение email, пароля, ролей или статуса завершит открытые сессии
            этого пользователя.{" "}
            {self && "Для вашего аккаунта потребуется повторный вход."}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={busy || (needAthlete && (!athleteId || athletes.loading))}
          >
            {busy ? "Сохранение…" : "Сохранить"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  );
}
