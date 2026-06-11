import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Navbar from '../components/Navbar'
import TabBar from '../components/TabBar'
import PlatformCredentialsTab from '../components/PlatformCredentialsTab'

interface UserProfile {
  id: number
  name: string | null
  username: string | null
  phone: string | null
}

const inputCls =
  'w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:bg-white transition-colors ' +
  'min-h-11 md:min-h-0 md:py-2 md:rounded-lg'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1.5'

type ProfileTab = 'info' | 'password' | 'platforms'

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'info', label: 'البيانات الشخصية' },
  { id: 'password', label: 'كلمة المرور' },
  { id: 'platforms', label: 'مقيم والغرفة التجارية' },
]

export default function ProfilePage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<ProfileTab>('info')

  const { data: user, isLoading } = useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: () => apiFetch<UserProfile>('/api/auth/me'),
  })

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [editingInfo, setEditingInfo] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')

  function startEditInfo() {
    setName(user?.name ?? '')
    setPhone(user?.phone ?? '')
    setEditingInfo(true)
  }

  function cancelEditInfo() {
    setEditingInfo(false)
  }

  const updateInfo = useMutation({
    mutationFn: (body: { name?: string; phone?: string }) =>
      apiFetch<UserProfile>('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], data)
      setEditingInfo(false)
    },
  })

  const updatePassword = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiFetch<UserProfile>('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
    },
  })

  function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateInfo.mutate({
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    })
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقتين')
      return
    }
    updatePassword.mutate({ currentPassword, newPassword })
  }

  const initials = user?.name
    ? user.name.trim().split(' ').map((w) => w[0]).slice(0, 2).join('')
    : user?.username?.[0]?.toUpperCase() ?? '؟'

  return (
    <div className="min-h-screen bg-gray-50/80">
      <Navbar />

      <main className="mx-auto max-w-2xl px-4 py-6 md:py-5 space-y-5 md:space-y-4 page-enter">
        <div>
          <h2 className="text-xl font-bold text-gray-900">الملف الشخصي</h2>
          <p className="text-sm text-gray-500 mt-0.5">إدارة بياناتك الشخصية</p>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-4 space-y-4">
            <div className="flex items-center gap-4 md:gap-3">
              <div className="w-16 h-16 md:w-10 md:h-10 rounded-full bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Avatar card ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:px-4 md:py-2.5
                            flex items-center gap-4 md:gap-3">
              <div className="shrink-0 w-16 h-16 md:w-10 md:h-10 rounded-2xl md:rounded-lg bg-sky-600 flex items-center justify-center
                              text-white text-2xl md:text-base font-bold select-none shadow-sm shadow-sky-600/30">
                {initials}
              </div>
              <div className="min-w-0 md:flex md:items-baseline md:gap-2">
                <p className="text-lg md:text-sm font-bold text-gray-900 truncate">{user?.name ?? '—'}</p>
                <p className="text-sm md:text-xs text-gray-400 mt-0.5 md:mt-0 font-mono">@{user?.username ?? '—'}</p>
              </div>
            </div>

            <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} ariaLabel="أقسام الملف الشخصي" />

            {/* ── Info card ── */}
            {activeTab === 'info' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-sky-700">البيانات الشخصية</h3>
                {!editingInfo && (
                  <button
                    onClick={startEditInfo}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500
                               hover:text-sky-600 hover:bg-sky-50 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    تعديل
                  </button>
                )}
              </div>

              <div className="p-5 md:p-4">
                {editingInfo ? (
                  <form onSubmit={handleInfoSubmit} className="space-y-4">
                    <div>
                      <label className={labelCls}>الاسم</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="الاسم الكامل" autoFocus className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>الهاتف</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                        placeholder="05xxxxxxxx" className={inputCls} />
                    </div>
                    {updateInfo.isError && (
                      <p className="text-sm text-red-600">
                        {updateInfo.error instanceof Error ? updateInfo.error.message : 'حدث خطأ'}
                      </p>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={cancelEditInfo}
                        className="flex-1 rounded-xl border border-gray-200 bg-white hover:bg-gray-50
                                   text-gray-700 text-sm font-medium py-2.5 min-h-11 transition-colors">
                        إلغاء
                      </button>
                      <button type="submit" disabled={updateInfo.isPending}
                        className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                                   text-white text-sm font-semibold py-2.5 min-h-11 transition-colors">
                        {updateInfo.isPending ? 'جارٍ الحفظ...' : 'حفظ'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="space-y-1">
                    {[
                      { label: 'اسم المستخدم', value: user?.username },
                      { label: 'الاسم', value: user?.name },
                      { label: 'الهاتف', value: user?.phone },
                    ].map(({ label, value }) => (
                      <div key={label}
                        className="flex items-center justify-between py-3 md:py-2.5 border-b border-gray-50 last:border-0">
                        <dt className="text-xs font-medium text-gray-400">{label}</dt>
                        <dd className="text-sm font-semibold text-gray-800">{value ?? '—'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
            )}

            {/* ── Password card ── */}
            {activeTab === 'password' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 md:py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-sky-700">تغيير كلمة المرور</h3>
              </div>
              <div className="p-5 md:p-4">
                <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-3 md:max-w-md">
                  <div>
                    <label className={labelCls}>كلمة المرور الحالية</label>
                    <input type="password" value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>كلمة المرور الجديدة</label>
                    <input type="password" value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required minLength={6} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>تأكيد كلمة المرور</label>
                    <input type="password" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required className={inputCls} />
                  </div>

                  {(passwordError || updatePassword.isError) && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                      <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-red-700">
                        {passwordError || (updatePassword.error instanceof Error
                          ? updatePassword.error.message : 'حدث خطأ')}
                      </p>
                    </div>
                  )}

                  {updatePassword.isSuccess && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
                      <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd" />
                      </svg>
                      <p className="text-sm text-emerald-700 font-medium">تم تغيير كلمة المرور بنجاح</p>
                    </div>
                  )}

                  <button type="submit" disabled={updatePassword.isPending}
                    className="w-full md:w-auto md:px-8 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-60
                               text-white text-sm font-semibold py-3 md:py-2.5 min-h-11 md:min-h-0 transition-colors
                               shadow-sm shadow-sky-500/20">
                    {updatePassword.isPending ? 'جارٍ الحفظ...' : 'تغيير كلمة المرور'}
                  </button>
                </form>
              </div>
            </div>
            )}

            {/* ── Platforms credentials ── */}
            {activeTab === 'platforms' && <PlatformCredentialsTab />}
          </>
        )}
      </main>
    </div>
  )
}
