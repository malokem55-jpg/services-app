// حارس البناء — يمنع نشر نسخة معطوبة.
// السبب الجذري لعطل سابق: بُنيت الواجهة بلا VITE_API_URL فأشارت إلى http://localhost:3000،
// فلم تجلب أي بيانات أونلاين. هذا السكربت يفشل البناء فوراً إن تكرر ذلك.
//
// يُشغَّل تلقائياً بعد `vite build` (انظر سكربت build في package.json).

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(clientDir, 'dist')
const assetsDir = join(distDir, 'assets')

const errors = []

// 1) لا بد أن يحدّد .env.production عنوان الخادم، وألا يكون localhost.
let expectedApi = ''
try {
  const envProd = readFileSync(join(clientDir, '.env.production'), 'utf8')
  const match = envProd.match(/^\s*VITE_API_URL\s*=\s*["']?([^"'\r\n]+)/m)
  expectedApi = match ? match[1].trim() : ''
} catch {
  errors.push('الملف .env.production غير موجود — يجب أن يحتوي VITE_API_URL لعنوان الخادم.')
}
if (!expectedApi) {
  errors.push('VITE_API_URL غير معرّف في .env.production.')
} else if (/localhost|127\.0\.0\.1/.test(expectedApi)) {
  errors.push(`VITE_API_URL يشير إلى جهاز محلي (${expectedApi}) — لن يعمل أونلاين.`)
}

// 2) افحص كل ملفات JS المبنيّة.
let jsFiles = []
try {
  jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
} catch {
  errors.push('مجلد dist/assets غير موجود — لم يكتمل البناء؟')
}

const allJs = jsFiles.map((f) => readFileSync(join(assetsDir, f), 'utf8')).join('\n')

// 2أ) يجب ألا يظهر localhost في أي حزمة.
if (/localhost:3000|localhost:\d+|127\.0\.0\.1/.test(allJs)) {
  errors.push('النسخة المبنيّة تحتوي على عنوان localhost — الواجهة ستفشل في جلب البيانات أونلاين.')
}

// 2ب) يجب أن يظهر عنوان الخادم المتوقَّع في الحزمة.
if (expectedApi) {
  const host = expectedApi.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (host && !allJs.includes(host)) {
    errors.push(`عنوان الخادم (${host}) غير موجود في النسخة المبنيّة — تحقّق من VITE_API_URL.`)
  }
}

// 3) index.html موجود ويشير إلى حزمة مجزّأة (hashed).
try {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8')
  if (!/assets\/index-[A-Za-z0-9_-]+\.js/.test(html)) {
    errors.push('index.html لا يشير إلى حزمة index المبنيّة.')
  }
} catch {
  errors.push('dist/index.html غير موجود.')
}

if (errors.length) {
  console.error('\n❌ فشل حارس البناء — لن يُنشَر:')
  for (const e of errors) console.error('   - ' + e)
  console.error('')
  process.exit(1)
}

console.log(`✅ حارس البناء: النسخة سليمة وتشير إلى ${expectedApi}`)
