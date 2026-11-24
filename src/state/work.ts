import { useCallback, useState } from 'react'
import { getLogs, getWork, LogsResponse, ServerError, WorkResponse } from '../api/client.ts'
import { failure, type Note } from './messages.ts'
import { usePoll } from './poll.ts'

export type RemoteState<T> =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error' }
  | { status: 'ok'; data: T }

export interface UseRemoteResult<T> {
  state: RemoteState<T>
  note: Note | null
  reload: () => Promise<void>
}

const REFRESH_MS = 5000

function useRemote<T>(fetcher: () => Promise<T>, ms: number | null): UseRemoteResult<T> {
  const [state, setState] = useState<RemoteState<T>>({ status: 'loading' })
  const [note, setNote] = useState<Note | null>(null)

  const reload = useCallback(async () => {
    try {
      setState({ status: 'ok', data: await fetcher() })
      setNote(null)
    } catch (err) {
      if (err instanceof ServerError) {
        setNote((prev) => prev?.text === err.message ? prev : failure(err))
        setState({ status: 'error' })
      } else {
        setNote(null)
        setState({ status: 'offline' })
      }
    }
  }, [fetcher])

  usePoll(reload, ms)

  return { state, note, reload }
}

export function useWork(): UseRemoteResult<WorkResponse> {
  return useRemote(getWork, REFRESH_MS)
}

export function useLogs(): UseRemoteResult<LogsResponse> {
  return useRemote(getLogs, null)
}
