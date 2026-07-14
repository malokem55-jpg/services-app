// فحص الإنتاج الحيّ — يتحقّق أن الموقع والخادم شغّالان ومربوطان صحيحاً.
// شغّله وقت ما شئت (خصوصاً بعد أي نشر):  pnpm health
//
// يفحص السلسلة كاملة كما يراها المستخدم:
//   1) الموقع الحيّ يفتح ويشير إلى حزمة مبنيّة.
//   2) الحزمة تشير إلى عنوان الخادم الصحيح ولا تحتوي localhost.
//   3) الخادم حيّ:  /api/health = 200.
//   4) الحماية تعمل:  مسار محمي بلا توكن = 401 (وليس 500 أو تعطّل).
//   5) CORS يسمح بنطاق الموقع.
// ينهي بكود خطأ إن فشل أي بند حتى يصلح للأتمتة.

const SITE = 'https://kayan-sys.com'
const API = 'https://hameed-api.mohammedmalik995.workers.dev'

let failed = 0
const ok = (m) => console.log('✅ ' + m)
const bad = (m) => {
  failed++
  console.log('❌ ' + m)
}

async function main() {
  // 1) الموقع الحيّ + استخراج اسم الحزمة
  let bundlePath = ''
  try {
    const res = await fetch(SITE + '/?_=' + Date.now(), { cache: 'no-store' })
    const html = await res.text()
    if (!res.ok) bad(`الموقع لا يفتح (HTTP ${res.status})`)
    const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
    if (m) {
      bundlePath = m[0]
      ok(`الموقع يفتح ويشير إلى ${bundlePath}`)
    } else {
      bad('تعذّر إيجاد حزمة index في صفحة الموقع')
    }
  } catch (e) {
    bad('تعذّر الوصول للموقع: ' + e.message)
  }

  // 2) الحزمة تشير للخادم الصحيح ولا تحتوي localhost
  if (bundlePath) {
    try {
      const js = await fetch(`${SITE}/${bundlePath}`, { cache: 'no-store' }).then((r) => r.text())
      const host = API.replace(/^https?:\/\//, '')
      if (js.includes(host)) ok('الحزمة تشير إلى عنوان الخادم الصحيح')
      else bad(`الحزمة لا تحتوي عنوان الخادم (${host})`)
      if (/localhost:\d+|127\.0\.0\.1/.test(js)) bad('الحزمة تحتوي localhost — ستفشل أونلاين!')
      else ok('الحزمة خالية من localhost')
    } catch (e) {
      bad('تعذّر تحميل الحزمة: ' + e.message)
    }
  }

  // 3) الخادم حيّ
  try {
    const res = await fetch(`${API}/api/health`)
    if (res.ok) ok('الخادم حيّ (/api/health = 200)')
    else bad(`الخادم لا يستجيب لـ /api/health (HTTP ${res.status})`)
  } catch (e) {
    bad('تعذّر الوصول للخادم: ' + e.message)
  }

  // 4) الحماية تعمل (مسار محمي بلا توكن يجب أن يعيد 401)
  try {
    const res = await fetch(`${API}/api/clients`)
    if (res.status === 401) ok('الحماية تعمل (مسار محمي = 401)')
    else bad(`مسار محمي أعاد HTTP ${res.status} بدل 401 — تحقّق من الخادم/قاعدة البيانات`)
  } catch (e) {
    bad('تعذّر اختبار المسار المحمي: ' + e.message)
  }

  // 5) CORS يسمح بنطاق الموقع
  try {
    const res = await fetch(`${API}/api/clients`, {
      method: 'OPTIONS',
      headers: {
        Origin: SITE,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    })
    const allow = res.headers.get('access-control-allow-origin')
    if (allow === '*' || allow === SITE) ok(`CORS يسمح بالموقع (allow-origin: ${allow})`)
    else bad(`CORS لا يسمح بالموقع (allow-origin: ${allow ?? 'غير موجود'})`)
  } catch (e) {
    bad('تعذّر اختبار CORS: ' + e.message)
  }

  console.log('')
  if (failed) {
    console.log(`النتيجة: ❌ فشل ${failed} فحص — المشروع قد يكون متوقفاً.`)
    process.exit(1)
  }
  console.log('النتيجة: ✅ كل الفحوص نجحت — المشروع يعمل بشكل سليم.')
}

main()
