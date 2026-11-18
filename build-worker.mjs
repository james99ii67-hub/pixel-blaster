import { readFile, mkdir, writeFile } from "node:fs/promises";

const [html, css, js, worker] = await Promise.all(
  ["index.html", "style.css", "game.js", "worker.mjs"].map(path => readFile(path, "utf8"))
);
await mkdir("dist/server", { recursive: true });
await writeFile("dist/server/index.js",
  worker + "\nexport default createGameWorker(" + JSON.stringify({ html, css, js }) + ");\n");
