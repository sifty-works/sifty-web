export interface VacancyRow {
  id: number
  company: string
  title: string
  location: string
  published: string
  unread: boolean
  stage: string
  reason: string
  applied: string
  expired: boolean
}

export interface VacancyCounts {
  inbox: number
  shortlist: number
  applied: number
  dismissed: number
  archive: number
}

export interface VacancyListResponse {
  rows: VacancyRow[]
  counts: VacancyCounts
  profile: number
  empty: string
}

export interface VacancyAction {
  key: string
  label: string
  url?: string
  message?: string
}

export interface VacancyListing {
  state: string
  html: string
  empty: string
}

export interface VacancyView extends VacancyRow {
  sources: string[]
  original: string
  status: string
  actions: VacancyAction[]
  listing: VacancyListing
}

export interface SourceStatus {
  text: string
  attention: boolean
}

export interface Source {
  key: string
  name: string
  url: string
  enabled: boolean
  status: SourceStatus | null
}

export interface SourceListResponse {
  sources: Source[]
  auto: boolean
  interval: string
}

export interface CollectingInfo {
  done: number
  total: number
  text: string
}

export interface LastRun {
  state: string
  finished: string
  message: string
}

export interface AttentionInfo {
  count: number
  text: string
}

export interface StatusResponse {
  version: string
  offline: boolean
  debug: boolean
  collecting: CollectingInfo | null
  lastRun: LastRun | null
  catalogue: number
  attention: AttentionInfo | null
}

/** The server returned an HTTP error with a well-formed {"error": string} body. */
export class ServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerError'
  }
}

/** The server could not be reached, or its error response was not parseable. */
export class OfflineError extends Error {
  constructor() {
    super('Server unreachable')
    this.name = 'OfflineError'
  }
}

async function parseErrorBody(res: Response): Promise<string | null> {
  try {
    const body = await res.json() as Record<string, unknown>
    return typeof body?.error === 'string' ? body.error : null
  } catch {
    return null
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    // The server requires the JSON content type on every changing request, even without a body.
    const init: RequestInit = { method }
    if (method !== 'GET') {
      init.headers = { 'Content-Type': 'application/json' }
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }
    res = await fetch(url, init)
  } catch {
    throw new OfflineError()
  }
  if (!res.ok) {
    const message = await parseErrorBody(res)
    if (message !== null) throw new ServerError(message)
    throw new OfflineError()
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export function listVacancies(
  profile: number | null,
  stage: string,
  q: string,
): Promise<VacancyListResponse> {
  const params = new URLSearchParams({ stage })
  if (profile !== null) params.set('profile', String(profile))
  if (q) params.set('q', q)
  return request<VacancyListResponse>('GET', `/api/vacancies?${params.toString()}`)
}

export function getVacancy(id: number, profile: number | null): Promise<VacancyView> {
  const params = new URLSearchParams()
  if (profile !== null) params.set('profile', String(profile))
  const qs = params.toString()
  return request<VacancyView>('GET', qs ? `/api/vacancies/${id}?${qs}` : `/api/vacancies/${id}`)
}

export function markSeen(id: number): Promise<void> {
  return request<void>('POST', `/api/vacancies/${id}/seen`)
}

export function getStatus(): Promise<StatusResponse> {
  return request<StatusResponse>('GET', '/api/status')
}

export function triggerCollect(force: boolean): Promise<StatusResponse> {
  return request<StatusResponse>('POST', '/api/collect', { force })
}

export function listSources(): Promise<SourceListResponse> {
  return request<SourceListResponse>('GET', '/api/sources')
}

export function addSource(name: string, url: string): Promise<SourceListResponse> {
  return request<SourceListResponse>('POST', '/api/sources', { name, url })
}

export function patchSource(key: string, enabled: boolean): Promise<SourceListResponse> {
  return request<SourceListResponse>('PATCH', '/api/sources', { key, enabled })
}

export function deleteSource(key: string): Promise<SourceListResponse> {
  return request<SourceListResponse>('DELETE', '/api/sources', { key })
}

export function setSchedule(auto: boolean, interval: string): Promise<SourceListResponse> {
  return request<SourceListResponse>('PUT', '/api/sources/schedule', { auto, interval })
}

export interface Exclusion {
  id: number
  kind: 'word' | 'company'
  value: string
  scope: string
}

export interface ExclusionListResponse {
  exclusions: Exclusion[]
}

export function listExclusions(): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('GET', '/api/exclusions')
}

export function addExclusion(kind: string, value: string): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('POST', '/api/exclusions', { kind, value })
}

export function removeExclusion(id: number): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('DELETE', '/api/exclusions', { id })
}

export function previewExclusion(kind: string, value: string): Promise<{ text: string }> {
  return request<{ text: string }>(
    'GET',
    `/api/exclusions/preview?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(value)}`,
  )
}

export interface DecisionRequest {
  profile: number
  from: string
  to: string
  reason?: string
  confirmed?: boolean
}

export interface DecisionResponse {
  row: VacancyRow
  counts: VacancyCounts
}

export function postDecision(id: number, req: DecisionRequest): Promise<DecisionResponse> {
  return request<DecisionResponse>('POST', `/api/vacancies/${id}/decision`, req)
}

export function deleteVacancy(id: number, profile: number): Promise<{ counts: VacancyCounts }> {
  return request<{ counts: VacancyCounts }>('DELETE', `/api/vacancies/${id}?profile=${profile}`)
}
