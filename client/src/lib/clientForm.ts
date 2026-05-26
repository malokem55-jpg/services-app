export interface ServiceOption {
  id: number
  name: string | null
}

export interface OrgOption {
  id: number
  name: string | null
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
}

export const EMPTY_CLIENT_FORM: ClientFormData = {
  name: '', phone: '', passport: '', boardNumber: '', visaNumber: '',
  iqamaNumber: '', iqamaEndDate: '', cardType: 'بدون', paymentType: '',
  amount: '', receivedAmount: '', notes: '', nextPaymentDate: '', serviceId: '', organizationId: '',
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
    notes: f.notes || undefined,
    nextPaymentDate: f.nextPaymentDate || undefined,
    serviceId: f.serviceId ? Number(f.serviceId) : undefined,
    organizationId: f.organizationId ? Number(f.organizationId) : undefined,
  }
}

export function iqamaStatus(dateStr: string | null) {
  if (!dateStr) return { label: '—', extra: null, cls: 'text-gray-400' }
  const diff = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  const days = Math.floor(diff / 86400000)
  const label = new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  if (days < 0) return { label, extra: 'منتهية', cls: 'text-red-600' }
  if (days <= 30) return { label, extra: `${days} يوم`, cls: 'text-amber-600' }
  return { label, extra: null, cls: 'text-gray-700' }
}
