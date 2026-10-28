import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import PizZip from "pizzip";

if (existsSync(".env")) process.loadEnvFile(".env");
const schema = `fsp_test_${Date.now()}`;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set("schema", schema);
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  API_PORT: "4100",
  NODE_ENV: "test",
};
const db = new PrismaClient({ datasourceUrl: url.toString() });
let server;
let logs = "";
let checks = 0;
const cookies = {};
async function command(args) {
  const child = spawn(process.execPath, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (data) => (output += data));
  child.stderr.on("data", (data) => (output += data));
  const [code] = await once(child, "exit");
  assert.equal(code, 0, output);
}
async function request(
  path,
  { role, method = "GET", body, status = 200, file } = {},
) {
  const response = await fetch(`http://localhost:4100/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(role && cookies[role] ? { Cookie: cookies[role] } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const cookie = response.headers.get("set-cookie");
  if (cookie && role) cookies[role] = cookie.split(";")[0];
  if (file && response.status === status) {
    const buffer = Buffer.from(await response.arrayBuffer());
    checks++;
    assert.ok(buffer.length > 100, `${path}: empty document`);
    if (file === "pdf") assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
    if (file === "xlsx") {
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(buffer);
      assert.ok(book.worksheets[0].rowCount > 0);
    }
    if (file === "docx")
      assert.match(
        new PizZip(buffer).file("word/document.xml").asText(),
        /Сборная|сборной/,
      );
    return buffer;
  }
  const json = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(json)}`,
  );
  checks++;
  return json.data;
}
async function login(role, email = `${role}@fsp-orenburg.demo`) {
  return request("/auth/login", {
    role,
    method: "POST",
    status: 201,
    body: { email, password: "Demo1234!" },
  });
}
async function post(role, path, body, status = 201) {
  return request(path, { role, method: "POST", body, status });
}

try {
  await command(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  await command(["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);
  server = spawn(process.execPath, ["apps/api/dist/main.js"], {
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data) => (logs += data));
  server.stderr.on("data", (data) => (logs += data));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch("http://localhost:4100/api/disciplines");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(150);
  }
  assert.ok(ready, logs);
  await request("/athletes", { status: 401 });
  await post(
    "invalid",
    "/auth/login",
    { email: "unknown@example.test", password: "wrongpassword" },
    401,
  );
  const federation = await login("federation");
  const athlete = await login("athlete");
  const second = await login("athlete2");
  const coach = await login("coach");
  const judge = await login("judge");
  await login("ministry");
  const multi = await login("multi");
  assert.ok(multi.roles.length > 1);
  for (const role of multi.roles) {
    const switched = await post("multi", "/auth/switch-role", { role });
    assert.equal(switched.activeRole, role);
  }
  await post("athlete", "/auth/switch-role", { role: "FEDERATION" }, 403);
  await request("/athletes", { role: "athlete", status: 403 });
  await request(`/athletes/${second.athleteId}`, {
    role: "athlete",
    status: 403,
  });
  const profile = await request("/athletes/me", { role: "athlete" });
  const disciplines = await request("/disciplines");
  assert.equal(disciplines.length, 6);
  const types = await request("/competition-types");
  const disciplineId = profile.disciplines[0].disciplineId;
  const group = await post("federation", "/age-groups", {
    code: "TEST_OPEN",
    name: "Открытая группа",
  });
  const restricted = await post("federation", "/age-groups", {
    code: "TEST_90",
    name: "90+",
    minAge: 90,
  });
  const now = Date.now();
  const day = 86400000;
  const season = new Date().getFullYear();
  const base = {
    name: "Тестовый турнир",
    disciplineId,
    typeId: types[0].id,
    level: "REGIONAL",
    format: "ONLINE",
    ageGroupId: group.id,
    startsAt: new Date(now + 3 * day).toISOString(),
    endsAt: new Date(now + 4 * day).toISOString(),
    venue: "Тестовый стенд",
    applicationsOpenAt: new Date(now - day).toISOString(),
    applicationsCloseAt: new Date(now + day).toISOString(),
    calendarPlanType: "REGIONAL",
    ratingBand: "REGIONAL",
    season,
  };
  await post("athlete", "/competitions", base, 403);
  await post("ministry", "/competitions", base, 403);
  await post(
    "federation",
    "/competitions",
    { ...base, unknownField: true },
    400,
  );
  await post(
    "federation",
    "/competitions",
    { ...base, endsAt: new Date(now).toISOString() },
    400,
  );
  const competition = await post("federation", "/competitions", base);
  await request(`/competitions/public/${competition.id}`, { status: 404 });
  await post(
    "athlete",
    `/competitions/${competition.id}/applications`,
    { athleteId: athlete.athleteId },
    400,
  );
  await post("federation", `/competitions/${competition.id}/publish`);
  const pub = await request(`/competitions/public/${competition.id}`);
  assert.equal(pub.applications, undefined);
  assert.equal(pub.createdById, undefined);
  await post(
    "athlete",
    `/competitions/${competition.id}/applications`,
    { athleteId: second.athleteId },
    403,
  );
  const app = await post(
    "athlete",
    `/competitions/${competition.id}/applications`,
    { athleteId: athlete.athleteId },
  );
  await post(
    "athlete",
    `/competitions/${competition.id}/applications`,
    { athleteId: athlete.athleteId },
    400,
  );
  await post(
    "judge",
    `/competitions/${competition.id}/results`,
    { items: [{ athleteId: athlete.athleteId, score: 1 }] },
    403,
  );
  await post(
    "federation",
    `/competitions/${competition.id}/results`,
    { items: [{ athleteId: athlete.athleteId, score: 1 }] },
    400,
  );
  await post(
    "athlete",
    `/competitions/applications/${app.id}/review`,
    { status: "APPROVED" },
    403,
  );
  await post(
    "federation",
    `/competitions/applications/${app.id}/review`,
    { status: "REJECTED" },
    400,
  );
  await post("federation", `/competitions/applications/${app.id}/review`, {
    status: "APPROVED",
  });
  await post(
    "federation",
    `/competitions/applications/${app.id}/review`,
    { status: "APPROVED" },
    400,
  );
  const secondApp = await post(
    "athlete2",
    `/competitions/${competition.id}/applications`,
    { athleteId: second.athleteId },
  );
  await post(
    "federation",
    `/competitions/applications/${secondApp.id}/review`,
    { status: "APPROVED" },
  );
  await post(
    "federation",
    `/competitions/${competition.id}/results`,
    { items: [] },
    400,
  );
  await post("federation", `/competitions/${competition.id}/results`, {
    items: [
      { athleteId: athlete.athleteId, score: 100 },
      { athleteId: second.athleteId, score: 100 },
    ],
  });
  await request(`/documents/protocol/${competition.id}.pdf`, {
    role: "athlete",
    status: 403,
  });
  await post("federation", `/competitions/${competition.id}/protocol`);
  let card = await request(`/competitions/${competition.id}`, {
    role: "federation",
  });
  assert.deepEqual(
    card.results.map((r) => r.place),
    [1, 1],
  );
  const athleteCard = await request(`/competitions/${competition.id}`, {
    role: "athlete",
  });
  assert.equal(athleteCard.applications.length, 1);
  const publicCard = await request(`/competitions/public/${competition.id}`);
  assert.equal(publicCard.results[0].athlete, undefined);
  const ratingBefore = await request(
    `/ratings?season=${season}&disciplineId=${disciplineId}`,
    { role: "federation" },
  );
  await post("federation", "/ratings/recalculate", { season, disciplineId });
  const ratingAfter = await request(
    `/ratings?season=${season}&disciplineId=${disciplineId}`,
    { role: "federation" },
  );
  assert.deepEqual(
    ratingBefore.map((r) => [r.athleteId, r.totalPoints]),
    ratingAfter.map((r) => [r.athleteId, r.totalPoints]),
  );
  await request(`/documents/protocol/${competition.id}.pdf`, {
    role: "athlete",
    file: "pdf",
  });
  await request(`/documents/protocol/${competition.id}.xlsx`, {
    role: "federation",
    file: "xlsx",
  });
  await request("/documents/certificates", {
    role: "athlete",
    method: "POST",
    status: 201,
    body: { athleteId: athlete.athleteId, competitionId: competition.id },
    file: "pdf",
  });
  const certificates = await request("/documents/certificates", {
    role: "athlete",
  });
  const certificate = certificates.find(
    (c) => c.competitionId === competition.id,
  );
  assert.ok(certificate.verificationToken.length >= 32);
  assert.equal(
    (await request(`/documents/verify/${certificate.verificationToken}`)).valid,
    true,
  );
  await request(`/documents/certificates/${certificate.id}.pdf`, {
    role: "athlete2",
    status: 403,
  });
  await post("federation", `/competitions/${competition.id}/results`, {
    items: [{ athleteId: athlete.athleteId, score: 50 }],
  });
  card = await request(`/competitions/${competition.id}`, {
    role: "federation",
  });
  assert.equal(card.protocol.status, "DRAFT");
  assert.equal(
    card.results.find((r) => r.athleteId === second.athleteId).place,
    1,
  );
  assert.equal(
    card.results.find((r) => r.athleteId === athlete.athleteId).place,
    2,
  );
  assert.equal(
    (await request(`/documents/verify/${certificate.verificationToken}`)).valid,
    false,
  );
  assert.equal(
    (await request(`/competitions/public/${competition.id}`)).results.length,
    0,
  );
  await post("federation", `/competitions/${competition.id}/protocol`);
  const expired = await post("federation", "/competitions", {
    ...base,
    name: "Закрытый приём",
    applicationsCloseAt: new Date(now - 1000).toISOString(),
  });
  await post("federation", `/competitions/${expired.id}/publish`);
  await post(
    "athlete",
    `/competitions/${expired.id}/applications`,
    { athleteId: athlete.athleteId },
    400,
  );
  const ageRestricted = await post("federation", "/competitions", {
    ...base,
    ageGroupId: restricted.id,
  });
  await post("federation", `/competitions/${ageRestricted.id}/publish`);
  await post(
    "athlete",
    `/competitions/${ageRestricted.id}/applications`,
    { athleteId: athlete.athleteId },
    400,
  );
  await post("federation", `/competitions/${competition.id}/judges`, {
    judgeId: judge.judgeId,
    position: "Главный судья",
  });
  assert.ok(
    (await request("/judges/me", { role: "judge" })).assignments.some(
      (a) => a.competitionId === competition.id,
    ),
  );
  const team = await post("federation", "/national-team", {
    season,
    disciplineId,
    ageGroupId: group.id,
    title: "Тестовая сборная",
  });
  await post("federation", `/national-team/${team.id}/members`, {
    athleteId: athlete.athleteId,
    source: "RATING",
  });
  await request(`/documents/national-team/${team.id}.pdf`, {
    role: "federation",
    file: "pdf",
  });
  await request(`/documents/national-team/${team.id}.docx`, {
    role: "federation",
    file: "docx",
  });
  await request(`/documents/national-team/${team.id}.pdf`, {
    role: "athlete",
    status: 403,
  });
  await db.disqualification.create({
    data: {
      athleteId: athlete.athleteId,
      reason: "Тест",
      startsAt: new Date(now - day),
      endsAt: new Date(now + day),
      createdById: federation.id,
    },
  });
  const excluded = await request(`/ratings?season=${season}`, {
    role: "federation",
  });
  assert.ok(!excluded.some((r) => r.athleteId === athlete.athleteId));
  await post(
    "federation",
    `/national-team/${team.id}/members`,
    { athleteId: athlete.athleteId, source: "MANUAL" },
    400,
  );
  const rank = await post("athlete", "/rank-applications", {
    athleteId: athlete.athleteId,
    rankType: "Тестовый разряд",
  });
  await post(
    "federation",
    `/rank-applications/${rank.id}/review`,
    { approve: true },
    400,
  );
  await post("federation", `/rank-applications/${rank.id}/review`, {
    approve: true,
    assignedAt: "2020-01-01",
    expiresAt: "2021-01-01",
    orderNumber: "ТЕСТ-1",
  });
  assert.notEqual(
    (await request("/athletes/me", { role: "athlete" })).currentRank?.rankType,
    "Тестовый разряд",
  );
  await post(
    "federation",
    `/rank-applications/${rank.id}/review`,
    {
      approve: true,
      assignedAt: "2020-01-01",
      expiresAt: "2021-01-01",
      orderNumber: "ТЕСТ-1",
    },
    400,
  );
  const cat = await post("judge", "/judge-category-applications", {
    requestedCategory: "Тестовая категория",
  });
  await post(
    "federation",
    `/judge-category-applications/${cat.id}/review`,
    { approve: true },
    400,
  );
  await post("federation", `/judge-category-applications/${cat.id}/review`, {
    approve: true,
    assignedAt: "2026-01-01",
    expiresAt: "2027-01-01",
    orderNumber: "СК-ТЕСТ",
  });
  await request("/documents/headcount.xlsx", {
    role: "federation",
    file: "xlsx",
  });
  await request(`/documents/athletes/${athlete.athleteId}/history.pdf`, {
    role: "athlete",
    file: "pdf",
  });
  const headcount = await request("/reports/headcount", { role: "federation" });
  assert.ok(headcount.dynamics.length >= 2);
  assert.ok((await request("/notifications", { role: "athlete" })).length > 0);
  // Account lifecycle, role boundaries, profile linkage and session revocation.
  const accountBody = {
    email: "NEW-ACCOUNT@example.test",
    firstName: "Тест",
    lastName: "Аккаунт",
    roles: ["COACH", "JUDGE"],
    isActive: true,
    password: "Demo1234!account",
  };
  await request("/users", { role: "athlete", status: 403 });
  await post("ministry", "/users", accountBody, 403);
  await post("federation", "/users", { ...accountBody, roles: [] }, 400);
  await post(
    "federation",
    "/users",
    { ...accountBody, password: "short" },
    400,
  );
  const account = await post("federation", "/users", accountBody);
  await post(
    "federation",
    "/users",
    { ...accountBody, email: "new-account@example.test" },
    409,
  );
  assert.ok(await db.coach.findUnique({ where: { userId: account.id } }));
  assert.ok(await db.judge.findUnique({ where: { userId: account.id } }));
  await request("/auth/login", {
    role: "managed",
    method: "POST",
    status: 201,
    body: { email: accountBody.email, password: accountBody.password },
  });
  const accounts = await request("/users", { role: "federation" });
  assert.ok(accounts.every((u) => !u.passwordHash && !u.sessions));
  const managed = accounts.find((u) => u.id === account.id);
  const putAccount = async (body, status = 200, role = "federation") =>
    request(`/users/${account.id}`, { role, method: "PUT", body, status });
  const { password, ...accountFields } = accountBody;
  await putAccount(
    { ...accountFields, updatedAt: managed.updatedAt },
    403,
    "athlete",
  );
  await putAccount({
    ...accountFields,
    roles: ["MINISTRY"],
    updatedAt: managed.updatedAt,
  });
  await request("/auth/me", { role: "managed", status: 401 });
  await putAccount({ ...accountFields, updatedAt: managed.updatedAt }, 409);
  let version = (await request("/users", { role: "federation" })).find(
    (u) => u.id === account.id,
  ).updatedAt;
  await putAccount({ ...accountFields, isActive: false, updatedAt: version });
  await request("/auth/login", {
    role: "managed",
    method: "POST",
    status: 401,
    body: { email: accountBody.email, password: accountBody.password },
  });
  version = (await request("/users", { role: "federation" })).find(
    (u) => u.id === account.id,
  ).updatedAt;
  await putAccount({
    ...accountFields,
    password: "Changed1234!",
    updatedAt: version,
  });
  await request("/auth/login", {
    role: "managed",
    method: "POST",
    status: 401,
    body: { email: accountBody.email, password: accountBody.password },
  });
  await request("/auth/login", {
    role: "managed",
    method: "POST",
    status: 201,
    body: { email: accountBody.email, password: "Changed1234!" },
  });
  const myself = accounts.find((u) => u.id === federation.id);
  const ownBody = {
    email: myself.email,
    firstName: myself.firstName,
    lastName: myself.lastName,
    roles: myself.roles,
    isActive: true,
    updatedAt: myself.updatedAt,
  };
  await request(`/users/${myself.id}`, {
    role: "federation",
    method: "PUT",
    body: { ...ownBody, isActive: false },
    status: 400,
  });
  await request(`/users/${myself.id}`, {
    role: "federation",
    method: "PUT",
    body: { ...ownBody, roles: ["MINISTRY"] },
    status: 400,
  });
  const freeProfile = await db.athlete.create({
    data: {
      lastName: "Свободный",
      firstName: "Профиль",
      birthDate: new Date("2000-01-01"),
      municipality: "Тест",
      startedYear: 2020,
    },
  });
  assert.ok(
    (
      await request("/users/available-athletes?q=Свободный", {
        role: "federation",
      })
    ).some((a) => a.id === freeProfile.id),
  );
  const linked = await post("federation", "/users", {
    ...accountBody,
    email: "linked@example.test",
    roles: ["ATHLETE"],
    athleteId: freeProfile.id,
  });
  assert.equal(
    (await db.athlete.findUnique({ where: { id: freeProfile.id } })).userId,
    linked.id,
  );
  await post(
    "federation",
    "/users",
    {
      ...accountBody,
      email: "duplicate-link@example.test",
      roles: ["ATHLETE"],
      athleteId: freeProfile.id,
    },
    409,
  );
  assert.equal(
    await db.user.count({ where: { email: "duplicate-link@example.test" } }),
    0,
  );

  // Editing existing competitions preserves eligibility and invalidates published documents atomically.
  let editable = await request(`/competitions/${competition.id}`, {
    role: "federation",
  });
  const putCompetition = (body, status = 200, role = "federation") =>
    request(`/competitions/${competition.id}`, {
      role,
      method: "PUT",
      body,
      status,
    });
  await putCompetition(
    { ...base, updatedAt: editable.updatedAt },
    403,
    "athlete",
  );
  await putCompetition(
    {
      ...base,
      updatedAt: editable.updatedAt,
      endsAt: new Date(now - day).toISOString(),
    },
    400,
  );
  await putCompetition(
    { ...base, updatedAt: editable.updatedAt, ageGroupId: restricted.id },
    400,
  );
  const otherDiscipline = disciplines.find(
    (d) => d.id !== disciplineId && d.code === "ROBOTICS",
  );
  await putCompetition(
    {
      ...base,
      updatedAt: editable.updatedAt,
      disciplineId: otherDiscipline.id,
    },
    400,
  );
  const unchanged = await putCompetition({
    ...base,
    updatedAt: editable.updatedAt,
  });
  assert.equal(unchanged.updatedAt, editable.updatedAt);
  assert.equal(
    (await request(`/competitions/${competition.id}`, { role: "federation" }))
      .protocol.status,
    "PUBLISHED",
  );
  const updated = await putCompetition({
    ...base,
    name: "Изменённый турнир",
    venue: "Новая площадка",
    description: "Новое описание",
    regulationUrl: "https://example.test/regulations",
    calendarPlanNumber: "ПЛАН-42",
    season: season + 1,
    updatedAt: editable.updatedAt,
  });
  assert.equal(updated.calendarPlanNumber, "ПЛАН-42");
  const changed = await request(`/competitions/${competition.id}`, {
    role: "federation",
  });
  assert.equal(changed.protocol.status, "DRAFT");
  assert.ok(changed.results.every((r) => r.status === "DRAFT"));
  assert.equal(
    (await request(`/competitions/public/${competition.id}`)).name,
    "Изменённый турнир",
  );
  assert.equal(
    await db.athleteRatingEntry.count({
      where: { competitionId: competition.id },
    }),
    0,
  );
  await putCompetition({ ...base, updatedAt: editable.updatedAt }, 409);
  await putCompetition({ ...base, updatedAt: changed.updatedAt });
  await post("federation", `/competitions/${competition.id}/protocol`);
  assert.ok(
    await db.athleteRatingEntry.count({
      where: { competitionId: competition.id },
    }),
  );
  const audit = await request("/audit-logs?pageSize=100", {
    role: "federation",
  });
  assert.ok(audit.items.some((a) => a.action === "PROTOCOL_PUBLISH"));
  assert.ok(audit.items.every((a) => !a.user?.passwordHash));
  assert.ok(audit.items.some((a) => a.action === "USER_UPDATE"));
  assert.ok(audit.items.some((a) => a.action === "COMPETITION_UPDATE"));
  assert.ok(!JSON.stringify(audit).includes("Changed1234!"));
  assert.ok(!JSON.stringify(audit).includes("passwordHash"));
  await post("athlete", "/auth/logout");
  await request("/auth/me", { role: "athlete", status: 401 });
  console.log(
    `PASS: ${checks} HTTP checks; isolated PostgreSQL schema; auth, roles, applications, deadlines, age, ties, protocol, ratings, awards, team, PDF/XLSX/DOCX, QR, audit.`,
  );
} catch (error) {
  console.error(error);
  if (logs.includes("ERROR")) console.error(logs.slice(-8000));
  process.exitCode = 1;
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
  if (/^fsp_test_\d+$/.test(schema))
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
}
