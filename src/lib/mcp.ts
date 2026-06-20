import type { z } from "zod";

// Shared helper for SDK MCP tool return values.
//
// Tools return COMPACT JSON only — that string is the entire payload the agent
// sees, so no pretty-print whitespace and no surrounding prose.
//
// Pass a zod schema to VALIDATE the data before returning: the tool then can
// never emit a malformed structure to the agent (the tool→agent handover is
// guaranteed typed). On mismatch it throws, surfacing the bug at the source
// rather than handing the agent garbage.
export function jsonResult<T>(data: T, schema?: z.ZodType<T>) {
  const validated = schema ? schema.parse(data) : data;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(validated) }],
  };
}
