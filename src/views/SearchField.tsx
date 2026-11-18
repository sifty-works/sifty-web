import { useEffect, useRef } from 'react'
import { Icon } from './Icon.tsx'

interface Props {
  value: string
  onChange: (v: string) => void
}

export function SearchField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="search list-search">
      <span aria-hidden="true">
        <Icon name="search" size={15} />
      </span>
      <input
        ref={inputRef}
        id="find"
        aria-label="Search catalogue"
        placeholder="Search company, role, tech"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <kbd>/</kbd>
    </div>
  )
}
