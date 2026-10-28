"use client";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Input,
  PageTitle,
  Select,
} from "@/components/ui";
import { DataState } from "@/components/data-state";
import { useUser } from "@/components/shell";
import {
  CompetitionEditor,
  type CompetitionFields,
} from "@/features/competitions/competition-editor";
import { ApplicationActions } from "@/features/competitions/application-actions";
import { useApi } from "@/hooks/use-api";
import { api, downloadFile } from "@/lib/api";
import { fio, formatDate, statusLabel } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
type Person = {
  id: string;
  lastName: string;
  firstName: string;
  middleName?: string | null;
};
type Competition = CompetitionFields & {
  id: string;
  name: string;
  venue: string;
  description?: string | null;
  startsAt: string;
  applicationsOpenAt: string;
  applicationsCloseAt: string;
  publicationStatus: string;
  disciplineId: string;
  discipline: { name: string };
  applications: Array<{
    id: string;
    status: string;
    athleteId: string;
    athlete: Person;
  }>;
  results: Array<{
    athleteId: string;
    place: number;
    score: string;
    athlete: Person;
  }>;
  protocol: { number: string; status: string } | null;
  judgeAssignments: Array<{ id: string; position: string; judge: Person }>;
};
export default function CompetitionPage() {
  const { id } = useParams<{ id: string }>();
  const user = useUser();
  const federation = user?.activeRole === "FEDERATION";
  const state = useApi<Competition>(`/competitions/${id}`);
  const data = state.data;
  const judges = useApi<Person[]>(federation ? "/judges" : null);
  const links = useApi<
    Array<{
      status: string;
      athleteId: string;
      disciplineId: string;
      athlete: Person;
    }>
  >(user?.activeRole === "COACH" ? "/coaches/me/athletes" : null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [athleteId, setAthleteId] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (data)
      setScores(
        Object.fromEntries(data.results.map((r) => [r.athleteId, r.score])),
      );
  }, [data]);
  async function action(path: string, body: unknown, message: string) {
    setBusy(true);
    try {
      await api(path, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      toast.success(message);
      state.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  async function download(extension: string) {
    try {
      await downloadFile(
        `/documents/protocol/${id}.${extension}`,
        undefined,
        `протокол.${extension}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка выгрузки");
    }
  }
  const approved =
    data?.applications.filter((a) => a.status === "APPROVED") ?? [];
  const activeApplication = data?.applications.find(
    (a) =>
      a.athleteId === user?.athleteId &&
      ["PENDING", "APPROVED"].includes(a.status),
  );
  const accepting =
    data &&
    data.publicationStatus === "PUBLISHED" &&
    new Date(data.applicationsOpenAt) <= new Date() &&
    new Date(data.applicationsCloseAt) >= new Date();
  return (
    <div>
      <DataState {...state} retry={state.reload} />
      {data && (
        <>
          <PageTitle
            title={data.name}
            subtitle={`${data.discipline.name} · ${data.venue} · ${formatDate(data.startsAt)}`}
          />
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Badge>{statusLabel[data.publicationStatus]}</Badge>
            {federation && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Редактировать
              </Button>
            )}
            {editing && (
              <CompetitionEditor
                initial={data}
                publishedProtocol={data.protocol?.status === "PUBLISHED"}
                onClose={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  state.reload();
                }}
              />
            )}
            {federation && data.publicationStatus === "DRAFT" && (
              <Button
                disabled={busy}
                onClick={() =>
                  void action(
                    `/competitions/${id}/publish`,
                    undefined,
                    "Соревнование опубликовано",
                  )
                }
              >
                Опубликовать
              </Button>
            )}
            <span className="text-sm text-[#71829b]">
              Приём заявок до {formatDate(data.applicationsCloseAt)}
            </span>
            {user?.activeRole === "ATHLETE" && (
              <Button
                disabled={busy || !accepting || !!activeApplication}
                onClick={() =>
                  void action(
                    `/competitions/${id}/applications`,
                    { athleteId: user.athleteId },
                    "Заявка подана",
                  )
                }
              >
                {activeApplication
                  ? "Заявка уже подана"
                  : accepting
                    ? "Подать заявку"
                    : "Приём заявок закрыт"}
              </Button>
            )}
          </div>
          {user?.activeRole === "COACH" && (
            <Card className="mb-5">
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    `/competitions/${id}/applications`,
                    { athleteId },
                    "Заявка за спортсмена подана",
                  );
                }}
              >
                <Field label="Подать заявку за подопечного">
                  <Select
                    value={athleteId}
                    onChange={(e) => setAthleteId(e.target.value)}
                    required
                  >
                    <option value="">Выберите спортсмена</option>
                    {links.data
                      ?.filter(
                        (l) =>
                          l.status === "ACTIVE" &&
                          l.disciplineId === data.disciplineId,
                      )
                      .map((l) => (
                        <option key={l.athleteId} value={l.athleteId}>
                          {fio(l.athlete)}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Button
                  type="submit"
                  disabled={busy || !accepting || !athleteId}
                >
                  Подать заявку
                </Button>
              </form>
            </Card>
          )}
          {data.description && (
            <p className="mb-6 max-w-4xl whitespace-pre-line text-sm leading-relaxed text-[#71829b]">
              {data.description}
            </p>
          )}
          <div className="grid gap-5 xl:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-semibold">Заявки участников</h2>
              <div className="space-y-4">
                {data.applications.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf2f8] pb-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{fio(item.athlete)}</p>
                      <p className="mt-1 text-xs text-[#71829b]">
                        {statusLabel[item.status]}
                      </p>
                    </div>
                    <ApplicationActions
                      id={item.id}
                      status={item.status}
                      reload={state.reload}
                    />
                  </div>
                ))}
              </div>
              {!data.applications.length && (
                <p className="text-sm text-[#71829b]">
                  Доступных заявок пока нет.
                </p>
              )}
            </Card>
            <Card>
              <h2 className="mb-4 font-semibold">Результаты и протокол</h2>
              {federation && approved.length > 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      `/competitions/${id}/results`,
                      {
                        items: approved
                          .filter((a) => scores[a.athleteId]?.trim())
                          .map((a) => ({
                            athleteId: a.athleteId,
                            score: Number(scores[a.athleteId]),
                          })),
                      },
                      "Результаты сохранены. Места рассчитаны.",
                    );
                  }}
                >
                  {approved.map((a) => (
                    <label
                      key={a.id}
                      className="mb-3 flex items-center gap-3 text-sm"
                    >
                      <span className="flex-1">{fio(a.athlete)}</span>
                      <Input
                        className="w-32"
                        type="number"
                        step="any"
                        placeholder="Баллы"
                        value={scores[a.athleteId] ?? ""}
                        onChange={(e) =>
                          setScores({
                            ...scores,
                            [a.athleteId]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <p className="my-4 text-xs text-[#71829b]">
                    Равные баллы дают одинаковое место. Исправление
                    опубликованных результатов возвращает протокол в черновик.
                  </p>
                  <Button
                    disabled={
                      busy || !approved.some((a) => scores[a.athleteId]?.trim())
                    }
                    type="submit"
                  >
                    Сохранить результаты
                  </Button>
                </form>
              )}
              <div className="my-5 space-y-3">
                {data.results.map((r) => (
                  <div
                    key={r.athleteId}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span>
                      {r.place}. {fio(r.athlete)}
                    </span>
                    <strong>{r.score} баллов</strong>
                  </div>
                ))}
              </div>
              {!data.results.length && (
                <p className="text-sm text-[#71829b]">
                  Результаты ещё не внесены.
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {federation && (
                  <Button
                    disabled={busy || !data.results.length}
                    variant="outline"
                    onClick={() =>
                      void action(
                        `/competitions/${id}/protocol`,
                        undefined,
                        "Протокол опубликован, рейтинг пересчитан",
                      )
                    }
                  >
                    Опубликовать протокол
                  </Button>
                )}
                {data.protocol &&
                  (data.protocol.status === "PUBLISHED" || federation) && (
                    <>
                      <Badge
                        tone={
                          data.protocol.status === "PUBLISHED" ? "ok" : "warn"
                        }
                      >
                        {statusLabel[data.protocol.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        onClick={() => void download("pdf")}
                      >
                        Скачать PDF
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void download("xlsx")}
                      >
                        Скачать XLSX
                      </Button>
                    </>
                  )}
              </div>
            </Card>
          </div>
          <Card className="mt-5">
            <h2 className="mb-4 font-semibold">Судейская коллегия</h2>
            <div className="mb-4 space-y-2">
              {data.judgeAssignments.map((a) => (
                <p key={a.id} className="text-sm">
                  {fio(a.judge)} · {a.position}
                </p>
              ))}
              {!data.judgeAssignments.length && (
                <p className="text-sm text-[#71829b]">
                  Судьи пока не назначены.
                </p>
              )}
            </div>
            {federation && (
              <form
                className="grid items-end gap-3 md:grid-cols-[1fr_1fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    `/competitions/${id}/judges`,
                    Object.fromEntries(new FormData(e.currentTarget)),
                    "Судья назначен",
                  );
                }}
              >
                <Field label="Судья">
                  <Select name="judgeId" required>
                    {judges.data?.map((j) => (
                      <option key={j.id} value={j.id}>
                        {fio(j)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Должность">
                  <Input name="position" required placeholder="Главный судья" />
                </Field>
                <Button type="submit" disabled={busy}>
                  Назначить
                </Button>
              </form>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
