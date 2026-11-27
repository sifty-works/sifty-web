import { RefObject, useEffect, useRef } from 'react'

export function useDismiss(enabled: boolean, onClose: () => void, inside: RefObject<Element | null> | string) {
  const latest = useRef({ onClose, inside })
  latest.current = { onClose, inside }

  useEffect(() => {
    if (!enabled) return
    function onPointerDown(e: PointerEvent) {
      const { inside, onClose } = latest.current
      const target = e.target as Element
      const hit = typeof inside === 'string' ? target.closest(inside) !== null : inside.current?.contains(target)
      if (!hit) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      latest.current.onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled])
}
