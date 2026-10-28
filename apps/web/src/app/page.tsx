"use client";
import Link from "next/link";
import { ArrowRight, CalendarDays, TrendingUp } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/public-shell";
import { HeroArt } from "@/components/hero-art";
import {
  CompetitionRow,
  type PublicCompetition,
} from "@/components/competition-row";
import { DisciplineIcon, DisciplineBadge } from "@/components/discipline-icon";
import { DataState } from "@/components/data-state";
import { Empty } from "@/components/ui";
import { useApi } from "@/hooks/use-api";
type Discipline = { id: string; name: string; code: string };
type Rating = {
  id: string;
  participant: string;
  totalPoints: string;
  discipline: Discipline;
};
export default function HomePage() {
  const competitions = useApi<{ items: PublicCompetition[] }>(
    "/competitions/public?pageSize=100",
  );
  const disciplines = useApi<Discipline[]>("/disciplines");
  const ratings = useApi<Rating[]>(
    `/public/ratings?season=${new Date().getFullYear()}`,
  );
  const upcoming =
    competitions.data?.items
      .filter((item) => new Date(item.endsAt) >= new Date())
      .slice(0, 3) ?? [];
  return (
    <>
      <PublicHeader />
      <main className="public-container">
        <section className="grid items-center gap-4 pb-9 pt-10 md:grid-cols-[1.45fr_1fr] md:pb-10 md:pt-12">
          <div>
            <h1 className="max-w-[680px] text-[32px] font-bold leading-[1.13] tracking-[-.035em] sm:text-[40px]">
              Спортивное программирование
              <br className="hidden xl:block" /> Оренбургской области
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#75869f]">
              Соревнования, результаты и развитие спортсменов региона
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-7">
              <Link
                href="/public/calendar"
                className="inline-flex items-center gap-2 rounded-lg bg-[#1680ff] px-5 py-3 text-xs font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-[#076ce4]"
              >
                <CalendarDays size={17} />
                Посмотреть соревнования
              </Link>
              <Link
                href="/public/about"
                className="inline-flex items-center gap-3 text-xs text-[#74859d]"
              >
                О федерации <ArrowRight size={15} className="text-[#1680ff]" />
              </Link>
            </div>
          </div>
          <HeroArt />
        </section>
        <section>
          <div className="section-heading">
            <h2>Ближайшие соревнования</h2>
            <Link className="text-link" href="/public/calendar">
              Все соревнования <ArrowRight size={14} />
            </Link>
          </div>
          <DataState {...competitions} retry={competitions.reload} />
          <div className="space-y-2.5">
            {upcoming.map((item) => (
              <CompetitionRow key={item.id} item={item} />
            ))}
          </div>
          {!competitions.loading && !competitions.error && !upcoming.length && (
            <Empty title="Ближайшие соревнования пока не опубликованы" />
          )}
        </section>
        <section className="mt-8">
          <div className="section-heading">
            <h2>Дисциплины</h2>
            <Link className="text-link" href="/public/disciplines">
              Все дисциплины <ArrowRight size={14} />
            </Link>
          </div>
          <DataState {...disciplines} retry={disciplines.reload} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[...(disciplines.data ?? [])]
              .sort(
                (a, b) =>
                  [
                    "ALGORITHMIC",
                    "PRODUCT",
                    "INFOSEC",
                    "AI",
                    "ROBOTICS",
                    "UAV",
                  ].indexOf(a.code) -
                  [
                    "ALGORITHMIC",
                    "PRODUCT",
                    "INFOSEC",
                    "AI",
                    "ROBOTICS",
                    "UAV",
                  ].indexOf(b.code),
              )
              .map((item) => (
                <Link
                  key={item.id}
                  href={`/public/disciplines#${item.code}`}
                  className="discipline-tile"
                >
                  <DisciplineIcon code={item.code} />
                  <span className="max-w-36 text-xs font-medium leading-snug">
                    {item.name}
                  </span>
                </Link>
              ))}
          </div>
        </section>
        <section className="mt-7 grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="rounded-lg border border-[#e1edf9] px-5 py-4">
            <div className="section-heading">
              <h2>Рейтинг спортсменов</h2>
              <Link href="/public/ratings" className="text-link">
                Полный рейтинг <ArrowRight size={14} />
              </Link>
            </div>
            <DataState {...ratings} retry={ratings.reload} />
            {ratings.data?.slice(0, 3).map((item, index) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b border-[#eff4fa] py-3 last:border-0"
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${["bg-amber-100 text-amber-600", "bg-slate-100 text-slate-500", "bg-orange-100 text-orange-600"][index]}`}
                >
                  {index + 1}
                </span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e9f3ff] text-xs font-semibold text-[#6a9dce]">
                  {item.participant.slice(-2)}
                </span>
                <span className="flex-1 text-xs font-medium">
                  {item.participant}
                </span>
                <span className="hidden sm:block">
                  <DisciplineBadge {...item.discipline} />
                </span>
                <span className="ml-auto text-right text-xs font-semibold">
                  {Number(item.totalPoints).toLocaleString("ru-RU")}
                  <span className="block text-[10px] font-normal text-[#8391a6]">
                    баллов
                  </span>
                </span>
              </div>
            ))}
            {!ratings.loading && !ratings.error && !ratings.data?.length && (
              <p className="py-4 text-sm text-[#71829b]">
                Рейтинг появится после публикации результатов.
              </p>
            )}
            <p className="mt-2 text-[10px] text-[#8492a8]">
              Демонстрационные данные · Имена доступны в личном кабинете
            </p>
          </div>
          <Link
            href="/public/about"
            className="relative overflow-hidden rounded-lg border border-[#e4effb] bg-[#f3f8fe] p-7"
          >
            <div className="flex items-start gap-4">
              <TrendingUp
                className="shrink-0 text-[#54a6fb]"
                size={29}
                strokeWidth={1.5}
              />
              <div>
                <h2 className="text-sm font-semibold leading-snug">
                  Развиваем
                  <br />
                  спортивное программирование
                  <br />в регионе
                </h2>
                <p className="mt-4 max-w-[220px] text-xs leading-relaxed text-[#7d8da4]">
                  Поддержка талантливых спортсменов, проведение соревнований и
                  формирование сборной Оренбургской области.
                </p>
              </div>
            </div>
            <div className="dot-pattern absolute bottom-5 right-5 h-10 w-12" />
          </Link>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
