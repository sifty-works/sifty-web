import type { components } from './schema.gen.ts'

export type VacancyRow = components['schemas']['Row']
export type ProfileListItem = components['schemas']['ProfileListItem']
export type ProfileListResp = components['schemas']['ProfileListResp']
export type ProfileDetailResp = components['schemas']['ProfileDetailResp']
export type ProfileData = components['schemas']['ProfileData']
export type ProfilePatchReq = components['schemas']['ProfilePatchReq']
export type MeData = components['schemas']['MeData']
export type MePatchReq = components['schemas']['MePatchReq']
export type ReferenceResp = components['schemas']['ReferenceResp']
export type ReferenceOptions = components['schemas']['ReferenceOptions']
export type ReferenceCountry = components['schemas']['ReferenceCountry']
export type ReferenceRegion = components['schemas']['ReferenceRegion']
export type ReferenceTimeZoneBand = components['schemas']['ReferenceTimeZoneBand']
export type QAItem = components['schemas']['QAItem']
export type QAListResp = components['schemas']['QAListResp']
export type SaidItem = components['schemas']['SaidItem']
export type SaidList = components['schemas']['SaidListResp']
export type Skill = components['schemas']['Skill']
export type AbsentSkill = components['schemas']['AbsentSkill']
export type ConfirmedFact = components['schemas']['ConfirmedFact']
export type Experience = components['schemas']['Experience']
export type Language = components['schemas']['Language']
export type Availability = components['schemas']['Availability']
export type Location = components['schemas']['Location']
export type WorkAuthorization = components['schemas']['WorkAuthorization']
export type Compensation = components['schemas']['Compensation']
export type DayRates = components['schemas']['DayRates']
export type Hours = components['schemas']['Hours']
export type Demographics = components['schemas']['Demographics']
export type VacancyCounts = components['schemas']['Counts']
export type VacancyListResponse = components['schemas']['ListResp']
export type VacancyAction = components['schemas']['Action']
export type Outcome = components['schemas']['Outcome']
export type VacancyListing = components['schemas']['ListingView']
export type VacancySource = components['schemas']['VacancySource']
export type VacancyView = components['schemas']['VacancyView']
export type ApplicationView = components['schemas']['ApplicationView']
export type ApplicationField = components['schemas']['Field']
export type ChatMessage = components['schemas']['ChatMessage']
export type ApplicationChatView = components['schemas']['chatView']
export type ChatSend = components['schemas']['chatPost']
export type CheckView = components['schemas']['CheckView']
export type CheckAnswer = components['schemas']['CheckAnswer']
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
export type SourceCount = components['schemas']['SourceCount']
export type FitMark = components['schemas']['FitMark']
export type Band = components['schemas']['Band']
export type Tile = components['schemas']['Tile']
export type RequirementGroup = components['schemas']['RequirementGroup']
export type RequirementLine = components['schemas']['RequirementLine']
export type SkillsDecisionReq = components['schemas']['SkillsDecisionReq']
export type SkillAnswer = Omit<SkillsDecisionReq, 'vacancyId'>
export type SkillEntry = components['schemas']['SkillEntry']
export type SkillsDecisionResp = components['schemas']['SkillsDecisionResp']
export type ModelsResponse = components['schemas']['modelsResp']
export type ModelsPatch = components['schemas']['modelsPatch']
export type ProviderView = components['schemas']['providerView']
export type WorkView = components['schemas']['workView']
export type SecretsResponse = components['schemas']['secretsResp']
export type SecretView = components['schemas']['secretView']
export type CheckResponse = components['schemas']['checkResp']
export type WorkResponse = components['schemas']['workResp']
export type WorkRunning = components['schemas']['workRunning']
export type LogsResponse = components['schemas']['logsResp']
export type LogEntry = components['schemas']['logEntry']
export type RecoveredFile = components['schemas']['RecoveredFile']
export type DocumentItem = components['schemas']['DocumentItem']
export type DocumentListResp = components['schemas']['DocumentListResp']
export type ProposalItem = components['schemas']['ProposalItem']
export type ProposalListResp = components['schemas']['ProposalListResp']

export interface VacancyFilters {
  published: '' | '7' | '30'
  remote: boolean
  leadership: boolean
  sources: string[]
  fit: string[]
}

export const DEFAULT_FILTERS: VacancyFilters = {
  published: '',
  remote: false,
  leadership: false,
  sources: [],
  fit: [],
}

export class ServerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ServerError'
  }
}

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

async function request<T>(method: string, url: string, body?: unknown, missing?: T): Promise<T> {
  let res: Response
  try {
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
    if (missing !== undefined && res.status === 404) return missing
    const message = await parseErrorBody(res)
    if (message !== null) throw new ServerError(message)
    throw new OfflineError()
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

export const LIST_WINDOW = 100
export const LIST_WINDOW_MAX = 200

export function listVacancies(
  profile: number | null,
  stage: string,
  q: string,
  filters: VacancyFilters = DEFAULT_FILTERS,
  unread = false,
  sort = 'fit',
  limit = LIST_WINDOW,
  offset = 0,
): Promise<VacancyListResponse> {
  const params = new URLSearchParams({ stage })
  if (profile !== null) params.set('profile', String(profile))
  if (q) params.set('q', q)
  if (filters.published) params.set('published', filters.published)
  if (filters.remote) params.set('remote', 'true')
  if (filters.leadership) params.set('leadership', 'true')
  if (filters.sources.length > 0) params.set('sources', filters.sources.join(','))
  if (unread) params.set('unread', 'true')
  if (filters.fit.length > 0) params.set('fit', filters.fit.join(','))
  if (sort) params.set('sort', sort)
  params.set('limit', String(limit))
  if (offset > 0) params.set('offset', String(offset))
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

export function setSchedule(auto: boolean, interval: string, maxAgeMonths: number | null): Promise<SourceListResponse> {
  return request<SourceListResponse>('PUT', '/api/sources/schedule', { auto, interval, max_age_months: maxAgeMonths })
}

export function listExclusions(): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('GET', '/api/exclusions')
}

export function addExclusion(kind: string, value: string, profileId?: number): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('POST', '/api/exclusions', profileId != null ? { kind, value, profile: profileId } : { kind, value })
}

export function removeExclusion(id: number, profileId?: number): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('DELETE', '/api/exclusions', profileId != null ? { id, profile: profileId } : { id })
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

export function postShortlistCheckRetry(id: number, profile: number): Promise<VacancyView> {
  return request<VacancyView>('POST', `/api/vacancies/${id}/shortlist-check/retry`, { profile })
}

export function getApplication(id: number): Promise<ApplicationView> {
  return request<ApplicationView>('GET', `/api/vacancies/${id}/application`)
}

export function retryApplication(id: number): Promise<ApplicationView> {
  return request<ApplicationView>('POST', `/api/vacancies/${id}/application/retry`)
}

export function getApplicationChat(id: number): Promise<ApplicationChatView> {
  return request<ApplicationChatView>('GET', `/api/vacancies/${id}/application/chat`, undefined, { messages: [] })
}

export function sendApplicationChat(id: number, send: ChatSend): Promise<ApplicationChatView> {
  return request<ApplicationChatView>('POST', `/api/vacancies/${id}/application/chat`, send)
}

export function patchApplicationField(id: number, field: string, values: string[], revision: number): Promise<ApplicationView> {
  return request<ApplicationView>('PATCH', `/api/vacancies/${id}/application/fields/${encodeURIComponent(field)}`, { values, revision })
}

export function postLocate(id: number, profile: number): Promise<VacancyView> {
  return request<VacancyView>('POST', `/api/vacancies/${id}/locate`, { profile })
}

export function deleteVacancy(id: number, profile: number): Promise<{ counts: VacancyCounts }> {
  return request<{ counts: VacancyCounts }>('DELETE', `/api/vacancies/${id}?profile=${profile}`)
}

export function getProfiles(): Promise<ProfileListResp> {
  return request<ProfileListResp>('GET', '/api/profiles')
}
export function createProfile(name: string): Promise<ProfileDetailResp> {
  return request<ProfileDetailResp>('POST', '/api/profiles', { name })
}
export function getProfile(id: number): Promise<ProfileDetailResp> {
  return request<ProfileDetailResp>('GET', `/api/profiles/${id}`)
}
export function patchProfile(id: number, req: ProfilePatchReq): Promise<ProfileDetailResp> {
  return request<ProfileDetailResp>('PATCH', `/api/profiles/${id}`, req)
}
export function deleteProfile(id: number): Promise<ProfileListResp> {
  return request<ProfileListResp>('DELETE', `/api/profiles/${id}`)
}
export function setActiveProfile(id: number): Promise<ProfileListResp> {
  return request<ProfileListResp>('PUT', '/api/active-profile', { id })
}

export function getMe(): Promise<MeData> {
  return request<MeData>('GET', '/api/me')
}
export function patchMe(req: MePatchReq): Promise<MeData> {
  return request<MeData>('PATCH', '/api/me', req)
}

export const PHOTO_URL = '/api/me/photo'
export async function checkPhoto(): Promise<boolean> {
  try {
    const res = await fetch(PHOTO_URL, { method: 'HEAD' })
    return res.status === 200
  } catch { return false }
}
export async function uploadPhoto(file: File): Promise<void> {
  const res = await fetch(PHOTO_URL, { method: 'PUT', body: file })
  if (!res.ok) {
    const body = await res.json().catch(() => null) as Record<string, unknown> | null
    throw new ServerError(typeof body?.error === 'string' ? body.error : 'Upload failed')
  }
}
export function removePhoto(): Promise<void> {
  return request<void>('DELETE', PHOTO_URL)
}

async function rawRequest(method: string, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { method, ...init })
  } catch {
    throw new OfflineError()
  }
  if (!res.ok) {
    const message = await parseErrorBody(res)
    if (message !== null) throw new ServerError(message)
    throw new OfflineError()
  }
  return res
}

export function listDocuments(): Promise<DocumentListResp> {
  return request<DocumentListResp>('GET', '/api/documents')
}
export async function uploadDocument(file: File): Promise<void> {
  await rawRequest('POST', `/api/documents?name=${encodeURIComponent(file.name)}`, { body: file })
}
export async function addDocument(source: { name: string; text: string } | { url: string }): Promise<void> {
  await rawRequest('POST', '/api/documents', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source),
  })
}
export async function getDocumentText(id: number): Promise<string> {
  return (await rawRequest('GET', `/api/documents/${id}/text`)).text()
}
export async function getDocumentOriginal(id: number): Promise<Blob> {
  return (await rawRequest('GET', `/api/documents/${id}/original`)).blob()
}
export function analyzeDocument(id: number): Promise<DocumentItem> {
  return request<DocumentItem>('POST', `/api/documents/${id}/analyze`)
}
export function cancelDocument(id: number): Promise<DocumentItem> {
  return request<DocumentItem>('POST', `/api/documents/${id}/cancel`)
}
export function refreshDocument(id: number): Promise<DocumentItem> {
  return request<DocumentItem>('POST', `/api/documents/${id}/refresh`)
}
export function setDocumentEvidence(id: number, evidence: boolean): Promise<DocumentItem> {
  return request<DocumentItem>('PATCH', `/api/documents/${id}`, { evidence })
}
export function deleteDocument(id: number): Promise<void> {
  return request<void>('DELETE', `/api/documents/${id}`)
}

let _ref: ReferenceResp | null = null
let _refFetch: Promise<ReferenceResp> | null = null
export function getReference(): Promise<ReferenceResp> {
  if (_ref) return Promise.resolve(_ref)
  if (!_refFetch) _refFetch = request<ReferenceResp>('GET', '/api/reference').then((r) => { _ref = r; return r })
  return _refFetch
}

export function getQA(): Promise<QAListResp> {
  return request<QAListResp>('GET', '/api/qa')
}
export function createQA(question: string, answer: string): Promise<QAItem> {
  return request<QAItem>('POST', '/api/qa', { question, answer })
}
export function updateQA(id: number, question: string | null, answer: string | null): Promise<QAItem> {
  return request<QAItem>('PATCH', '/api/qa', { id, question, answer })
}
export function deleteQA(id: number): Promise<void> {
  return request<void>('DELETE', '/api/qa', { id })
}

export function getSaid(): Promise<SaidList> {
  return request<SaidList>('GET', '/api/said', undefined, { items: [] })
}
export function deleteSaid(id: number): Promise<void> {
  return request<void>('DELETE', `/api/said/${id}`)
}

export function getExclusions(profileId: number): Promise<ExclusionListResponse> {
  return request<ExclusionListResponse>('GET', `/api/exclusions?profile=${profileId}`)
}

export function postSkillsDecision(req: SkillsDecisionReq): Promise<SkillsDecisionResp> {
  return request<SkillsDecisionResp>('POST', '/api/me/skills', req)
}

export function getModels(): Promise<ModelsResponse> {
  return request<ModelsResponse>('GET', '/api/models')
}

export function patchModels(patch: ModelsPatch): Promise<ModelsResponse> {
  return request<ModelsResponse>('PATCH', '/api/models', patch)
}

export function getSecrets(): Promise<SecretsResponse> {
  return request<SecretsResponse>('GET', '/api/secrets')
}

export function putSecret(name: string, value: string): Promise<SecretsResponse> {
  return request<SecretsResponse>('PUT', `/api/secrets/${encodeURIComponent(name)}`, { value })
}

export function deleteSecret(name: string): Promise<SecretsResponse> {
  return request<SecretsResponse>('DELETE', `/api/secrets/${encodeURIComponent(name)}`)
}

export function checkProvider(name: string): Promise<CheckResponse> {
  return request<CheckResponse>('POST', `/api/providers/${encodeURIComponent(name)}/check`)
}

export function listProposals(): Promise<ProposalListResp> {
  return request<ProposalListResp>('GET', '/api/proposals')
}
export function acceptProposal(id: number): Promise<ProposalListResp> {
  return request<ProposalListResp>('POST', `/api/proposals/${id}/accept`)
}
export function rejectProposal(id: number): Promise<ProposalListResp> {
  return request<ProposalListResp>('POST', `/api/proposals/${id}/reject`)
}

export function getWork(): Promise<WorkResponse> {
  return request<WorkResponse>('GET', '/api/work')
}

export function getLogs(): Promise<LogsResponse> {
  return request<LogsResponse>('GET', '/api/logs')
}
