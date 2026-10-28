"use client";

import { Badge, Button, Card, Empty, PageTitle } from "@/components/ui";
import { api, downloadFile } from "@/lib/api";
import { formatDate, statusLabel } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Competition = {
  id: string;
  name: string;
  startsAt: string;
  season: number;
  publicationStatus: string;
  discipline: { name: string };
  protocol: { id: string; number: string; status: string } | null;
  _count: { results: number; applications: number };
};

export default function ResultsPage() {
  const [items, setItems] = useState<Competition[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Competition[] }>("/competitions?pageSize=100")
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  async function download(path: string, name: string, key: string) {
    setDownloading(key);
    try {
      await downloadFile(path, undefined, name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка скачивания");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageTitle
        title="Результаты и протоколы"
        subtitle="Протокол формируется из результатов, опубликованных в системе. XLSX и PDF используют актуальные данные."
      />
      {items.length === 0 ? <Empty title="Соревнования не найдены" /> : null}
      <div className="grid gap-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <Link
                href={`/competitions/${item.id}`}
                className="font-medium hover:text-[#1680ff]"
              >
                {item.name}
              </Link>
              <p className="mt-1 text-sm text-[#71829b]">
                {item.discipline.name} · {formatDate(item.startsAt)} · сезон{" "}
                {item.season}
              </p>
              <p className="mt-1 text-xs text-[#71829b]">
                Заявок: {item._count.applications} · результатов:{" "}
                {item._count.results}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={item.publicationStatus === "PUBLISHED" ? "ok" : "warn"}
              >
                {statusLabel[item.publicationStatus] ?? item.publicationStatus}
              </Badge>
              {item.protocol ? (
                <Badge
                  tone={item.protocol.status === "PUBLISHED" ? "ok" : "warn"}
                >
                  Протокол № {item.protocol.number}
                </Badge>
              ) : (
                <Badge>Протокол не сформирован</Badge>
              )}
              {item._count.results > 0 ? (
                <>
                  <Button
                    variant="outline"
                    disabled={downloading === `${item.id}-pdf`}
                    onClick={() =>
                      download(
                        `/documents/protocol/${item.id}.pdf`,
                        `protocol-${item.id}.pdf`,
                        `${item.id}-pdf`,
                      )
                    }
                  >
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    disabled={downloading === `${item.id}-xlsx`}
                    onClick={() =>
                      download(
                        `/documents/protocol/${item.id}.xlsx`,
                        `protocol-${item.id}.xlsx`,
                        `${item.id}-xlsx`,
                      )
                    }
                  >
                    XLSX
                  </Button>
                </>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
