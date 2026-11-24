import { useCallback, useEffect, useRef, useState } from 'react'
import { getStatus, RecoveredFile, StatusExtra } from '../api/client.ts'
import { usePoll } from './poll.ts'

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

  usePoll(async () => {
    try {
      const data = await getStatus()
      setRecovered(data.recovered)
      applyStatus(data)
    } catch {
      setState({ status: 'offline' })
    }
  }, 5000)

  return { state, recovered, applyStatus }
}
