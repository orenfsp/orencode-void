"use client";

import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  PageTitle,
  Select,
  TableWrap,
} from "@/components/ui";
import { api, downloadFile, type AuthUser } from "@/lib/api";
import { fio, formatDate } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Certificate = {
  id: string;
  number: string;
  issuedAt: string;
  verificationToken: string;
  athlete: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
  };
  competition: { id: string; name: string; discipline: { name: string } };
  result: { place: number; score: string } | null;
};

type Result = {
  id: string;
  place: number;
  score: string;
  competitionId: string;
  competition: { id: string; name: string; discipline: { name: string } };
};

type CoachLink = {
  athleteId: string;
  status: string;
  athlete: {
    id: string;
    lastName: string;
    firstName: string;
    middleName: string | null;
  };
};

export default function DocumentsPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<Certificate[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [links, setLinks] = useState<CoachLink[]>([]);
  const [athleteId, setAthleteId] = useState("");
  const [competitionId, setCompetitionId] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCertificates() {
    setItems(await api<Certificate[]>("/documents/certificates"));
  }

  useEffect(() => {
    api<AuthUser>("/auth/me").then(async (user) => {
      setMe(user);
      await loadCertificates();
      if (user.activeRole === "ATHLETE" && user.athleteId) {
        const athlete = await api<{ results: Result[] }>(
          `/athletes/${user.athleteId}`,
        );
        setAthleteId(user.athleteId);
        setResults(athlete.results);
      }
      if (user.activeRole === "COACH") {
        setLinks(await api<CoachLink[]>("/coaches/me/athletes"));
      }
    });
  }, []);

  const activeLinks = useMemo(
    () => links.filter((item) => item.status === "ACTIVE"),
    [links],
  );

  async function selectCoachAthlete(id: string) {
    setAthleteId(id);
    setCompetitionId("");
    if (!id) {
      setResults([]);
      return;
    }
    const athlete = await api<{ results: Result[] }>(`/athletes/${id}`);
    setResults(athlete.results);
  }

  const availableResults = results.filter(
    (result) => result.competitionId && result.place > 0,
  );
  const selectedResult = availableResults.find(
    (result) => result.competitionId === competitionId,
  );

  async function issue() {
    if (!athleteId || !competitionId) return;
    setBusy(true);
    try {
      await downloadFile(
        "/documents/certificates",
        {
          method: "POST",
          body: JSON.stringify({ athleteId, competitionId }),
        },
        "spravka-ob-uchastii.pdf",
      );
      toast.success("Справка сформирована и сохранена в реестре");
      await loadCertificates();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ошибка формирования справки",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;

  return (
    <div>
      <PageTitle
        title="Документы"
        subtitle="Справки об участии формируются из опубликованных результатов и содержат QR-код проверки."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="mb-3 font-medium">Сформировать справку</h2>
          {me.activeRole === "ATHLETE" || me.activeRole === "COACH" ? (
            <div className="space-y-3">
              {me.activeRole === "COACH" ? (
                <Field label="Спортсмен">
                  <Select
                    value={athleteId}
                    onChange={(event) =>
                      void selectCoachAthlete(event.target.value)
                    }
                  >
                    <option value="">Выберите спортсмена</option>
                    {activeLinks.map((link) => (
                      <option key={link.athleteId} value={link.athleteId}>
                        {fio(link.athlete)}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              <Field label="Соревнование">
                <Select
                  value={competitionId}
                  onChange={(event) => setCompetitionId(event.target.value)}
                  disabled={!athleteId}
                >
                  <option value="">Выберите соревнование</option>
                  {availableResults.map((result) => (
                    <option key={result.id} value={result.competitionId}>
                      {result.competition.name} — место {result.place}
                    </option>
                  ))}
                </Select>
              </Field>
              {athleteId && availableResults.length === 0 ? (
                <p className="text-sm text-[#71829b]">
                  Нет опубликованных результатов для справки.
                </p>
              ) : null}
              {selectedResult ? (
                <p className="text-sm text-[#71829b]">
                  {selectedResult.competition.discipline.name} · место{" "}
                  {selectedResult.place} · {selectedResult.score} баллов
                </p>
              ) : null}
              <Button disabled={!selectedResult || busy} onClick={issue}>
                Сформировать PDF
              </Button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="text-[#71829b]">
                Федерация видит все выданные справки. Справки спортсменов
                формируются в их кабинете.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  downloadFile(
                    "/documents/headcount.xlsx",
                    undefined,
                    "otchet-chislennost.xlsx",
                  )
                }
              >
                Отчёт о численности XLSX
              </Button>
              <Link className="block text-[#1680ff]" href="/results">
                Перейти к протоколам соревнований →
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Проверка справки</h2>
          <p className="text-sm text-[#71829b]">
            Публичная страница проверки доступна по QR-коду. Демонстрационная
            справка:{" "}
            <Link
              className="text-[#1680ff]"
              href="/verify/demo-certificate-token-2025"
            >
              открыть проверку
            </Link>
            .
          </p>
        </Card>
      </div>

      <h2 className="mb-3 mt-6 font-medium">Выданные справки</h2>
      {items.length === 0 ? (
        <Empty title="Справки пока не сформированы" />
      ) : (
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f4f8fd] text-[#71829b]">
              <tr>
                <th className="px-4 py-3">Номер</th>
                <th className="px-4 py-3">Спортсмен</th>
                <th className="px-4 py-3">Соревнование</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Проверка</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#e1eaf5]">
                  <td className="px-4 py-3">{item.number}</td>
                  <td className="px-4 py-3">{fio(item.athlete)}</td>
                  <td className="px-4 py-3">
                    {item.competition.name}
                    <div className="text-xs text-[#71829b]">
                      {item.competition.discipline.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(item.issuedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="ok">QR</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await downloadFile(
                            `/documents/certificates/${item.id}.pdf`,
                            undefined,
                            `spravka-${item.number}.pdf`,
                          );
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Ошибка",
                          );
                        }
                      }}
                    >
                      Скачать
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
