// Rules for the copy that speaks about the museum's closure. The museum closed for good on the day
// in data/closure.json: the copy is in the past tense, names no reopening, no works, no partner event, no quarantine
// and no date other than the closing day. This file has no imports so that the build and the Node test use the very
// same rules (scripts/test-closure-copy.mjs).

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9,
  octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10,
  november: 11, december: 12,
  janeiro: 1, fevereiro: 2, marco: 3, maio: 5, junho: 6, julho: 7, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// Matched against the lower-cased text without accents.
export const PROHIBITED: ReadonlyArray<readonly [string, RegExp]> = [
  ['reopening', /reabr|reapertura|reabertura|reopen|volvera a abrir|will (?:re)?open|voltara a abrir/],
  ['works or renovation', /remodel|reform|renovat|obras en|under construction/],
  ['quarantine', /cuarentena|quarantine|quarentena/],
  ['vague future', /pronto|\bsoon\b|em breve|proxim|\bnext\b|provisional|tentativ/],
];

const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** The date rules: the only date the closure copy may name is the closing day itself. */
function datesIn(text: string): Array<{ month: number; day: number; raw: string }> {
  const t = strip(text);
  const names = Object.keys(MONTHS).join('|');
  const out: Array<{ month: number; day: number; raw: string }> = [];
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})\\s*(?:de|of)?\\s*(${names})\\b`, 'g'))) {
    out.push({ day: Number(m[1]), month: MONTHS[m[2]], raw: m[0] });
  }
  for (const m of t.matchAll(new RegExp(`\\b(${names})\\s+(\\d{1,2})\\b`, 'g'))) {
    out.push({ day: Number(m[2]), month: MONTHS[m[1]], raw: m[0] });
  }
  for (const m of t.matchAll(/\b\d{4}-(\d{2})-(\d{2})\b/g)) {
    out.push({ day: Number(m[2]), month: Number(m[1]), raw: m[0] });
  }
  return out;
}

/** Why a closure sentence must not be published: an empty list means it is fine. `closedOn` is YYYY-MM-DD. */
export function closureCopyViolations(text: string, closedOn: string): string[] {
  const t = strip(text);
  const found: string[] = [];
  for (const [name, re] of PROHIBITED) if (re.test(t)) found.push(name);
  const [, month, day] = closedOn.split('-').map(Number);
  for (const d of datesIn(text)) {
    if (d.month !== month || d.day !== day) found.push(`a date other than the closing day (${d.raw})`);
  }
  return found;
}
