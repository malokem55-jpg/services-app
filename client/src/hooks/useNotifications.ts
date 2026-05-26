import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface ServiceInfo { name: string | null }
export interface OrgInfo { name: string | null }

export interface MonthlyPaymentAlert {
  id: number
  name: string | null
  nextPaymentDate: string | null
  amount: number | null
  service: ServiceInfo | null
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

export interface NotificationsData {
  monthlyPayments: MonthlyPaymentAlert[]
  iqamaExpirySoon: IqamaAlert[]
  iqamaExpired: IqamaAlert[]
}

export function useNotifications() {
  return useQuery<NotificationsData>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<NotificationsData>('/api/notifications'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}
