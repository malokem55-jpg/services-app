export interface ServiceOption {
  id: number
  name: string | null
}

export interface OrgOption {
  id: number
  name: string | null
}

export interface ArrivalPlaceOption {
  id: number
  name: string
}

export interface ServiceStepOption {
  id: number
  name: string | null
  number: string | null
  order: number | null
}

export interface StepFormEntry {
  stepId: number
  date: string
  done: boolean
}

export const CARD_TYPE_OPTIONS = [
  'بدون',
  '3 شهور',
  '6 شهور',
  '9 شهور',
  'سنة',
  'سنة و 3 شهور',
  'سنة و 6 شهور',
  'سنة و 9 شهور',
  'سنتين',
] as const

// يجب أن يطابق جدول CARD_VALUES في server/src/services/organizations.service.ts
export const CARD_TYPE_VALUES: Record<string, number> = {
  'بدون': 0,
  '3 شهور': 0.25,
  '6 شهور': 0.50,
  '9 شهور': 0.75,
  'سنة': 1,
  'سنة و 3 شهور': 1.25,
  'سنة و 6 شهور': 1.50,
  'سنة و 9 شهور': 1.75,
  'سنتين': 2,
}

export function cardTypeValue(cardType: string | null): number {
  return CARD_TYPE_VALUES[cardType ?? 'بدون'] ?? 0
}

// تنسيق قيمة بالسنوات: 4 → "4"، 3.50 → "3.5"، 0.25 → "0.25"
export function formatYears(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(2).replace(/\.?0+$/, '')
}

// سطر من سجل إصدارات كروت العمل كما يرجعه السيرفر
export interface CardIssuance {
  id: number
  clientId: number | null
  clientName: string | null
  organizationId: number
  cardType: string
  months: number
  hijriYear: number
  issuedAt: string
  /** هل يخصم من الرصيد الحالي (بعد آخر منح)؟ — يرجع في سجل العميل فقط */
  countsTowardBalance?: boolean
}

// استجابة سجل مؤسسة: ملخص الرصيد منذ آخر منح + الإصدارات التي تخصم منه
export interface OrgIssuancesResponse {
  lastGrantAt: string | null
  usedYears: number
  remainingYears: number
  issuances: CardIssuance[]
}

export interface ClientFormData {
  name: string
  phone: string
  passport: string
  boardNumber: string
  visaNumber: string
  iqamaNumber: string
  iqamaEndDate: string
  cardType: string
  paymentType: string
  amount: string
  receivedAmount: string
  notes: string
  nextPaymentDate: string
  serviceId: string
  organizationId: string
  arrivalPlaceId: string
}

export const EMPTY_CLIENT_FORM: ClientFormData = {
  name: '', phone: '', passport: '', boardNumber: '', visaNumber: '',
  iqamaNumber: '', iqamaEndDate: '', cardType: 'بدون', paymentType: '',
  amount: '', receivedAmount: '', notes: '', nextPaymentDate: '', serviceId: '', organizationId: '',
  arrivalPlaceId: '',
}

export function buildClientPayload(f: ClientFormData) {
  return {
    name: f.name || undefined,
    phone: f.phone || undefined,
    passport: f.passport || undefined,
    boardNumber: f.boardNumber || undefined,
    visaNumber: f.visaNumber || undefined,
    iqamaNumber: f.iqamaNumber || undefined,
    iqamaEndDate: f.iqamaEndDate || undefined,
    cardType: f.cardType || undefined,
    paymentType: f.paymentType || undefined,
    amount: f.amount ? Number(f.amount) : undefined,
    // يُستخدم على السيرفر عند التحويل من شهري إلى سنوي لتسجيل الدفعة الأولى
    receivedAmount: f.receivedAmount ? Number(f.receivedAmount) : undefined,
    notes: f.notes || undefined,
    // الدفعة المخصصة (nextPaymentDate) خاصية سنوية فقط — لا تُرسل للعميل الشهري
    nextPaymentDate: f.paymentType === 'شهري' ? undefined : f.nextPaymentDate || undefined,
    serviceId: f.serviceId ? Number(f.serviceId) : undefined,
    organizationId: f.organizationId ? Number(f.organizationId) : undefined,
    // null تمسح جهة القدوم عند التعديل (الحقل اختياري)
    arrivalPlaceId: f.arrivalPlaceId ? Number(f.arrivalPlaceId) : null,
  }
}

export function iqamaStatus(dateStr: string | null) {
  if (!dateStr) return { label: '—', extra: null, cls: 'text-gray-400' }
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  const days = Math.floor(diff / 86400000)
  const label = new Date(dateStr).toLocaleDateString('ar-SA-u-nu-latn', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  if (days < 0) return { label, extra: 'منتهية', cls: 'text-red-600' }
  if (days <= 30) return { label, extra: `${days} يوم`, cls: 'text-amber-600' }
  return { label, extra: null, cls: 'text-gray-700' }
}
