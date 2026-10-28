import { spawn } from "node:child_process";
import { once } from "node:events";

// Encode credentials so passwords containing @, : or / work too.
const { PGUSER, PGPASSWORD, PGDATABASE, PGHOST = "postgres", PGPORT = "5432" } = process.env;
if (!PGUSER || !PGPASSWORD || !PGDATABASE) throw new Error("PGUSER, PGPASSWORD and PGDATABASE are required");
process.env.DATABASE_URL = `postgresql://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD)}@${PGHOST}:${PGPORT}/${encodeURIComponent(PGDATABASE)}?schema=public`;

let child;
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child?.kill(signal));
async function run(args) {
  child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
  const [code, signal] = await once(child, "exit");
  if (code !== 0) process.exit(code ?? (signal ? 1 : 0));
}
switch (process.argv[2]) {
  case "init":
    await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
    if (process.env.SEED_DEMO === "true") await run(["seed-dist/prisma/seed.js"]);
    break;
  case "api":
    await run(["apps/api/dist/main.js"]);
    break;
  default:
    throw new Error("Expected init or api");
}
