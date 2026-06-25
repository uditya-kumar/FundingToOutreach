// Step 7 send-half: deliver the rendered daily report to Telegram.
//
// Deterministic side-effect, kept OUT of the subagent — the agent only RENDERS
// the message text; code performs the irreversible send (CLAUDE.md: Step 7 stays
// in the orchestrator). `report.md` is written BEFORE this runs, so the artifact
// survives any transport failure (Rule 5). Never throws: returns a result the
// caller logs, so a Telegram outage can't sink a successful run.

export type SendResult =
  | { ok: true; status: number }
  | { ok: false; status?: number; error: string };

export async function sendTelegramMessage(markdown: string): Promise<SendResult> {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) {
    return { ok: false, error: "BOT_TOKEN / CHAT_ID not set in environment" };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendRichMessage`;
  const payload = {
    chat_id: CHAT_ID,
    rich_message: { markdown },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: body.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 300) };
  }
}
