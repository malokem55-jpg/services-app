import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../../lib/api'

// بوابة كلمة مرور لوحة /malik: تطلب كلمة المرور قبل عرض اللوحة.
// أول مرة (لا توجد كلمة مرور) تطلب إنشاء واحدة، وبعدها تطلب إدخالها.

interface MalikStatus {
  hasPassword: boolean
  unlocked: boolean
}

export default function MalikGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<MalikStatus>({
    queryKey: ['malik-status'],
    queryFn: () => apiFetch<MalikStatus>('/api/malik/status'),
  })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (data.unlocked) return <>{children}</>

  const isSetup = !data.hasPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 4) {
      setError('كلمة المرور قصيرة جدًا (4 أحرف على الأقل)')
      return
    }
    if (isSetup && password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    setSubmitting(true)
    try {
      const { token } = await apiFetch<{ token: string }>(
        isSetup ? '/api/malik/setup' : '/api/malik/unlock',
        { method: 'POST', body: JSON.stringify({ password }) },
      )
      localStorage.setItem('malikToken', token)
      setPassword('')
      setConfirm('')
      await qc.invalidateQueries({ queryKey: ['malik-status'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر الدخول')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 flex items-center justify-center px-6">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-900/5 p-8 space-y-5">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-linear-to-bl from-sky-500 to-sky-600 text-white
                          flex items-center justify-center shadow-lg shadow-sky-500/30">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {isSetup ? 'أنشئ كلمة مرور للوحة' : 'لوحة تحكم malik'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isSetup ? 'اختر كلمة مرور لحماية اللوحة، تستطيع تغييرها لاحقًا' : 'أدخل كلمة المرور للدخول'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            autoFocus
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                       focus:bg-white transition-colors min-h-11"
          />
          {isSetup && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="تأكيد كلمة المرور"
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                         focus:bg-white transition-colors min-h-11"
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm font-semibold py-3 min-h-11
                       transition-colors shadow-sm shadow-sky-600/20"
          >
            {submitting ? '...' : isSetup ? 'إنشاء كلمة المرور والدخول' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
