// السنة الهجرية بتقويم أم القرى — رصيد كروت العمل يتجدد مع بداية كل سنة هجرية
const hijriYearFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  year: 'numeric',
  timeZone: 'Asia/Riyadh',
});

export function hijriYearOf(date: Date): number {
  const part = hijriYearFormatter.formatToParts(date).find((p) => p.type === 'year');
  const year = Number(part?.value);
  if (!Number.isInteger(year)) {
    throw new Error(`Failed to compute Hijri year for ${date.toISOString()}`);
  }
  return year;
}

export function currentHijriYear(): number {
  return hijriYearOf(new Date());
}
