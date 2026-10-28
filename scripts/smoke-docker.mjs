import assert from "node:assert/strict";

// Optional smoke test for the local Docker demo; requires only Node.js.
const base = process.env.SMOKE_URL ?? "http://localhost:3000";
let cookie;
let checks = 0;
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, options.expectedStatus ?? 200, `${path}: HTTP ${response.status}`);
  checks++;
  return response;
}
try {
  const html = await (await request("/")).text();
  const asset = html.match(/src="([^\"]+\/_next\/[^\"]+\.js[^\"]*)"/)?.[1]
    ?? html.match(/src="(\/_next\/[^\"]+\.js[^\"]*)"/)?.[1];
  assert.ok(asset, "The page must reference a built JavaScript asset");
  await request(asset);
  await request("/users");
  await request("/api/disciplines");
  await request("/api/docs");
  await request("/api/users", { expectedStatus: 401 });
  const login = await request("/api/auth/login", {
    method: "POST", expectedStatus: 201,
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify({ email: "federation@fsp-orenburg.demo", password: "Demo1234!" }),
  });
  const setCookie = login.headers.get("set-cookie");
  assert.ok(setCookie?.includes("HttpOnly"));
  cookie = setCookie.split(";")[0];
  assert.equal((await login.json()).data.activeRole, "FEDERATION");
  await request("/api/auth/me");
  const users = (await (await request("/api/users")).json()).data;
  assert.ok(users.length > 0 && users.every(u => !u.passwordHash));
  await request("/api/auth/switch-role", {
    method: "POST", expectedStatus: 403,
    headers: { "Content-Type": "application/json", Origin: "https://untrusted.example" },
    body: JSON.stringify({ role: "FEDERATION" }),
  });
  const competitions = (await (await request("/api/competitions")).json()).data.items;
  const competition = competitions.find(c => c.protocol?.status === "PUBLISHED");
  assert.ok(competition, "Demo must include a published protocol");
  const pdf = Buffer.from(await (await request(`/api/documents/protocol/${competition.id}.pdf`)).arrayBuffer());
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
  const xlsx = Buffer.from(await (await request("/api/documents/headcount.xlsx")).arrayBuffer());
  assert.equal(xlsx.subarray(0, 2).toString(), "PK");
  const teams = (await (await request("/api/national-team")).json()).data;
  assert.ok(teams.length > 0);
  const docx = Buffer.from(await (await request(`/api/documents/national-team/${teams[0].id}.docx`)).arrayBuffer());
  assert.equal(docx.subarray(0, 2).toString(), "PK");
  await request("/api/auth/logout", { method: "POST", expectedStatus: 201, headers: { Origin: base } });
  await request("/api/auth/me", { expectedStatus: 401 });
  cookie = undefined;
  console.log(`PASS: ${checks} Docker HTTP checks: assets, proxy, login, sessions, access control, PDF/XLSX/DOCX.`);
} finally {
  if (cookie) await fetch(`${base}/api/auth/logout`, {
    method: "POST", headers: { Cookie: cookie, Origin: base }, signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}
