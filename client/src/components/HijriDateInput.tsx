import { useState, useEffect } from 'react'
import { gregorianToHijri, hijriToGregorian, HIJRI_MONTHS } from '../lib/hijri'

interface Props {
  /** Canonical value: Gregorian date string (YYYY-MM-DD) or empty string. */
  value: string
  /** Called with a Gregorian date string (YYYY-MM-DD) or '' when cleared. */
  onChange: (gregorianDate: string) => void
  /** Default calendar mode shown to the user. Defaults to 'hijri'. */
  defaultMode?: 'hijri' | 'gregorian'
  /** Highlight input borders in red when true. */
  hasError?: boolean
}

// ── Hijri year range: 1430–1460 H  (~2009–2039 G) ──────────────────────────
const HIJRI_YEARS = Array.from({ length: 31 }, (_, i) => 1430 + i)
const HIJRI_DAYS = Array.from({ length: 30 }, (_, i) => i + 1)

// ── Shared CSS helpers ───────────────────────────────────────────────────────
const BASE =
  'rounded-xl border bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:bg-white transition-colors min-h-11'
const OK_RING = 'border-gray-300 focus:ring-sky-500 focus:border-sky-500'
const ERR_RING = 'border-red-400 focus:ring-red-400 focus:border-red-400'

export default function HijriDateInput({
  value,
  onChange,
  defaultMode = 'hijri',
  hasError = false,
}: Props) {
  const [mode, setMode] = useState<'hijri' | 'gregorian'>(defaultMode)
  const [hy, setHy] = useState('')
  const [hm, setHm] = useState('')
  const [hd, setHd] = useState('')

  // Sync hijri dropdowns whenever the external value changes (e.g. edit-form load)
  useEffect(() => {
    if (mode === 'hijri' && value) {
      const h = gregorianToHijri(value)
      if (h) {
        setHy(String(h.year))
        setHm(String(h.month))
        setHd(String(h.day))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // ── mode switches ──────────────────────────────────────────────────────────

  function switchToHijri() {
    if (value) {
      const h = gregorianToHijri(value)
      if (h) {
        setHy(String(h.year))
        setHm(String(h.month))
        setHd(String(h.day))
      }
    }
    setMode('hijri')
  }

  function switchToGregorian() {
    setMode('gregorian')
  }

  // ── hijri change handler ───────────────────────────────────────────────────

  function emitHijri(newHy: string, newHm: string, newHd: string) {
    const y = parseInt(newHy)
    const m = parseInt(newHm)
    const d = parseInt(newHd)
    if (y && m && d) {
      const gregorian = hijriToGregorian(y, m, d)
      onChange(gregorian ?? '')
    } else {
      onChange('')
    }
  }

  const ring = hasError ? ERR_RING : OK_RING

  return (
    <div className="space-y-1.5">
      {/* ── mode toggle ── */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden w-fit text-xs">
        <button
          type="button"
          onClick={switchToHijri}
          className={`px-3 py-1.5 font-semibold transition-colors ${
            mode === 'hijri'
              ? 'bg-sky-500 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          هجري
        </button>
        <button
          type="button"
          onClick={switchToGregorian}
          className={`px-3 py-1.5 font-semibold transition-colors border-r border-gray-200 ${
            mode === 'gregorian'
              ? 'bg-sky-500 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          ميلادي
        </button>
      </div>

      {/* ── input ── */}
      {mode === 'gregorian' ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full ${BASE} ${ring}`}
        />
      ) : (
        // Hijri: day | month | year dropdowns (RTL order: day first)
        <div className="grid grid-cols-3 gap-2">
          {/* Day */}
          <select
            value={hd}
            onChange={(e) => {
              setHd(e.target.value)
              emitHijri(hy, hm, e.target.value)
            }}
            className={`${BASE} ${ring}`}
          >
            <option value="">اليوم</option>
            {HIJRI_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* Month */}
          <select
            value={hm}
            onChange={(e) => {
              setHm(e.target.value)
              emitHijri(hy, e.target.value, hd)
            }}
            className={`${BASE} ${ring}`}
          >
            <option value="">الشهر</option>
            {HIJRI_MONTHS.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name}
              </option>
            ))}
          </select>

          {/* Year */}
          <select
            value={hy}
            onChange={(e) => {
              setHy(e.target.value)
              emitHijri(e.target.value, hm, hd)
            }}
            className={`${BASE} ${ring}`}
          >
            <option value="">السنة</option>
            {HIJRI_YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
