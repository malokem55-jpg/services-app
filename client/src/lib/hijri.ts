/**
 * Hijri ↔ Gregorian conversion utilities using the Umm al-Qura calendar
 * (the official calendar of Saudi Arabia).
 */

/** Convert a Gregorian date string (YYYY-MM-DD or full ISO) to Hijri components. */
export function gregorianToHijri(
  dateStr: string,
): { year: number; month: number; day: number } | null {
  if (!dateStr) return null
  // Normalise: take only the YYYY-MM-DD part so full ISO strings don't break the constructor
  const normalized = dateStr.slice(0, 10)
  const date = new Date(normalized + 'T00:00:00Z')
  if (isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date)

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0')

  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Convert a Hijri date (Umm al-Qura) to a Gregorian date string (YYYY-MM-DD).
 *
 * Strategy: compute an approximate Julian Day Number using the tabular Islamic
 * calendar algorithm, convert to Gregorian, then verify ±2 days using the Intl
 * API (which implements the actual Umm al-Qura rules) and nudge if needed.
 */
export function hijriToGregorian(
  year: number,
  month: number,
  day: number,
): string | null {
  if (!year || !month || !day) return null

  // Tabular Islamic calendar → Julian Day Number
  const jdn =
    Math.floor((11 * year + 3) / 30) +
    354 * year +
    30 * month -
    Math.floor((month - 1) / 2) +
    day +
    1948440 -
    385

  // Julian Day Number → Gregorian
  let p = jdn + 68569
  const q = Math.floor((4 * p) / 146097)
  p = p - Math.floor((146097 * q + 3) / 4)
  const y = Math.floor((4000 * (p + 1)) / 1461001)
  p = p - Math.floor((1461 * y) / 4) + 31
  const m = Math.floor((80 * p) / 2447)
  const d = p - Math.floor((2447 * m) / 80)
  const n = Math.floor(m / 11)
  const gMonth = m + 2 - 12 * n
  const gYear = 100 * (q - 49) + y + n

  // Check ±2 days and pick the one that Intl API confirms
  const base = new Date(Date.UTC(gYear, gMonth - 1, d))
  for (let delta = -2; delta <= 2; delta++) {
    const testDate = new Date(base.getTime() + delta * 86400000)
    const testStr = toIsoDateStr(testDate)
    const hijri = gregorianToHijri(testStr)
    if (hijri && hijri.year === year && hijri.month === month && hijri.day === day) {
      return testStr
    }
  }

  // Fallback to the tabular result if no Intl match found
  return [
    String(gYear),
    String(gMonth).padStart(2, '0'),
    String(d).padStart(2, '0'),
  ].join('-')
}

/** Format a Gregorian date string (YYYY-MM-DD or full ISO) as "1445-08-15 هـ / 2024-03-25" */
export function formatBothDates(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Normalise: slice to YYYY-MM-DD so full ISO strings (e.g. "2025-03-25T00:00:00.000Z")
  // don't produce "Invalid Date" when appending T00:00:00Z again
  const dateStr = iso.slice(0, 10)
  const hijri = new Date(dateStr + 'T00:00:00Z')
    .toLocaleDateString('ar-SA-u-ca-islamic-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    })
    .replace(/\//g, '-')
  return `${hijri} هـ / ${dateStr}`
}

/** Arabic names of the Hijri months (1-indexed). */
export const HIJRI_MONTHS = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
] as const

// ─── Internal helper ──────────────────────────────────────────────────────────

function toIsoDateStr(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}
