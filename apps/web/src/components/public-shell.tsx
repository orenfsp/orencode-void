"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CodeXml, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
export function Brand() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-3"
      aria-label="На главную"
    >
      <CodeXml size={36} strokeWidth={1.6} className="text-[#369aff]" />
      <span className="text-[11px] font-semibold leading-[1.45] sm:text-xs">
        Спортивное программирование
        <br />
        Оренбургской области
      </span>
    </Link>
  );
}
export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = [
    ["/", "Главная"],
    ["/public/calendar", "Соревнования"],
    ["/public/ratings", "Рейтинг"],
    ["/public/disciplines", "Дисциплины"],
  ];
  return (
    <header className="border-b border-[#edf2f8] bg-white">
      <div className="public-container flex min-h-[72px] items-center justify-between gap-6">
        <Brand />
        <nav
          aria-label="Основная навигация"
          className="hidden items-center gap-9 md:flex"
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`border-b-2 py-6 text-xs transition ${pathname === href ? "border-[#1680ff] text-[#1680ff]" : "border-transparent text-[#697a92] hover:text-[#1680ff]"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="hidden items-center gap-2 rounded-lg border border-[#d8eaff] px-4 py-2 text-xs font-medium text-[#1680ff] hover:bg-[#f3f8ff] sm:flex"
        >
          <UserRound size={15} />
          Войти
        </Link>
        <button
          className="p-2 md:hidden"
          aria-label="Открыть меню"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <nav className="public-container flex flex-wrap gap-5 pb-5 md:hidden">
          {[...links, ["/login", "Войти"]].map(([href, label]) => (
            <Link
              className="text-sm text-[#1680ff]"
              key={href}
              href={href}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
export function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-[#edf2f8] py-6">
      <div className="public-container flex flex-wrap items-center justify-between gap-3 text-xs text-[#8492a8]">
        <span>Спортивное программирование Оренбургской области</span>
        <span>Демонстрационная платформа · Все данные фиктивные</span>
      </div>
    </footer>
  );
}
