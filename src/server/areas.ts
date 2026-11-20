import { db, schema } from "@/db";
import type { AreaRow } from "@/db/schema";
import type { AreaDTO } from "@/lib/domain";

export const PESHAWAR_CENTER = { lat: 34.0085, lng: 71.5405 };

export function listAreas(): AreaRow[] {
  return db().select().from(schema.areas).all();
}

export function areaDTO(a: AreaRow): AreaDTO {
  return { id: a.id, nameEn: a.nameEn, nameUr: a.nameUr, lat: a.lat, lng: a.lng };
}

const UR_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const WORD_DIGITS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  ایک: "1", دو: "2", تین: "3", چار: "4", پانچ: "5", چھ: "6", سات: "7",
};

function norm(input: string): string {
  return input
    .toLowerCase()
    .replace(/[۰-۹]/g, (d) => String(UR_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[ًٌٍَُِّْٰ]/g, "") // Arabic diacritics
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[.,،۔\-_/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches whatever the caller / model said to a known area.
 * `strict` only accepts a name that actually appears in the text (used on live
 * transcript lines, where a loose guess would be wrong more often than right).
 */
export function matchArea(input: string | null | undefined, strict = false): AreaRow | null {
  if (!input) return null;
  const text = norm(input);
  if (!text) return null;
  const areas = listAreas();

  // Hayatabad needs its phase number: "حیات آباد فیز تین", "hayatabad phase 3"
  if (text.includes("hayatabad") || text.includes("حیات آباد") || text.includes("حیاتآباد")) {
    let phase: string | null = text.match(/\b([1-7])\b/)?.[1] ?? null;
    if (!phase) {
      for (const [word, digit] of Object.entries(WORD_DIGITS)) {
        if (text.split(" ").includes(word)) {
          phase = digit;
          break;
        }
      }
    }
    const hit = areas.find((a) => a.nameEn === `Hayatabad Phase ${phase ?? "1"}`);
    if (hit && (phase || !strict)) return hit;
  }

  const names = (a: AreaRow) => [a.nameEn, a.nameUr, ...a.aliases].map(norm).filter(Boolean);

  for (const a of areas) if (names(a).includes(text)) return a;

  // Longest name contained in the text wins ("gulbahar gali number 4" -> Gulbahar)
  let best: { area: AreaRow; len: number } | null = null;
  for (const a of areas) {
    for (const n of names(a)) {
      if (n.length >= 3 && text.includes(n) && (!best || n.length > best.len)) {
        best = { area: a, len: n.length };
      }
    }
  }
  if (best) return best.area;
  if (strict) return null;

  // The text is a fragment of a name ("gulba", "charsadda")
  for (const a of areas) {
    if (text.length >= 4 && names(a).some((n) => n.includes(text))) return a;
  }

  // Token overlap as a last resort
  const tokens = new Set(text.split(" ").filter((t) => t.length > 2));
  let scored: { area: AreaRow; score: number } | null = null;
  for (const a of areas) {
    for (const n of names(a)) {
      const nt = n.split(" ").filter((t) => t.length > 2 && t !== "road" && t !== "روڈ");
      const score = nt.filter((t) => tokens.has(t)).length;
      if (score > 0 && (!scored || score > scored.score)) scored = { area: a, score };
    }
  }
  return scored?.area ?? null;
}

/** Nearest known area to a GPS point (used to label GPS / hand-placed tickets). */
export function nearestArea(lat: number, lng: number): AreaRow | null {
  let best: { area: AreaRow; d: number } | null = null;
  for (const a of listAreas()) {
    const d = (a.lat - lat) ** 2 + ((a.lng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (!best || d < best.d) best = { area: a, d };
  }
  return best?.area ?? null;
}

/** Roughly inside greater Peshawar? Guards against a phone reporting a far-away location. */
export function isInPeshawar(lat: number, lng: number): boolean {
  return lat > 33.85 && lat < 34.2 && lng > 71.3 && lng < 71.75;
}
