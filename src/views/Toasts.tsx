import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { dismissNewest } from '../state/messages.ts'

const OFFSET = { bottom: 48, right: 16 }

function onKey(e: KeyboardEvent) {
  if (!e.defaultPrevented && e.key === 'Escape') dismissNewest()
}

export function Toasts() {
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <Toaster
      position="bottom-right"
      closeButton
      expand
      offset={OFFSET}
      mobileOffset={OFFSET}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'toast',
          error: 'toast-failure',
          success: 'toast-report',
          closeButton: 'toast-close',
          actionButton: 'toast-action',
        },
      }}
    />
  )
}
