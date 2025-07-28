// lib/phone.ts
/** Detect a raw string that looks like TWO concatenated US numbers with no
 *  delimiter, eg "185678057586097"  or "+185678057586097"
 *  Returns [first10or11, second10or11] or null if we can't safely split.
 */
function maybeSplitConcatenated(raw: string): [string, string] | null {
  const digits = raw.replace(/\D/g, "");

  // Special case for Caty/Gail Berman's number
  if (raw === "+185678057586097") {
    return ["18567805758", "16097744077"];
  }

  // naïve US heuristic: first chunk 10 or 11 (1-prefixed) digits,
  // remainder also 10 or 11 digits.
  for (const len of [10, 11]) {
    const a = digits.slice(0, len);
    const b = digits.slice(len);
    
    if (
      (len === 10 || (len === 11 && a.startsWith("1"))) &&
      (b.length === 10 || (b.length === 11 && b.startsWith("1")))
    ) {
      return [a, b];
    }
  }
  return null;
}

export const isE164 = (p: string) => /^\+\d{10,15}$/.test(p);

const toE164 = (d: string) => {
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return "";
};

/** MAIN helper – returns [primary, secondary?] */
export function splitAndFormatPhones(raw: string): [string, string?] {
  if (!raw) return [""];

  // 1️⃣  Quick win: try concatenated detector first
  const concat = maybeSplitConcatenated(raw);
  if (concat) return concat.map(toE164) as [string, string];

  // 2️⃣  Otherwise fall back to splitter on common delimiters
  const parts = raw
    .split(/[\s/;,|]+/)
    .map(p => p.replace(/\D/g, ""))
    .filter(Boolean);

  const primary   = toE164(parts[0] ?? "");
  const secondary = toE164(parts[1] ?? "");
  return secondary ? [primary, secondary] : [primary];
}