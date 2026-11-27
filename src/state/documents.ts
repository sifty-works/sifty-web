import { useCallback, useEffect, useRef, useState } from 'react'
import { listDocuments, OfflineError, type DocumentItem } from '../api/client.ts'
import { announce, describe, failure, retract } from './messages.ts'

export type DocumentsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; documents: DocumentItem[] }

export interface UseDocumentsResult {
  state: DocumentsState
  reload: () => Promise<void>
  replace: (item: DocumentItem) => void
  drop: (id: number) => void
}

const POLL_MS = 2000

export const OFFLINE_MESSAGE = 'Sifty is not running. Start it and refresh the page.'

export function trouble(err: unknown, fallback?: string) {
  return failure(err instanceof OfflineError ? OFFLINE_MESSAGE : err, fallback)
}

export function useDocuments(): UseDocumentsResult {
  const [state, setState] = useState<DocumentsState>({ status: 'loading' })
  const [halted, setHalted] = useState(false)
  const latest = useRef(0)
  const loaded = useRef(false)

  const reload = useCallback(async () => {
    const mine = ++latest.current
    try {
      const data = await listDocuments()
      if (mine !== latest.current) return
      loaded.current = true
      setState({ status: 'ok', documents: data.documents })
      retract('documents')
      setHalted(false)
    } catch (err) {
      if (mine !== latest.current) return
      if (loaded.current) {
        announce(trouble(err, 'Could not refresh documents'), 'documents')
        setHalted(true)
      } else {
        setState({
          status: 'error',
          message: err instanceof OfflineError ? OFFLINE_MESSAGE : describe(err, 'Could not load documents'),
        })
      }
    }
  }, [])

  useEffect(() => {
    void reload()
    return () => { latest.current++ }
  }, [reload])

  const analysing = state.status === 'ok' && state.documents.some((d) => d.state === 'analysing')

  useEffect(() => {
    if (!analysing || halted) return
    const timer = setTimeout(() => { void reload() }, POLL_MS)
    return () => clearTimeout(timer)
  }, [analysing, halted, state, reload])

  const replace = useCallback((item: DocumentItem) => {
    setHalted(false)
    setState((prev) => prev.status !== 'ok' ? prev : {
      status: 'ok',
      documents: prev.documents.map((d) => d.id === item.id ? item : d),
    })
  }, [])

  const drop = useCallback((id: number) => {
    setState((prev) => prev.status !== 'ok' ? prev : {
      status: 'ok',
      documents: prev.documents.filter((d) => d.id !== id),
    })
  }, [])

  return { state, reload, replace, drop }
}
