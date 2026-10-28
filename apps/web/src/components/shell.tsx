"use client";
import { api, ApiError, type AuthUser } from "@/lib/api";
import { NAV, ROLE_LABEL } from "@/lib/nav";
import { fio } from "@/lib/utils";
import { Bell, CodeXml, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui";
import { DataState } from "./data-state";
const UserContext = createContext<AuthUser | null>(null);
export function useUser() {
  return useContext(UserContext);
}
export function Shell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  async function load() {
    setError(null);
    try {
      setUser(await api<AuthUser>("/auth/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      else
        setError(
          e instanceof Error ? e.message : "Не удалось загрузить кабинет",
        );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  if (!user)
    return (
      <div className="mx-auto max-w-3xl p-10">
        <DataState loading={!error} error={error} retry={load} />
      </div>
    );
  const items = NAV[user.activeRole] ?? [];
  async function switchRole(role: string) {
    setBusy(true);
    try {
      const next = await api<AuthUser>("/auth/switch-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      setUser(next);
      router.replace(NAV[role]?.[0]?.href ?? "/dashboard");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Не удалось переключить роль",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen bg-[#f7faff] lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
        {open && (
          <button
            className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden"
            aria-label="Закрыть меню"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[248px] overflow-y-auto border-r border-[#e1eaf5] bg-white p-4 lg:sticky lg:top-0 lg:h-screen ${open ? "block" : "hidden"} lg:block`}
        >
          <div className="mb-6 flex items-center gap-2 px-2 py-3">
            <CodeXml size={30} className="shrink-0 text-[#1680ff]" />
            <Link href="/" className="text-xs font-semibold leading-relaxed">
              Спортивное программирование
              <br />
              <span className="font-normal text-[#71829b]">
                Оренбургская область
              </span>
            </Link>
            <button
              className="lg:hidden"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[#96a4b7]">
            Личный кабинет
          </p>
          <nav className="space-y-1" aria-label="Кабинет">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition ${active ? "bg-[#eaf3ff] font-medium text-[#1680ff]" : "text-[#71829b] hover:bg-[#f5f9fe]"}`}
                >
                  <Icon size={17} strokeWidth={1.7} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="mt-8 px-3 text-[10px] leading-relaxed text-[#96a4b7]">
            Демонстрационная платформа
            <br />
            Все персональные данные фиктивные
          </p>
        </aside>
        <div className="min-w-0">
          <header className="flex min-h-[72px] items-center gap-3 border-b border-[#e1eaf5] bg-white px-4 md:px-8">
            <button
              className="lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Открыть меню"
              aria-expanded={open}
            >
              <Menu />
            </button>
            <span className="hidden text-xs text-[#71829b] xl:inline">
              ФСП / {items.find((i) => i.href === pathname)?.label ?? "Кабинет"}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <Link
                href="/notifications"
                aria-label="Уведомления"
                className="text-[#71829b]"
              >
                <Bell size={18} />
              </Link>
              <select
                aria-label="Активная роль"
                disabled={busy}
                className="max-w-36 rounded-lg border border-[#e1eaf5] bg-[#f7faff] px-2 py-2 text-xs"
                value={user.activeRole}
                onChange={(e) => void switchRole(e.target.value)}
              >
                {user.roles.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role] ?? role}
                  </option>
                ))}
              </select>
              <span className="hidden text-xs font-medium sm:block">
                {fio(user)}
              </span>
              <Button
                variant="ghost"
                aria-label="Выйти"
                onClick={async () => {
                  try {
                    await api("/auth/logout", { method: "POST" });
                    router.replace("/login");
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Ошибка выхода",
                    );
                  }
                }}
              >
                <LogOut size={16} />
              </Button>
            </div>
          </header>
          <main
            key={`${user.activeRole}:${pathname}`}
            className="mx-auto max-w-[1500px] p-4 md:p-8"
          >
            {children}
          </main>
        </div>
      </div>
    </UserContext.Provider>
  );
}
