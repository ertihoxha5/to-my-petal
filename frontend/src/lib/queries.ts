import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type {
  Analysis,
  Dashboard,
  GuideArticle,
  JournalEntry,
  ModelStatus,
  Page,
  Photo,
  Plant,
  Reminder,
  User,
} from './types'

export const keys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  plants: (params: object = {}) => ['plants', params] as const,
  plant: (id: number) => ['plant', id] as const,
  photos: (plantId: number) => ['photos', plantId] as const,
  journal: (params: object) => ['journal', params] as const,
  analyses: (params: object) => ['analyses', params] as const,
  analysis: (id: number) => ['analysis', id] as const,
  reminders: (state: string) => ['reminders', state] as const,
  guide: (params: object) => ['guide', params] as const,
  article: (slug: string) => ['article', slug] as const,
  model: ['model'] as const,
}

function qs(params: Record<string, unknown>) {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v))
  const str = s.toString()
  return str ? `?${str}` : ''
}

/** Invalidate everything that summarises user data after a write. */
export function useInvalidateData() {
  const qc = useQueryClient()
  return () =>
    Promise.all(
      ['dashboard', 'plants', 'plant', 'photos', 'journal', 'analyses', 'analysis', 'reminders'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    )
}

export const useMe = () =>
  useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return await api<User>('/api/auth/me')
      } catch (e) {
        if ((e as { status?: number }).status === 401) return null
        throw e
      }
    },
    staleTime: 5 * 60_000,
  })

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => api<Dashboard>('/api/dashboard') })

export interface PlantFilters {
  q?: string
  species_key?: string
  state?: 'active' | 'archived' | 'all'
}
export const usePlants = (filters: PlantFilters = {}) =>
  useQuery({
    queryKey: keys.plants(filters),
    queryFn: () => api<Plant[]>(`/api/plants${qs({ ...filters })}`),
    placeholderData: keepPreviousData,
  })

export const usePlant = (id: number | null) =>
  useQuery({ queryKey: keys.plant(id ?? 0), queryFn: () => api<Plant>(`/api/plants/${id}`), enabled: !!id })

export const usePhotos = (plantId: number | null) =>
  useQuery({
    queryKey: keys.photos(plantId ?? 0),
    queryFn: () => api<Photo[]>(`/api/photos?plant_id=${plantId}`),
    enabled: !!plantId,
  })

export interface JournalFilters {
  plant_id?: number
  kind?: string
  date_from?: string
  date_to?: string
  with_photo?: boolean
  limit?: number
  offset?: number
}
export const useJournal = (filters: JournalFilters) =>
  useQuery({
    queryKey: keys.journal(filters),
    queryFn: () => api<Page<JournalEntry>>(`/api/journal${qs({ ...filters })}`),
    placeholderData: keepPreviousData,
  })

export const useAnalyses = (params: { plant_id?: number; limit?: number; offset?: number }) =>
  useQuery({
    queryKey: keys.analyses(params),
    queryFn: () => api<Page<Analysis>>(`/api/analyses${qs(params)}`),
    placeholderData: keepPreviousData,
  })

export const useAnalysis = (id: number) =>
  useQuery({ queryKey: keys.analysis(id), queryFn: () => api<Analysis>(`/api/analyses/${id}`) })

export const useReminders = (state: 'active' | 'all' = 'active') =>
  useQuery({ queryKey: keys.reminders(state), queryFn: () => api<Reminder[]>(`/api/reminders?state=${state}`) })

export const useGuide = (params: { q?: string; plant?: string; kind?: string }) =>
  useQuery({
    queryKey: keys.guide(params),
    queryFn: () => api<{ articles: GuideArticle[]; treatment_note: string }>(`/api/guide${qs(params)}`),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  })

export const useArticle = (slug: string) =>
  useQuery({ queryKey: keys.article(slug), queryFn: () => api<GuideArticle>(`/api/guide/${slug}`), staleTime: 10 * 60_000 })

export const useModelStatus = () =>
  useQuery({ queryKey: keys.model, queryFn: () => api<ModelStatus>('/api/system/model'), staleTime: 60_000 })

/** Generic mutation that refreshes user data afterwards. */
export function useDataMutation<TVars, TResult = unknown>(fn: (vars: TVars) => Promise<TResult>) {
  const invalidate = useInvalidateData()
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate() })
}
