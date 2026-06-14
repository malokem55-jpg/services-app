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

// المنصات المعروضة في الويب والدسكتوب. الغرفة لا تظهر في PWA الموبايل
// لأن شاشات /m لا تستخدم هذا الثابت أصلاً.
export const VISIBLE_PLATFORMS: PlatformKey[] = ['muqeem', 'chamber']

// مدن الغرفة التجارية الثابتة
export type ChamberCityKey = 'riyadh' | 'najran' | 'onaizah'

export const CHAMBER_CITY_LABELS: Record<ChamberCityKey, string> = {
  riyadh: 'الرياض',
  najran: 'نجران',
  onaizah: 'عنيزة',
}

export const CHAMBER_CITY_KEYS: ChamberCityKey[] = ['riyadh', 'najran', 'onaizah']

export interface ChamberCity {
  key: ChamberCityKey
  loginUrl: string
}

export interface CredentialSummary {
  organizationId: number
  platform: PlatformKey
  username: string
  city: ChamberCityKey | null
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

export interface MuqeemFillEntry {
  organizationId: number
  name: string | null
  username: string
  password: string
}

// كل بيانات مقيم (بكلمات المرور) لبناء «الزر الموحّد». يُجلب مسبقًا عند فتح الشاشة حتى
// يكون النسخ للحافظة فوريًا داخل لمسة المستخدم — Safari على iOS يرفض الكتابة في الحافظة
// بعد await. لا يُحتفظ به في الكاش بعد إغلاق الشاشة (gcTime 0).
export function useMuqeemFillList(enabled: boolean) {
  return useQuery<MuqeemFillEntry[]>({
    queryKey: ['muqeem-fill-list'],
    queryFn: () => apiFetch<MuqeemFillEntry[]>('/api/org-credentials/muqeem-fill-list'),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
}

export function useChamberCities() {
  return useQuery<ChamberCity[]>({
    queryKey: ['chamber-cities'],
    queryFn: () => apiFetch<ChamberCity[]>('/api/chamber-cities'),
    staleTime: 5 * 60 * 1000,
  })
}
