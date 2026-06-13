import { useState, type ReactNode } from 'react'
import MalikGate from '../components/malik/MalikGate'
import MobileAccessSection from '../components/malik/MobileAccessSection'
import CredentialsImportSection from '../components/malik/CredentialsImportSection'
import DataImportSection from '../components/malik/DataImportSection'
import MalikPasswordSection from '../components/malik/MalikPasswordSection'

// لوحة تحكم malik: صفحة مخفية تُفتح بالرابط /malik بكلمة مرور واحدة (بلا تسجيل دخول)،
// تجمع أربع أدوات في تبويبات: تشغيل الموقع على الهاتف، حسابات مقيم والغرفة،
// استيراد قاعدة البيانات، وتغيير كلمة مرور اللوحة.

type Tab = 'mobile' | 'credentials' | 'data' | 'password'

// لون مميّز لكل أداة يظهر على الأيقونة في شريط التبويبات
type Accent = 'sky' | 'indigo' | 'rose' | 'emerald'

interface TabDef {
  key: Tab
  label: string
  accent: Accent
  icon: ReactNode
}

const ICON = 'w-5 h-5'

const TABS: TabDef[] = [
  {
    key: 'mobile',
    label: 'تشغيل على الهاتف',
    accent: 'sky',
    icon: (
      <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
  },
  {
    key: 'credentials',
    label: 'حسابات مقيم والغرفة',
    accent: 'indigo',
    icon: (
      <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H9v1.5H7.5v1.5H6v1.5H3.75a.75.75 0 01-.75-.75V18a.75.75 0 01.22-.53l8.69-8.69c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    key: 'data',
    label: 'استيراد قاعدة البيانات',
    accent: 'rose',
    icon: (
      <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
      </svg>
    ),
  },
  {
    key: 'password',
    label: 'كلمة المرور',
    accent: 'emerald',
    icon: (
      <svg className={ICON} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
]

// لون الأيقونة في الحالة غير النشطة (نشطة تأخذ الأبيض على الخلفية الملوّنة)
const ACCENT_TEXT: Record<Accent, string> = {
  sky: 'text-sky-500',
  indigo: 'text-indigo-500',
  rose: 'text-rose-500',
  emerald: 'text-emerald-500',
}

function MalikPanel() {
  const [tab, setTab] = useState<Tab>('mobile')

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">
      {/* ── الترويسة ── */}
      <header
        className="bg-linear-to-bl from-sky-600 to-sky-700 text-white shadow-lg sticky top-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="h-16 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center shrink-0">
              <svg className="w-5.5 h-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-tight">لوحة تحكم malik</h1>
              <p className="text-xs text-sky-100/90 leading-tight">أدوات الإدارة الخاصة بالنظام</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── شريط التبويبات ── */}
      <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-16 z-30">
        <div className="mx-auto max-w-6xl px-3 py-2 flex gap-1.5 overflow-x-auto">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-current={active ? 'page' : undefined}
                className={`group shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold
                            transition-all duration-150 ${
                              active
                                ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/25'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
              >
                <span className={active ? 'text-white' : ACCENT_TEXT[t.accent]}>{t.icon}</span>
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── محتوى التبويب النشط ── */}
      {tab === 'mobile' && <MobileAccessSection />}
      {tab === 'credentials' && <CredentialsImportSection />}
      {tab === 'data' && <DataImportSection />}
      {tab === 'password' && <MalikPasswordSection />}
    </div>
  )
}

export default function MalikPage() {
  return (
    <MalikGate>
      <MalikPanel />
    </MalikGate>
  )
}
