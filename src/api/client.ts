export interface VacancyRow {
  id: number
  company: string
  title: string
  location: string
  published: string
}

export interface VacancyListResponse {
  rows: VacancyRow[]
  total: number
  empty: string
}

export interface Source {
  key: string
  name: string
  url: string
  enabled: boolean
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

export interface StatusResponse {
  version: string
  offline: boolean
  debug: boolean
  collecting: CollectingInfo | null
  lastRun: LastRun | null
  catalogue: number
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
    const init: RequestInit = { method }
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' }
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
  return res.json() as Promise<T>
}

export function listVacancies(q: string): Promise<VacancyListResponse> {
  const url = q ? `/api/vacancies?q=${encodeURIComponent(q)}` : '/api/vacancies'
  return request<VacancyListResponse>('GET', url)
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
