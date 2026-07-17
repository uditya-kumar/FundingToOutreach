// Zero-dependency log viewer server.
//   node log-viewer.mjs   →   http://localhost:4500
// Serves log-viewer.html and the NEWEST logs/*.log file (the page polls /log).
import { createServer } from "node:http";
import { readFile, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PORT = 4500;
const LOGS_DIR = new URL("./logs/", import.meta.url);
const HTML = fileURLToPath(new URL("./log-viewer.html", import.meta.url));

async function clearLogs() {
  let files;
  try {
    files = (await readdir(LOGS_DIR)).filter((f) => f.endsWith(".log"));
  } catch {
    return 0;
  }
  await Promise.all(
    files.map((f) => rm(fileURLToPath(new URL(f, LOGS_DIR))).catch(() => {})),
  );
  return files.length;
}

async function newestLog() {
  let files;
  try {
    files = (await readdir(LOGS_DIR)).filter((f) => f.endsWith(".log"));
  } catch {
    return null; // logs/ doesn't exist yet
  }
  if (!files.length) return null;
  files.sort(); // run-<ISO>.log sorts chronologically
  return fileURLToPath(new URL(files[files.length - 1], LOGS_DIR));
}

createServer(async (req, res) => {
  if (req.url === "/clear" && req.method === "POST") {
    const removed = await clearLogs();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ removed }));
  } else if (req.url === "/log") {
    const path = await newestLog();
    const body = path ? await readFile(path, "utf8") : "";
    const name = path ? path.split(/[\\/]/).pop() : "(no log files yet)";
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "x-log-name": name });
    res.end(body);
  } else {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(HTML, "utf8"));
  }
}).listen(PORT, () => console.log(`Log viewer → http://localhost:${PORT}`));
