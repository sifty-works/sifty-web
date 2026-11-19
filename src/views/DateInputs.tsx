import { useEffect, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

const EARLIEST = 1950

function datePickerStart(): Date { return new Date(EARLIEST, 0) }
function datePickerEnd(): Date { return new Date(new Date().getFullYear() + 5, 11) }
function pad2(n: number): string { return String(n).padStart(2, '0') }
function monthStart(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }

export function fmtMY(d: Date): string { return `${pad2(d.getMonth() + 1)}/${d.getFullYear()}` }
export function fmtDMY(d: Date): string { return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` }

export function parseMY(s: string): Date | null {
  const v = s.trim()
  let m = v.match(/^(\d{1,2})\/(\d{4})$/)
  if (m) { const mo = +m[1], yr = +m[2]; if (mo >= 1 && mo <= 12 && yr >= EARLIEST) return new Date(yr, mo - 1, 1) }
  m = v.match(/^(\d{4})-(\d{1,2})$/)
  if (m) { const yr = +m[1], mo = +m[2]; if (mo >= 1 && mo <= 12 && yr >= EARLIEST) return new Date(yr, mo - 1, 1) }
  return null
}

export function parseDMY(s: string): Date | null {
  const v = s.trim()
  let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1]); if (d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1]) return d }
  m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); if (d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]) return d }
  return null
}

export function MonthYearInput({ label, value, onChange, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => monthStart(parseMY(value) ?? new Date()))
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  function toggle() { if (disabled) return; if (!open) setView(monthStart(parseMY(value) ?? new Date())); setOpen(!open) }
  function normalise() { const n = parseMY(value); if (n) onChange(fmtMY(n)) }
  return <div className="profile-field-block">
    <span>{label}</span>
    <div className="profile-date">
      <input aria-label={label} value={value} placeholder="MM/YYYY" inputMode="numeric" disabled={disabled}
        onChange={(e) => { if (!disabled) onChange(e.target.value) }} onBlur={() => { if (!disabled) normalise() }}/>
      <button type="button" disabled={disabled} aria-expanded={open && !disabled} onClick={toggle}>
        {open && !disabled ? 'Close' : 'Calendar'}
      </button>
    </div>
    {open && !disabled ? <div className="profile-day-picker profile-month-year-picker">
      <DayPicker month={view} onMonthChange={setView} captionLayout="dropdown"
        startMonth={datePickerStart()} endMonth={datePickerEnd()}/>
      <div className="profile-picker-actions">
        <span>{fmtMY(view)}</span>
        <button type="button" className="primary" onClick={() => { onChange(fmtMY(view)); setOpen(false) }}>Use this month</button>
        <button type="button" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
      </div>
    </div> : null}
    {hint ? <small>{hint}</small> : null}
  </div>
}

export function DateInput({ label, value, onChange, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = parseDMY(value)
  const [view, setView] = useState(() => monthStart(selected ?? new Date()))
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  function toggle() { if (disabled) return; if (!open) setView(monthStart(parseDMY(value) ?? new Date())); setOpen(!open) }
  function normalise() { const n = parseDMY(value); if (n) onChange(fmtDMY(n)) }
  return <div className="profile-field-block">
    <span>{label}</span>
    <div className="profile-date">
      <input aria-label={label} value={value} placeholder="DD/MM/YYYY" inputMode="numeric" disabled={disabled}
        onChange={(e) => { if (!disabled) onChange(e.target.value) }} onBlur={() => { if (!disabled) normalise() }}/>
      <button type="button" disabled={disabled} aria-expanded={open && !disabled} onClick={toggle}>
        {open && !disabled ? 'Close' : 'Calendar'}
      </button>
    </div>
    {open && !disabled ? <div className="profile-day-picker">
      <DayPicker mode="single" selected={selected ?? undefined} month={view} onMonthChange={setView}
        onSelect={(d) => { if (disabled || !d) return; onChange(fmtDMY(d)); setOpen(false) }}
        captionLayout="dropdown" startMonth={datePickerStart()} endMonth={datePickerEnd()}/>
      <div className="profile-picker-actions">
        <button type="button" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>
      </div>
    </div> : null}
    {hint ? <small>{hint}</small> : null}
  </div>
}
