import { useState, useEffect, useRef } from 'react'
import { gregorianToHijri, hijriToGregorian, HIJRI_MONTHS, formatBothDates } from '../lib/hijri'

interface Props {
  value: string
  onChange: (gregorianDate: string) => void
  defaultMode?: 'hijri' | 'gregorian'
  hasError?: boolean
}

// Week headers: Saturday-first (matches Arabic calendar convention)
const WEEK_HEADERS = ['س', 'ج', 'خ', 'ر', 'ث', 'ن', 'ح'] // Sa Fr Th We Tu Mo Su

const GREGORIAN_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

function isoDateDow(isoDate: string): number {
  return new Date(isoDate + 'T00:00:00Z').getUTCDay()
}

function daysInGregorianMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function daysInHijriMonth(year: number, month: number): number {
  const first = hijriToGregorian(year, month, 1)
  const nm = month === 12 ? 1 : month + 1
  const ny = month === 12 ? year + 1 : year
  const next = hijriToGregorian(ny, nm, 1)
  if (!first || !next) return 30
  return Math.round(
    (new Date(next + 'T00:00:00Z').getTime() - new Date(first + 'T00:00:00Z').getTime()) / 86400000,
  )
}

// Saturday-first offset: (6 - firstDow + 7) % 7
function buildCells(firstDow: number, totalDays: number): (number | null)[] {
  const offset = (6 - firstDow + 7) % 7
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function HijriDateInput({ value, onChange, defaultMode = 'hijri', hasError = false }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'hijri' | 'gregorian'>(defaultMode)
  const [viewYear, setViewYear] = useState(0)
  const [viewMonth, setViewMonth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function resolveView(m: 'hijri' | 'gregorian') {
    const src = value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10)
    if (m === 'hijri') {
      const h = gregorianToHijri(src)
      return h ? { year: h.year, month: h.month } : { year: 1447, month: 1 }
    }
    const d = new Date(src + 'T00:00:00Z')
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 }
  }

  function openPicker() {
    const v = resolveView(mode)
    setViewYear(v.year)
    setViewMonth(v.month)
    setOpen(true)
  }

  function switchMode(m: 'hijri' | 'gregorian') {
    const v = resolveView(m)
    setViewYear(v.year)
    setViewMonth(v.month)
    setMode(m)
  }

  function navigate(delta: number) {
    let m = viewMonth + delta
    let y = viewYear
    if (m < 1) { m = 12; y-- }
    else if (m > 12) { m = 1; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  function selectDay(day: number) {
    if (mode === 'hijri') {
      const g = hijriToGregorian(viewYear, viewMonth, day)
      onChange(g ?? '')
    } else {
      onChange(`${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    }
    setOpen(false)
  }

  function isSelected(day: number): boolean {
    if (!value) return false
    if (mode === 'hijri') {
      const h = gregorianToHijri(value.slice(0, 10))
      return !!(h && h.year === viewYear && h.month === viewMonth && h.day === day)
    }
    const d = new Date(value.slice(0, 10) + 'T00:00:00Z')
    return d.getUTCFullYear() === viewYear && d.getUTCMonth() + 1 === viewMonth && d.getUTCDate() === day
  }

  const cells = (() => {
    if (!open) return []
    if (mode === 'hijri') {
      const first = hijriToGregorian(viewYear, viewMonth, 1)
      const dow = first ? isoDateDow(first) : 0
      return buildCells(dow, daysInHijriMonth(viewYear, viewMonth))
    }
    const firstIso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`
    return buildCells(isoDateDow(firstIso), daysInGregorianMonth(viewYear, viewMonth))
  })()

  const monthLabel = open
    ? mode === 'hijri'
      ? `${HIJRI_MONTHS[viewMonth - 1]} ${viewYear}`
      : `${GREGORIAN_MONTHS_AR[viewMonth - 1]} ${viewYear}`
    : ''

  const displayValue = value ? formatBothDates(value) : null

  return (
    <div ref={ref} className="relative">
      {/* Trigger: shows both dates or placeholder */}
      <button
        type="button"
        onClick={openPicker}
        className={`w-full text-right rounded-xl border ${hasError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-sky-500 focus:border-sky-500'}
          bg-gray-50 px-3 py-2.5 text-sm min-h-11 hover:bg-white transition-colors
          focus:outline-none focus:ring-2`}
      >
        {displayValue
          ? <span className="text-gray-800 font-medium tracking-wide">{displayValue}</span>
          : <span className="text-gray-400">اختر التاريخ</span>
        }
      </button>

      {/* Calendar popover */}
      {open && (
        <div className="absolute z-50 mt-1.5 right-0 w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 select-none">

          {/* Mode toggle */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3 text-xs">
            <button
              type="button"
              onClick={() => switchMode('hijri')}
              className={`flex-1 py-1.5 font-semibold transition-colors ${
                mode === 'hijri' ? 'bg-sky-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >هجري</button>
            <button
              type="button"
              onClick={() => switchMode('gregorian')}
              className={`flex-1 py-1.5 font-semibold transition-colors border-r border-gray-200 ${
                mode === 'gregorian' ? 'bg-sky-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >ميلادي</button>
          </div>

          {/* Month navigation — ltr so ‹ is left=prev, › is right=next */}
          <div className="flex items-center justify-between mb-2 px-1" dir="ltr">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none"
            >‹</button>
            <span className="text-sm font-bold text-gray-800">{monthLabel}</span>
            <button
              type="button"
              onClick={() => navigate(1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none"
            >›</button>
          </div>

          {/* Week headers + day grid — ltr for correct column order */}
          <div dir="ltr">
            <div className="grid grid-cols-7 mb-1">
              {WEEK_HEADERS.map((h, i) => (
                <div key={i} className="text-center text-xs font-semibold text-gray-400 py-1">{h}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((day, i) => (
                <div key={i} className="flex items-center justify-center py-0.5">
                  {day ? (
                    <button
                      type="button"
                      onClick={() => selectDay(day)}
                      className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                        isSelected(day)
                          ? 'bg-sky-500 text-white'
                          : 'text-gray-700 hover:bg-sky-50 hover:text-sky-600'
                      }`}
                    >{day}</button>
                  ) : (
                    <div className="w-8 h-8" />
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
