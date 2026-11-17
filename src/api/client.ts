export interface VacancyListResponse {
  rows: unknown[]
  empty: string
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
    const body: unknown = await res.json()
    if (
      body !== null &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as Record<string, unknown>)['error'] === 'string'
    ) {
      return (body as Record<string, unknown>)['error'] as string
    }
  } catch {
    // body was not JSON
  }
  return null
}

export async function listVacancies(): Promise<VacancyListResponse> {
  let res: Response
  try {
    res = await fetch('/api/vacancies')
  } catch {
    throw new OfflineError()
  }
  if (!res.ok) {
    const message = await parseErrorBody(res)
    if (message !== null) {
      throw new ServerError(message)
    }
    throw new OfflineError()
  }
  return res.json() as Promise<VacancyListResponse>
}
