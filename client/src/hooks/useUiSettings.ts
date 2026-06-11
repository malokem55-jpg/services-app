import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export interface UiSettings {
  showBellCustomPayments: boolean
  showBellMonthlyPayments: boolean
  showBellIqamaSoon: boolean
  showBellIqamaExpired: boolean
  showUnderProcedurePage: boolean
  showDeletedDuesPage: boolean
  showIqamaAlertsPage: boolean
}

export function useUiSettings() {
  return useQuery<UiSettings>({
    queryKey: ['ui-settings'],
    queryFn: () => apiFetch<UiSettings>('/api/ui-settings'),
    staleTime: 5 * 60 * 1000,
  })
}
