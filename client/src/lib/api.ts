export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken(): string | null {
  return localStorage.getItem('token')
}

// رمز لوحة /malik (منفصل عن تسجيل دخول المستخدم) — يُرسَل في ترويسة X-Malik-Token
// عند وجوده فتعمل نقاط اللوحة المحمية بكلمة مرورها بلا تسجيل دخول.
function getMalikToken(): string | null {
  return localStorage.getItem('malikToken')
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const malikToken = getMalikToken()
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(malikToken ? { 'X-Malik-Token': malikToken } : {}),
        ...init?.headers,
      },
    })
  } catch {
    // فشل الاتصال بالشبكة قبل وصول الطلب للخادم
    throw new Error('لا يوجد اتصال بالإنترنت، تحقق من الشبكة وحاول مجدداً')
  }
  if (res.status === 401 && token) {
    // الجلسة منتهية: احذف التوكن وارجع لصفحة الدخول
    localStorage.removeItem('token')
    window.location.replace('/login')
    throw new Error('انتهت الجلسة، يرجى تسجيل الدخول من جديد')
  }
  if (!res.ok) {
    let message = `خطأ ${res.status}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}
