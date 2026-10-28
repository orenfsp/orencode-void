"use client";

import {
  Badge,
  Button,
  Card,
  Input,
  PageTitle,
  Field,
  Textarea,
  Modal,
  Empty,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { api } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CompetitionEditor } from "@/features/competitions/competition-editor";
import { useUser } from "@/components/shell";

type Comp = {
  id: string;
  name: string;
  startsAt: string;
  venue: string;
  publicationStatus: string;
  discipline: { name: string };
};

export default function CalendarPage() {
  const user = useUser();
  const [items, setItems] = useState<Comp[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: Comp[] }>("/competitions?pageSize=100");
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <PageTitle title="Календарь соревнований" />
        {user?.activeRole === "FEDERATION" && (
          <Button onClick={() => setOpen(true)}>Создать соревнование</Button>
        )}
      </div>
      <Input
        className="mb-5 max-w-xl"
        placeholder="Поиск соревнований…"
        aria-label="Поиск соревнований"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <DataState loading={loading} error={error} retry={load} />
      {!loading && !error && !items.length && (
        <Empty title="Доступных соревнований пока нет" />
      )}
      <div className="grid gap-3">
        {items
          .filter((item) =>
            item.name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((item) => (
            <Link key={item.id} href={`/competitions/${item.id}`}>
              <Card className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium">{item.name}</h2>
                  <p className="text-sm text-[#71829b]">
                    {item.discipline.name} · {formatDate(item.startsAt)} ·{" "}
                    {item.venue}
                  </p>
                </div>
                <Badge
                  tone={item.publicationStatus === "PUBLISHED" ? "ok" : "warn"}
                >
                  {statusLabel[item.publicationStatus] ??
                    item.publicationStatus}
                </Badge>
              </Card>
            </Link>
          ))}
      </div>
      {open ? (
        <CompetitionEditor
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
