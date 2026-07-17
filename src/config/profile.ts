// The user profile — the single place to edit who we're scouting for.
//
// The editable VALUES now live in `profile.data.json` (edited via the config UI:
// `npm run config`). This module just loads that JSON and exposes the same typed
// `profile` object plus the derived prompt strings the pipeline already imports —
// so nothing downstream changed.
import profileData from "@/config/profile.data.json" with { type: "json" };

export const profile = profileData;

export type UserProfile = typeof profile;

// ── Prompt-ready strings derived from the profile ──────────────────────────
// First name for greetings/instructions; full name kept in `profile.name`.
export const FIRST_NAME = profile.name.split(" ")[0];

export const PROFILE = `${profile.name} — ${profile.summary}
Evidence: ${profile.evidence.join("; ")}.
Target roles: ${profile.targetRoles.join(" / ")}.`;

export const EDGE_SECTORS = profile.edgeSectors.join(", ") + ".";
export const AVOID_SECTORS = profile.avoidSectors.join(", ") + ".";

// Sign-off line for outreach messages — name + links, all from the profile.
export const SIGNATURE = `Best, ${FIRST_NAME} — GitHub: ${profile.links.github} — LinkedIn: ${profile.links.linkedin}`;
