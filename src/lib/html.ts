// HTML/XML entity decoding for feed titles.
//
// Catches double-encoded named entities (e.g. a feed shipping "&amp;amp;",
// which an XML parser only unwraps one layer of) and the few named entities
// parsers leave alone. Handles hex (&#x..;), decimal (&#..;), and named forms.
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
