import { useEffect, useRef } from 'react'

export function usePoll(load: () => Promise<void>, ms: number | null) {
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      await loadRef.current()
      if (!cancelled && ms !== null) timerId = setTimeout(() => { void tick() }, ms)
    }

    void tick()

    return () => {
      cancelled = true
      if (timerId !== null) clearTimeout(timerId)
    }
  }, [ms])
}
