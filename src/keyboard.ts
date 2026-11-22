function shouldIgnore(e: KeyboardEvent): boolean {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return true
  if (e.isComposing) return true
  const target = e.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
    (target as HTMLElement).isContentEditable
}

export function installSearchShortcut(input: HTMLInputElement): () => void {
  function handler(e: KeyboardEvent): void {
    if (e.code !== 'Slash') return
    if (shouldIgnore(e)) return
    e.preventDefault()
    input.focus()
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}

export function installNavShortcuts(onPrev: () => void, onNext: () => void): () => void {
  function handler(e: KeyboardEvent): void {
    if (shouldIgnore(e)) return
    if (e.code === 'KeyJ' || e.code === 'ArrowDown') {
      e.preventDefault()
      onNext()
    } else if (e.code === 'KeyK' || e.code === 'ArrowUp') {
      e.preventDefault()
      onPrev()
    }
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}

export function installActionShortcuts(onKey: (code: string) => boolean): () => void {
  function handler(e: KeyboardEvent): void {
    if (shouldIgnore(e)) return
    if (onKey(e.code)) e.preventDefault()
  }
  document.addEventListener('keydown', handler)
  return () => document.removeEventListener('keydown', handler)
}
