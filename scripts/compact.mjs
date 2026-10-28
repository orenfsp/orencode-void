import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
process.chdir(root);
if (
  !existsSync("apps/api/dist/main.js") ||
  !existsSync("apps/web/.next/BUILD_ID") ||
  !existsSync("node_modules/.prisma/client")
) {
  throw new Error("Перед оптимизацией выполните npm ci и npm run build.");
}
if (!process.env.npm_execpath)
  throw new Error("Запустите через npm run compact");
const child = spawn(
  process.execPath,
  [
    process.env.npm_execpath,
    "install",
    "--omit=dev",
    "--omit=optional",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  },
);
const [code] = await once(child, "exit");
if (code !== 0) process.exit(code ?? 1);
// Only known, reproducible caches within this project may be removed.
for (const relative of ["node_modules/.cache", "apps/web/.next/cache"]) {
  const target = path.resolve(root, relative);
  if (!existsSync(target)) continue;
  const resolved = realpathSync(target);
  if (!resolved.startsWith(root + path.sep) || resolved !== target)
    throw new Error(`Unsafe cache path: ${target}`);
  rmSync(target, { recursive: true });
}
console.log(
  "Готово: оставлены зависимости запуска. Запуск: npm start. Возврат к разработке и тестам: npm ci.",
);
