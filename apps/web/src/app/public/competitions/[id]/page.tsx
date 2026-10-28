"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { PageTitle, Card, Empty } from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useApi } from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";
type Competition = {
  id: string;
  name: string;
  description: string;
  venue: string;
  format: string;
  startsAt: string;
  endsAt: string;
  applicationsOpenAt: string;
  applicationsCloseAt: string;
  regulationUrl: string | null;
  discipline: { name: string };
  ageGroup: { name: string };
  protocol: { number: string } | null;
  results: Array<{
    id: string;
    participant: string;
    place: number;
    score: string;
  }>;
};
export default function PublicCompetitionPage() {
  const { id } = useParams<{ id: string }>();
  const state = useApi<Competition>(`/competitions/public/${id}`);
  const item = state.data;
  const accepting =
    item &&
    new Date(item.applicationsOpenAt) <= new Date() &&
    new Date(item.applicationsCloseAt) >= new Date();
  return (
    <main className="public-container py-10">
      <Link className="text-link mb-6" href="/public/calendar">
        ← Все соревнования
      </Link>
      <DataState {...state} retry={state.reload} />
      {item && (
        <>
          <PageTitle
            title={item.name}
            subtitle={`${item.discipline.name} · ${item.ageGroup.name}`}
          />
          <div className="grid gap-5 md:grid-cols-[2fr_1fr]">
            <Card>
              <div className="flex items-center gap-3 text-sm">
                <CalendarDays size={18} className="text-[#1680ff]" />
                {formatDate(item.startsAt)} — {formatDate(item.endsAt)}
              </div>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <MapPin size={18} className="text-[#1680ff]" />
                {item.venue}
              </div>
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-[#71829b]">
                {item.description || "Описание соревнования пока не добавлено."}
              </p>
              {item.regulationUrl &&
                /^https?:\/\//.test(item.regulationUrl) && (
                  <a
                    className="text-link mt-5"
                    href={item.regulationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Положение о соревновании ↗
                  </a>
                )}
            </Card>
            <Card>
              <h2 className="font-semibold">Участие в соревновании</h2>
              <p className="my-4 text-sm text-[#71829b]">
                Приём заявок: {formatDate(item.applicationsOpenAt)} —{" "}
                {formatDate(item.applicationsCloseAt)}
              </p>
              <p
                className={`mb-5 text-sm font-medium ${accepting ? "text-emerald-700" : "text-[#71829b]"}`}
              >
                {accepting ? "Приём заявок открыт" : "Приём заявок закрыт"}
              </p>
              <Link
                href={`/login?next=/competitions/${id}`}
                className="inline-flex rounded-lg bg-[#1680ff] px-4 py-3 text-sm text-white"
              >
                Войти в личный кабинет
              </Link>
            </Card>
          </div>
          <section className="mt-8">
            <PageTitle
              title="Опубликованные результаты"
              subtitle={item.protocol?.number}
            />
            {item.results.length ? (
              <Card>
                <div className="space-y-4">
                  {item.results.map((r) => (
                    <div
                      className="flex justify-between gap-4 text-sm"
                      key={r.id}
                    >
                      <span>
                        {r.place}. {r.participant}
                      </span>
                      <strong>{r.score} баллов</strong>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Empty title="Результаты ещё не опубликованы" />
            )}
          </section>
        </>
      )}
    </main>
  );
}
