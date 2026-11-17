import { useEffect, useState } from 'react'
import { listVacancies, OfflineError, ServerError } from '../api/client.ts'

export type VacancyListState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error'; message: string }
  | { status: 'ok'; rows: unknown[]; empty: string }

export function useVacancies(): VacancyListState {
  const [state, setState] = useState<VacancyListState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    listVacancies()
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ok', rows: data.rows, empty: data.empty })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof OfflineError) {
            setState({ status: 'offline' })
          } else if (err instanceof ServerError) {
            setState({ status: 'error', message: err.message })
          } else {
            setState({ status: 'offline' })
          }
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
