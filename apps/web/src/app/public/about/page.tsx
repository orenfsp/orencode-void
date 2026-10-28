import Link from "next/link";
import { CodeXml, Trophy, Users, TrendingUp } from "lucide-react";
import { PageTitle } from "@/components/ui";
export default function AboutPage() {
  return (
    <main className="public-container py-12">
      <PageTitle
        title="Развиваем спортивное программирование вместе"
        subtitle="Единая платформа регионального отделения Федерации спортивного программирования"
      />
      <p className="max-w-3xl text-base leading-relaxed text-[#71829b]">
        Платформа объединяет спортсменов, тренеров, судей и организации
        Оренбургской области. Здесь можно найти соревнование, подать заявку,
        следить за результатами и участвовать в отборе в сборную региона.
      </p>
      <div className="my-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            CodeXml,
            "Шесть дисциплин",
            "От алгоритмов и искусственного интеллекта до робототехники.",
          ],
          [
            Trophy,
            "Соревнования",
            "Единый календарь, заявки и опубликованные протоколы.",
          ],
          [Users, "Сообщество", "Подтверждённые связи спортсменов и тренеров."],
          [
            TrendingUp,
            "Развитие",
            "Прозрачный рейтинг и аналитика на основе результатов.",
          ],
        ].map(([Icon, title, body]) => {
          const Symbol = Icon as typeof CodeXml;
          return (
            <div
              className="rounded-xl border border-[#e2ecf7] p-6"
              key={String(title)}
            >
              <Symbol className="text-[#1680ff]" />
              <h2 className="my-3 font-semibold">{String(title)}</h2>
              <p className="text-sm leading-relaxed text-[#71829b]">
                {String(body)}
              </p>
            </div>
          );
        })}
      </div>
      <Link className="text-link" href="/public/calendar">
        Открыть календарь соревнований →
      </Link>
    </main>
  );
}
