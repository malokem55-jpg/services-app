import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import Logo from '../components/Logo'

interface LoginResponse {
  token: string
}

async function loginRequest(body: { username: string; password: string }): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      localStorage.setItem('token', data.token)
      navigate('/')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ username, password })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0c5a8c 0%, #1a9fd4 40%, #0a4a73 100%)' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -inset-s-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -inset-e-32 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 inset-e-10 w-40 h-40 rounded-full bg-white/4" />
      </div>

      <div className="w-full max-w-sm relative page-enter">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-2xl p-4 shadow-xl mb-5">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">مكتب الخدمات</h1>
          <p className="text-sky-200 text-sm mt-1.5">سجّل دخولك للمتابعة</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl px-6 py-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                اسم المستخدم
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 inset-e-0 pe-3.5 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pe-10 ps-4 py-3 text-gray-900
                             placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500
                             focus:border-sky-500 focus:bg-white transition-all min-h-12"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 inset-e-0 pe-3.5 flex items-center pointer-events-none text-gray-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 pe-10 ps-4 py-3 text-gray-900
                             placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500
                             focus:border-sky-500 focus:bg-white transition-all min-h-12"
                />
              </div>
            </div>

            {/* Error message */}
            {mutation.isError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3"
              >
                <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-700 leading-snug">
                  {mutation.error instanceof Error
                    ? mutation.error.message
                    : 'حدث خطأ غير متوقع، حاول مرة أخرى'}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700
                         disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-bold text-sm py-3.5 min-h-13
                         shadow-lg shadow-sky-500/30
                         transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
            >
              {mutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  جارٍ الدخول...
                </span>
              ) : (
                'دخول'
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  )
}
