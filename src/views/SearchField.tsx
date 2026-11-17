import { useEffect, useRef } from 'react'
import { installSearchShortcut } from '../keyboard.ts'

interface Props {
  value: string
  onChange: (q: string) => void
}

export function SearchField({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!inputRef.current) return
    return installSearchShortcut(inputRef.current)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        className="search-input"
        type="search"
        placeholder="Search company, role, tech"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search vacancies"
      />
    </div>
  )
}
