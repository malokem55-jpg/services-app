import { useState } from 'react'
import { apiFetch } from '../../lib/api'

// قسم «كلمة المرور» داخل لوحة malik: تغيير كلمة مرور اللوحة بعد الدخول.

export default function MalikPasswordSection() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (password.length < 4) {
      setError('كلمة المرور قصيرة جدًا (4 أحرف على الأقل)')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    setSubmitting(true)
    try {
      const { token } = await apiFetch<{ token: string }>('/api/malik/password', {
        method: 'PUT',
        body: JSON.stringify({ password }),
      })
      // إعادة إصدار الرمز حتى تبقى الجلسة سارية بعد التغيير
      localStorage.setItem('malikToken', token)
      setPassword('')
      setConfirm('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تغيير كلمة المرور')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 page-enter">
      <div>
        <h2 className="text-xl font-bold text-gray-900">كلمة مرور اللوحة</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          غيّر كلمة المرور المستخدمة للدخول إلى هذه اللوحة
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit} className="p-5 md:p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              كلمة المرور الجديدة
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور الجديدة"
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                         focus:bg-white transition-colors min-h-11"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              تأكيد كلمة المرور
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="أعد كتابة كلمة المرور"
              className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                         focus:bg-white transition-colors min-h-11"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {done && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-emerald-700">تم تغيير كلمة المرور بنجاح</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50
                       disabled:cursor-not-allowed text-white text-sm font-semibold py-3 min-h-11
                       transition-colors shadow-sm shadow-sky-600/20"
          >
            {submitting ? '...' : 'حفظ كلمة المرور الجديدة'}
          </button>
        </form>
      </div>
    </main>
  )
}
