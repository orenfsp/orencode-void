import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { DisciplineBadge } from "./discipline-icon";
export type PublicCompetition = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  level: string;
  discipline: { id: string; name: string; code: string };
};
export function CompetitionRow({ item }: { item: PublicCompetition }) {
  const date = new Date(item.startsAt);
  return (
    <Link href={`/public/competitions/${item.id}`} className="event-row">
      <div className="border-r border-[#dfebf8] pr-3">
        <div className="text-2xl font-semibold leading-none">
          {date.toLocaleDateString("ru-RU", { day: "numeric" })}
        </div>
        <div className="mt-1 text-xs text-[#71829b]">
          {date.toLocaleDateString("ru-RU", { month: "long" })}
        </div>
      </div>
      <div>
        <h3 className="text-[13px] font-semibold leading-snug">{item.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DisciplineBadge {...item.discipline} />
          <span className="rounded-full bg-[#eaf0f6] px-2 py-1 text-[10px] text-[#7c8ba0]">
            {(
              {
                REGIONAL: "Региональный уровень",
                INTERREGIONAL: "Межрегиональный уровень",
                NATIONAL: "Всероссийский уровень",
              } as Record<string, string>
            )[item.level] ?? item.level}
          </span>
        </div>
      </div>
      <div className="event-venue flex items-center gap-3 border-l border-[#dfebf8] pl-5">
        <MapPin size={17} className="shrink-0 text-[#5799dd]" />
        <span className="flex-1 text-xs leading-relaxed text-[#71829b]">
          {item.venue}
        </span>
        <ChevronRight size={17} className="shrink-0 text-[#5799dd]" />
      </div>
    </Link>
  );
}
