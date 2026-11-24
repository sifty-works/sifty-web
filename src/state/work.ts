import { useEffect, useState } from 'react'
import { getWork, ServerError, WorkResponse } from '../api/client.ts'
import { failure, type Note } from './messages.ts'

export type WorkState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error' }
  | { status: 'ok'; work: WorkResponse }

export interface UseWorkResult {
  state: WorkState
  note: Note | null
}

const REFRESH_MS = 5000

export function useWork(): UseWorkResult {
  const [state, setState] = useState<WorkState>({ status: 'loading' })
  const [note, setNote] = useState<Note | null>(null)

  useEffect(() => {
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const work = await getWork()
        if (!cancelled) {
          setState({ status: 'ok', work })
          setNote(null)
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ServerError) {
            setNote((prev) => prev?.text === err.message ? prev : failure(err))
            setState({ status: 'error' })
          } else {
            setNote(null)
            setState({ status: 'offline' })
          }
        }
      }
      if (!cancelled) timerId = setTimeout(() => { void poll() }, REFRESH_MS)
    }

    void poll()

    return () => {
      cancelled = true
      if (timerId !== null) clearTimeout(timerId)
    }
  }, [])

  return { state, note }
}
