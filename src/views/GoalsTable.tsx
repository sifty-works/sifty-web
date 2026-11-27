import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useDismiss } from '../dismiss.ts'

export const BUCKETS = ['preferred', 'possible', 'unwanted', 'never'] as const
export type Bucket = (typeof BUCKETS)[number]
export type Lists<T = string> = Record<Bucket, T[]>
type Zone = Bucket | 'neutral'
type Option = { value: string; label: string }

const ZONES: Zone[] = [...BUCKETS, 'neutral']
const NAME: Record<Zone, string> = { preferred: 'Preferred', possible: 'Possible', unwanted: 'Unwanted', never: 'Never', neutral: 'Neutral' }
const HINT: Record<Zone, string> = {
  preferred: 'Raises the fit.', possible: 'Is fine.', unwanted: 'Lowers the fit.',
  never: 'Goes to the end of the Inbox, with the reason.', neutral: 'No effect on the fit.',
}

export function mapLists<A, B>(l: Lists<A>, f: (v: A[]) => B[]): Lists<B> {
  return { preferred: f(l.preferred), possible: f(l.possible), unwanted: f(l.unwanted), never: f(l.never) }
}

export function toLists<T = string>(b?: Partial<Lists<T>> | null): Lists<T> {
  return mapLists({ preferred: b?.preferred ?? [], possible: b?.possible ?? [], unwanted: b?.unwanted ?? [], never: b?.never ?? [] }, (v) => v)
}

export function fromLists<T>(l: Lists<T>): Partial<Lists<T>> {
  return Object.fromEntries(BUCKETS.filter((b) => l[b].length).map((b) => [b, l[b]]))
}

function move(l: Lists, value: string, zone: Zone): Lists {
  const next = mapLists(l, (v) => v.filter((x) => x !== value))
  if (zone !== 'neutral') next[zone] = [...next[zone], value]
  return next
}

export type GoalRow = {
  key: string; title: string; sub: string; lists: Lists; onChange: (l: Lists) => void; from?: string
  options?: Option[]; suggest?: GeoItem[]; known?: (v: string) => boolean
}

export type GeoItem = { code: string; label: string; group: 'region' | 'country' }

export function CountryTypeahead({ value, onChange, label, allItems, placeholder, autoFocus, onClose }: {
  value: string; onChange: (v: string) => void; label: string; allItems: GeoItem[]; placeholder?: string; autoFocus?: boolean; onClose?: () => void
}) {
  const [text, setText] = useState(() => {
    const found = allItems.find((i) => i.code === value)
    return found ? found.label : value
  })
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const found = allItems.find((i) => i.code === value)
    setText(found ? found.label : value)
  }, [value, allItems])

  const matches = useMemo(() => {
    if (!text.trim()) return allItems.slice(0, 50)
    const q = text.toLowerCase()
    return allItems.filter((i) => i.label.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)).slice(0, 60)
  }, [text, allItems])

  function select(item: GeoItem) {
    onChange(item.code); setText(item.label); setOpen(false); setCursor(-1)
  }

  function handleBlur() {
    setTimeout(() => {
      if (!listRef.current?.contains(document.activeElement)) {
        setOpen(false)

        const found = allItems.find((i) => i.label.toLowerCase() === text.toLowerCase())
        if (found) onChange(found.code)
        else if (text.trim()) onChange(text.trim())
        onClose?.()
      }
    }, 150)
  }

  return <div className="country-typeahead">
    <input ref={inputRef} autoFocus={autoFocus} aria-label={label} aria-autocomplete="list" aria-expanded={open}
      value={text} placeholder={placeholder ?? 'Country or region…'}
      onChange={(e) => { setText(e.target.value); setOpen(true); setCursor(-1) }}
      onFocus={() => setOpen(true)} onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)) }
        if (e.key === 'Enter' && cursor >= 0 && matches[cursor]) { e.preventDefault(); select(matches[cursor]) }
        if (e.key === 'Enter' && onClose && cursor < 0) inputRef.current?.blur()
        if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
      }}/>
    {open && matches.length > 0 ? <ul ref={listRef} className="country-typeahead-listbox" role="listbox" aria-label={label}>
      {matches.map((item, i) => <li key={item.code} role="option" aria-selected={item.code === value}
        className={`country-typeahead-option${i === cursor ? ' active' : ''}`}
        onMouseDown={() => select(item)}>{item.label}</li>)}
    </ul> : null}
  </div>
}

export function GoalsTable({ rows }: { rows: GoalRow[] }) {
  const [menu, setMenu] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ row: string; value: string } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  useDismiss(menu !== null, () => setMenu(null), '.goal-menu, .goal-chip-label')

  function put(row: GoalRow, value: string, zone: Zone) {
    row.onChange(move(row.lists, value, zone)); setMenu(null)
  }

  function chip(row: GoalRow, value: string, zone: Zone) {
    const id = `${row.key}:${value}`
    const label = row.options?.find((o) => o.value === value)?.label ?? value
    const unknown = row.known !== undefined && !row.known(value)
    return <span key={value} className="goal-chip-wrap">
      <span className={`goal-chip ${zone}${unknown ? ' invalid' : ''}`} draggable
        title={unknown ? 'Not a known place: it matches nothing' : undefined}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', value); e.dataTransfer.effectAllowed = 'move'; setMenu(null); setDrag({ row: row.key, value }) }}
        onDragEnd={() => { setDrag(null); setOver(null) }}>
        <button type="button" className="goal-chip-label" aria-haspopup="menu" aria-expanded={menu === id}
          onClick={() => setMenu(menu === id ? null : id)}>{label}</button>
        {row.suggest ? <button type="button" className="goal-chip-remove" aria-label={`Remove ${label}`}
          onClick={() => put(row, value, 'neutral')}>×</button> : null}
      </span>
      {menu === id ? <div className="goal-menu" role="menu" aria-label={`Move ${label}`}>
        {ZONES.map((z) => <button key={z} type="button" role="menuitemradio" aria-checked={z === zone}
          className={z === zone ? 'current' : ''} onClick={() => put(row, value, z)}>
          <span className={`goal-dot ${z}`}/>{z === 'neutral' ? 'Back to Neutral' : `Move to ${NAME[z]}`}
        </button>)}
      </div> : null}
    </span>
  }

  function cell(row: GoalRow, zone: Zone) {
    const id = `${row.key}:${zone}`
    const listed = BUCKETS.flatMap((b) => row.lists[b])
    const values = zone === 'neutral' ? (row.options ?? []).map((o) => o.value).filter((v) => !listed.includes(v)) : row.lists[zone]
    const target = zone !== 'neutral' || row.options !== undefined
    const drop = !target ? {} : {
      onDragOver: (e: DragEvent) => {
        if (drag?.row !== row.key) return
        e.preventDefault(); e.dataTransfer.dropEffect = 'move'
        if (over !== id) setOver(id)
      },
      onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null) },
      onDrop: (e: DragEvent) => {
        e.preventDefault()
        if (drag?.row === row.key) put(row, drag.value, zone)
        setDrag(null); setOver(null)
      },
    }
    return <div key={zone} className={`goal-cell ${zone}${over === id ? ' over' : ''}`} role="cell" aria-label={`${row.title}, ${NAME[zone]}`} {...drop}>
      <span className="goal-cell-name">{NAME[zone]}</span>
      {values.map((v) => chip(row, v, zone))}
      {zone === 'neutral' && row.suggest && !values.length ? <span className="goal-none">Typed values only</span> : null}
      {row.suggest && zone !== 'neutral' ? (adding === id
        ? <CountryTypeahead value="" autoFocus label={`Add to ${row.title}, ${NAME[zone]}`} placeholder="Type to add…"
          allItems={row.suggest.filter((i) => !listed.includes(i.label))} onClose={() => setAdding(null)}
          onChange={(v) => row.onChange(move(row.lists, row.suggest?.find((i) => i.code === v)?.label ?? v, zone))}/>
        : <button type="button" className="goal-add" aria-label={`Add to ${row.title}, ${NAME[zone]}`} onClick={() => setAdding(id)}>+</button>) : null}
    </div>
  }

  return <div className="goal-table" role="table" aria-label="Goals by list">
    <div className="goal-row goal-head" role="row">
      <div className="goal-crit" role="columnheader"><span className="goal-label">Criterion</span></div>
      {ZONES.map((z) => <div key={z} className={`goal-col ${z}`} role="columnheader">
        <span className="goal-col-name"><span className={`goal-dot ${z}`}/>{NAME[z]}</span>
        <span className="goal-hint">{HINT[z]}</span>
      </div>)}
    </div>
    {rows.map((row) => <div key={row.key} className={`goal-row${row.from === undefined ? '' : ' profile-inherited-value'}`} role="row" aria-label={row.title}>
      <div className="goal-crit" role="rowheader">
        <strong>{row.title}</strong>
        <span className="goal-sub">{row.from === undefined ? row.sub : `From ${row.from ? `"${row.from}"` : 'your first profile'}`}</span>
      </div>
      {ZONES.map((z) => cell(row, z))}
    </div>)}
  </div>
}
