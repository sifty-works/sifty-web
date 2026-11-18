import { useCallback, useEffect, useRef, useState } from 'react'
import { getStatus, StatusExtra } from '../api/client.ts'

export type StatusState =
  | { status: 'unknown' }
  | { status: 'ok'; data: StatusExtra }
  | { status: 'offline' }

export interface UseStatusResult {
  state: StatusState
  /** Replace status state with the given status data. Accepts both the full status and
   * the smaller collect response, since they share the fields the UI uses. */
  applyStatus: (data: StatusExtra) => void
}

/**
 * Polls GET /api/status every 5 seconds.
 * Calls onCatalogueChange when the catalogue version advances.
 * Returns applyStatus so callers can push a collect response without waiting for the next poll.
 */
export function useStatus(onCatalogueChange: () => void): UseStatusResult {
  const [state, setState] = useState<StatusState>({ status: 'unknown' })
  const callbackRef = useRef(onCatalogueChange)
  const prevCatalogueRef = useRef<number | null>(null)

  // Keep the callback ref current without restarting the poll.
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
        if (!cancelled) applyStatus(data)
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
  }, [applyStatus]) // applyStatus is stable (useCallback empty deps)

  return { state, applyStatus }
}
