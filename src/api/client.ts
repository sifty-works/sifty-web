import type { components } from './schema.gen.ts'

// Types derived from the generated schema. The aliases below keep the names
// the rest of the application uses while the generated file stays unedited.
export type VacancyRow = components['schemas']['Row']
export type VacancyCounts = components['schemas']['Counts']
export type VacancyListResponse = components['schemas']['ListResp']
export type VacancyAction = components['schemas']['Action']
export type Outcome = components['schemas']['Outcome']
export type VacancyListing = components['schemas']['ListingView']
export type VacancySource = components['schemas']['VacancySource']
export type VacancyView = components['schemas']['VacancyView']
export type SourceStatus = components['schemas']['SourceStatus']
export type Source = components['schemas']['Source']
export type SourceListResponse = components['schemas']['SourcesResp']
export type CollectingInfo = components['schemas']['CollectProgress']
export type LastRun = components['schemas']['LastRun']
export type AttentionInfo = components['schemas']['Attention']
export type StatusResponse = components['schemas']['StatusResp']
export type StatusExtra = components['schemas']['StatusExtra']
export type DecisionRequest = components['schemas']['DecisionReq']
export type DecisionResponse = components['schemas']['DecisionResp']
export type Exclusion = components['schemas']['Exclusion']
export type ExclusionListResponse = components['schemas']['ExclusionsResp']

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

export function triggerCollect(force: boolean): Promise<StatusExtra> {
  return request<StatusExtra>('POST', '/api/collect', { force })
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

export function postDecision(id: number, req: DecisionRequest): Promise<DecisionResponse> {
  return request<DecisionResponse>('POST', `/api/vacancies/${id}/decision`, req)
}

export function deleteVacancy(id: number, profile: number): Promise<{ counts: VacancyCounts }> {
  return request<{ counts: VacancyCounts }>('DELETE', `/api/vacancies/${id}?profile=${profile}`)
}
