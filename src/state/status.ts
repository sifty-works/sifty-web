import { useCallback, useEffect, useRef, useState } from 'react'
import { getStatus, RecoveredFile, StatusExtra } from '../api/client.ts'

export type StatusState =
  | { status: 'unknown' }
  | { status: 'ok'; data: StatusExtra }
  | { status: 'offline' }

export interface UseStatusResult {
  state: StatusState
  recovered: RecoveredFile[]

  applyStatus: (data: StatusExtra) => void
}

export function useStatus(onCatalogueChange: () => void): UseStatusResult {
  const [state, setState] = useState<StatusState>({ status: 'unknown' })
  const [recovered, setRecovered] = useState<RecoveredFile[]>([])
  const callbackRef = useRef(onCatalogueChange)
  const prevCatalogueRef = useRef<number | null>(null)

  useEffect(() => {
    callbackRef.current = onCatalogueChange
  })

  const applyStatus = useCallback((data: StatusExtra) => {
    if (prevCatalogueRef.current !== null && prevCatalogueRef.current !== data.catalogue) {
      callbackRef.current()
    }
    prevCatalogueRef.current = data.catalogue
    setState({ status: 'ok', data })
  }, [])

  useEffect(() => {
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        const data = await getStatus()
        if (!cancelled) {
          setRecovered(data.recovered)
          applyStatus(data)
        }
      } catch {
        if (!cancelled) setState({ status: 'offline' })
      }
      if (!cancelled) {
        timerId = setTimeout(() => { void poll() }, 5000)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timerId !== null) clearTimeout(timerId)
    }
  }, [applyStatus]) 

  return { state, recovered, applyStatus }
}
