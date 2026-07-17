// Local config editor — a tiny dependency-free Node server that backs config-ui.html.
//
//   npm run config   →  serves the UI at http://localhost:4321
//
// It reads the editable data (three *.data.json files under src/config) plus the
// .env credentials, and writes them back on Save. JSON is round-tripped with
// JSON.parse/stringify; .env is updated line-by-line so comments and commented-out
// provider options are preserved. Nothing here runs the agent — it only edits config.

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CONFIG_PORT) || 4321;

const PROFILE_JSON = join(ROOT, "src/config/profile.data.json");
const FEEDS_JSON = join(ROOT, "src/config/feeds.data.json");
const TEMPLATES_JSON = join(ROOT, "src/config/emailTemplates.data.json");
const ENV_PATH = join(ROOT, ".env");
const UI_PATH = join(ROOT, "config-ui.html");

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));

// Parse uncommented KEY=VALUE lines from .env into an ORDERED list of pairs,
// preserving file order so the UI renders rows in the same sequence.
function parseEnvPairs(raw) {
  const pairs = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) pairs.push({ key: m[1], value: m[2] });
  }
  return pairs;
}

// Rewrite .env from the UI's full desired pair set:
//   • existing uncommented keys → value replaced in place (position kept)
//   • keys removed in the UI     → their line is dropped
//   • new keys                   → appended at the end
// Comments and commented-out provider blocks (lines starting with #) are untouched.
function rewriteEnv(raw, pairs) {
  // Last value wins if the UI somehow sends a duplicate key.
  const desired = new Map();
  for (const { key, value } of pairs) {
    if (key && key.trim()) desired.set(key.trim(), value ?? "");
  }
  const seen = new Set();
  const out = [];
  // Empty/new file: no existing lines to preserve, so start clean.
  const lines = raw === "" ? [] : raw.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/);
    if (m) {
      const key = m[2];
      if (desired.has(key)) {
        seen.add(key);
        out.push(`${m[1]}${key}${m[3]}${desired.get(key)}`);
      }
      // else: key was removed in the UI → drop this line.
      continue;
    }
    out.push(line); // comment or blank — keep verbatim
  }
  const added = [...desired.keys()].filter((k) => !seen.has(k));
  if (added.length) {
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    for (const k of added) out.push(`${k}=${desired.get(k)}`);
  }
  return out.join("\n");
}

async function readEnvPairs() {
  let raw = "";
  try {
    raw = await readFile(ENV_PATH, "utf8");
  } catch {
    raw = "";
  }
  return parseEnvPairs(raw);
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      return send(res, 200, await readFile(UI_PATH), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && req.url === "/api/config") {
      const [profile, feeds, templates, env] = await Promise.all([
        readJson(PROFILE_JSON),
        readJson(FEEDS_JSON),
        readJson(TEMPLATES_JSON),
        readEnvPairs(),
      ]);
      return send(res, 200, JSON.stringify({ profile, feeds, templates, env }));
    }

    if (req.method === "POST" && req.url === "/api/config") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const { profile, feeds, templates, env } = JSON.parse(Buffer.concat(chunks).toString("utf8"));

      // Write each section only if present, so a partial save can't wipe others.
      if (profile) await writeFile(PROFILE_JSON, JSON.stringify(profile, null, 2) + "\n", "utf8");
      if (feeds) await writeFile(FEEDS_JSON, JSON.stringify(feeds, null, 2) + "\n", "utf8");
      if (templates) await writeFile(TEMPLATES_JSON, JSON.stringify(templates, null, 2) + "\n", "utf8");
      // env is the FULL desired list of {key,value} pairs from the UI: update,
      // add, and remove are all derived from it (rewriteEnv keeps comments).
      // If .env doesn't exist yet it's created here (writeFile creates the file),
      // but only when there's at least one pair to write — so we never leave an
      // empty .env behind just because the section was submitted blank.
      if (Array.isArray(env)) {
        let raw = "";
        let exists = true;
        try {
          raw = await readFile(ENV_PATH, "utf8");
        } catch {
          raw = "";
          exists = false;
        }
        const hasPairs = env.some((p) => p && p.key && p.key.trim());
        if (exists || hasPairs) await writeFile(ENV_PATH, rewriteEnv(raw, env), "utf8");
      }
      return send(res, 200, JSON.stringify({ ok: true }));
    }

    return send(res, 404, JSON.stringify({ error: "not found" }));
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: String(e && e.stack ? e.stack : e).slice(0, 500) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  Config editor → http://localhost:${PORT}\n  Edits save to src/config/*.data.json and .env\n  Press Ctrl+C to stop.\n`);
});
