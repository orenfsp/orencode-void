import { spawn } from "node:child_process";
import { once } from "node:events";
const apiOnly = process.argv.includes("--api-only");
const children = [];
const run = (args, cwd) => {
  const child = spawn(process.execPath, args, {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  return child;
};
const compiler = run([
  "node_modules/typescript/bin/tsc",
  "-p",
  "apps/api/tsconfig.json",
]);
const [code] = await once(compiler, "exit");
if (code !== 0) process.exit(code ?? 1);
run([
  "node_modules/typescript/bin/tsc",
  "-p",
  "apps/api/tsconfig.json",
  "--watch",
  "--preserveWatchOutput",
]);
run(["--watch", "apps/api/dist/main.js"]);
if (!apiOnly)
  run(
    ["../../node_modules/next/dist/bin/next", "dev", "--port", "3000"],
    "apps/web",
  );
const stop = () => {
  children.forEach((child) => {
    if (child.exitCode === null) child.kill();
  });
};
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
