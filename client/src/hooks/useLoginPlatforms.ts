import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

export type PlatformKey = 'muqeem' | 'chamber'

export interface LoginPlatform {
  key: PlatformKey
  enabled: boolean
  loginUrl: string
}

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  muqeem: 'مقيم',
  chamber: 'الغرفة التجارية',
}

// المنصات المعروضة حاليًا — تُضاف 'chamber' هنا عند تأكيد رابط الغرفة التجارية
export const VISIBLE_PLATFORMS: PlatformKey[] = ['muqeem']

export interface CredentialSummary {
  organizationId: number
  platform: PlatformKey
  username: string
}

export function useLoginPlatforms() {
  return useQuery<LoginPlatform[]>({
    queryKey: ['login-platforms'],
    queryFn: () => apiFetch<LoginPlatform[]>('/api/login-platforms'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCredentialSummaries() {
  return useQuery<CredentialSummary[]>({
    queryKey: ['org-credentials'],
    queryFn: () => apiFetch<CredentialSummary[]>('/api/org-credentials'),
  })
}
