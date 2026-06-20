import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Zero-dependency run logger. Writes a timestamped trace file under logs/ AND
// tees to the console. Uses SYNCHRONOUS appends so the trace survives a crash
// mid-run (the last lines are the ones you need when debugging a failure).

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_DIR = new URL("../../logs/", import.meta.url);
mkdirSync(LOG_DIR, { recursive: true });
const LOG_URL = new URL(`run-${stamp}.log`, LOG_DIR);
const LOG_PATH = fileURLToPath(LOG_URL);

type Level = "INFO" | "WARN" | "ERROR" | "DATA";

function write(level: Level, scope: string, msg: string): void {
  const line = `${new Date().toISOString()} ${level.padEnd(5)} [${scope}] ${msg}`;
  appendFileSync(LOG_PATH, line + "\n");
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
}

export const log = {
  path: LOG_PATH,
  info: (scope: string, msg: string) => write("INFO", scope, msg),
  warn: (scope: string, msg: string) => write("WARN", scope, msg),
  error: (scope: string, msg: string) => write("ERROR", scope, msg),

  // Dump a structured handoff. FULL JSON goes to the file (for inspection);
  // only a one-line summary is teed to the console to keep it readable.
  data: (scope: string, name: string, obj: unknown) => {
    const json = JSON.stringify(obj, null, 2);
    appendFileSync(LOG_PATH, `${new Date().toISOString()} DATA  [${scope}] ${name}:\n${json}\n`);
    const count = Array.isArray(obj) ? `${obj.length} items` : "object";
    console.log(`${new Date().toISOString()} DATA  [${scope}] ${name} (${count}, full JSON in log)`);
  },
};

log.info("logger", `trace → ${LOG_PATH}`);
