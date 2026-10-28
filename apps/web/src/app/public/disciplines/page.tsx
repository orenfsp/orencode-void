"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageTitle } from "@/components/ui";
import { DisciplineIcon } from "@/components/discipline-icon";
import { DataState } from "@/components/data-state";
import { useApi } from "@/hooks/use-api";
export default function DisciplinesPage() {
  const state =
    useApi<
      Array<{ id: string; code: string; name: string; description: string }>
    >("/disciplines");
  return (
    <main className="public-container py-10">
      <PageTitle
        title="Дисциплины"
        subtitle="Шесть направлений, чтобы найти своё и стать сильнее"
      />
      <DataState {...state} retry={state.reload} />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {state.data?.map((item) => (
          <article
            id={item.code}
            key={item.id}
            className="rounded-xl border border-[#e2ecf7] bg-[#f7faff] p-7"
          >
            <DisciplineIcon code={item.code} size={38} />
            <h2 className="mt-5 text-lg font-semibold">{item.name}</h2>
            <p className="mt-3 min-h-20 text-sm leading-relaxed text-[#71829b]">
              {item.description}
            </p>
            <Link href="/public/calendar" className="text-link mt-4">
              Перейти к соревнованиям <ArrowRight size={14} />
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
