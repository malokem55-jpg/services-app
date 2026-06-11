// التواصل مع إضافة Chrome (مساعد تسجيل الدخول):
// جسر content script للإضافة يستمع لرسائل window.postMessage على صفحات التطبيق،
// فلا نحتاج معرّف الإضافة (Extension ID) إطلاقًا.

const REQUEST_TYPE = 'SA_LOGIN_FILL_REQUEST'
const ACK_TYPE = 'SA_LOGIN_FILL_ACK'
const ACK_TIMEOUT_MS = 700

export interface FillRequest {
  url: string
  username: string
  password: string
}

// يرسل طلب فتح + تعبئة للإضافة. يرجع true لو الإضافة استلمت الطلب،
// و false لو لم ترد (غير مثبتة) — عندها نفتح الصفحة فقط بدون تعبئة.
export function openLoginWithExtension(req: FillRequest): Promise<boolean> {
  return new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage)
      window.open(req.url, '_blank', 'noopener')
      resolve(false)
    }, ACK_TIMEOUT_MS)

    function onMessage(e: MessageEvent) {
      if (e.source !== window) return
      if (e.data?.type === ACK_TYPE && e.data?.requestId === requestId) {
        clearTimeout(timer)
        window.removeEventListener('message', onMessage)
        resolve(true)
      }
    }

    window.addEventListener('message', onMessage)
    window.postMessage({ type: REQUEST_TYPE, requestId, ...req }, window.location.origin)
  })
}
