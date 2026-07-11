// Deterministic "best time to email" calculator (code, not LLM — per the
// fixed-body-in-code rule). Given the COMPANY's IANA timezone, we target the
// start of their local business day (the outreach designer supplies the
// timezone; the math lives here so it can't drift or hallucinate a time).
//
// Rationale: an email that lands at the top of the recipient's workday sits at
// the top of the inbox when they first check it, instead of arriving after
// employees have left the office and being buried by morning.
import { profile } from "@/config/profile";

// The local hour we aim for in the RECIPIENT's timezone — start of the
// business day, when a fresh inbox gets read.
const TARGET_LOCAL_HOUR = 9;

// Format a Date as "HH:mm" wall-clock in a given IANA timezone.
function wallClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// Short timezone abbreviation for a zone at a given instant (e.g. "CEST", "EDT").
function tzAbbrev(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

export type SendWindow = {
  // The send-time value for the Telegram header (the "Send at" label is added by
  // the renderer). E.g. "09:00 IST ( 09:00 GMT+5:30 )" or "~9 AM their local time (HQ unknown)".
  recommendation: string;
};

// Compute when to send so the email lands ~09:00 in the company's local time,
// expressed in the USER's own timezone. `companyTimezone` is an IANA zone
// (e.g. "America/New_York") or "not_found" when the designer couldn't resolve it.
export function computeSendWindow(companyTimezone: string, now: Date): SendWindow {
  if (!companyTimezone || companyTimezone === "not_found") {
    return { recommendation: `~9 AM their local time (HQ unknown)` };
  }

  // Build the next instant that is TARGET_LOCAL_HOUR:00 in the company's zone,
  // then read that same instant back on the user's clock.
  let nowCompanyHM: string;
  try {
    nowCompanyHM = wallClock(now, companyTimezone);
  } catch {
    return { recommendation: `~9 AM their local time (HQ unknown)` };
  }
  const [ch, cm] = nowCompanyHM.split(":").map(Number);
  const minutesUntilTarget =
    (((TARGET_LOCAL_HOUR * 60 - (ch * 60 + cm)) % 1440) + 1440) % 1440;
  const target = new Date(now.getTime() + minutesUntilTarget * 60000);

  const userClock = wallClock(target, profile.timezone);
  const companyClock = wallClock(target, companyTimezone);
  const companyAbbrev = tzAbbrev(target, companyTimezone);

  return {
    recommendation: `${userClock} ${profile.timezoneLabel} ( ${companyClock} ${companyAbbrev} )`,
  };
}
