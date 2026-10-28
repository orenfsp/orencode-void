import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
process.chdir(root);
if (
  !existsSync("apps/api/dist/main.js") ||
  !existsSync("apps/web/.next/BUILD_ID")
) {
  console.error("Сначала выполните npm ci и npm run build.");
  process.exit(1);
}
const children = [
  spawn(process.execPath, ["apps/api/dist/main.js"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  }),
  spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "apps/web", "--port", "3000"],
    { cwd: root, stdio: "inherit", windowsHide: true },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) {
  child.on("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code) => stop(code ?? 0));
}
