import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface ServiceInfo { name: string | null }
export interface OrgInfo { name: string | null }

export interface MonthlyPaymentAlert {
  id: number
  clientId: number | null
  receivedDate: string | null
  amount: number | null
  carriedOverAmount: number | null
  carriedFromMonth: string | null
  month: string | null
  client: {
    name: string | null
    phone: string | null
    iqamaNumber: string | null
    iqamaEndDate: string | null
    service: ServiceInfo | null
    organization: OrgInfo | null
  } | null
}

// إقامة منتهية فعلاً: تاريخ النهاية قبل اليوم (من تنتهي إقامته اليوم لا يزال سارياً)
export function isIqamaExpired(s: string | null | undefined): boolean {
  if (!s) return false
  return s.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

// دفعات عميل واحد مجمَّعة في تنبيه واحد بدل تنبيه لكل دفعة
export interface MonthlyPaymentGroup {
  key: string
  clientId: number | null
  client: MonthlyPaymentAlert['client']
  payments: MonthlyPaymentAlert[] // مرتّبة بالاستحقاق تصاعدياً
  total: number // مجموع مبالغ الدفعات (شاملةً المرحّل)
  earliestDueDate: string | null
  anyOverdue: boolean // دفعة واحدة على الأقل مستحقة أو فات موعدها
  iqamaExpired: boolean
}

// يجمع تنبيهات الدفعات الشهرية حسب العميل. العميل بلا معرّف (نادر) تبقى كل دفعة
// مجموعةً مستقلة حتى لا تختلط دفعات عملاء مجهولين. الترتيب: منتهي الإقامة أولاً ثم الأقرب استحقاقاً.
export function groupMonthlyPayments(alerts: MonthlyPaymentAlert[]): MonthlyPaymentGroup[] {
  const today = new Date().toISOString().slice(0, 10)
  const map = new Map<string, MonthlyPaymentAlert[]>()
  for (const a of alerts) {
    const key = a.clientId != null ? `c${a.clientId}` : `p${a.id}`
    const arr = map.get(key)
    if (arr) arr.push(a)
    else map.set(key, [a])
  }

  const groups: MonthlyPaymentGroup[] = []
  for (const [key, payments] of map) {
    payments.sort((a, b) => (a.receivedDate ?? '').localeCompare(b.receivedDate ?? ''))
    const total = payments.reduce((s, p) => s + (p.amount ?? 0), 0)
    const earliestDueDate = payments[0]?.receivedDate ?? null
    const anyOverdue = payments.some(
      (p) => p.receivedDate != null && p.receivedDate.slice(0, 10) <= today,
    )
    groups.push({
      key,
      clientId: payments[0].clientId,
      client: payments[0].client,
      payments,
      total,
      earliestDueDate,
      anyOverdue,
      iqamaExpired: isIqamaExpired(payments[0].client?.iqamaEndDate),
    })
  }

  groups.sort((a, b) => {
    if (a.iqamaExpired !== b.iqamaExpired) return a.iqamaExpired ? -1 : 1
    return (a.earliestDueDate ?? '').localeCompare(b.earliestDueDate ?? '')
  })
  return groups
}

export interface CustomPaymentAlert {
  id: number
  name: string | null
  phone: string | null
  iqamaNumber: string | null
  nextPaymentDate: string | null
  service: ServiceInfo | null
  organization: OrgInfo | null
}

export interface IqamaAlert {
  id: number
  name: string | null
  iqamaNumber: string | null
  iqamaEndDate: string | null
  paymentType: string | null
  service: ServiceInfo | null
  organization: OrgInfo | null
}

// تنبيه التفويض والتصديق: يظهر من يوم التاريخ المحدد ويبقى حتى الضغط على "تم التفويض"
export interface TafweedAlert {
  id: number
  name: string | null
  tafweedAlertDate: string | null
  organization: OrgInfo | null
}

export interface NotificationsData {
  monthlyPayments: MonthlyPaymentAlert[]
  customPayments: CustomPaymentAlert[]
  iqamaExpirySoon: IqamaAlert[]
  iqamaExpired: IqamaAlert[]
  tafweedAlerts: TafweedAlert[]
}

export function useNotifications() {
  return useQuery<NotificationsData>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationsData>('/api/notifications'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}
