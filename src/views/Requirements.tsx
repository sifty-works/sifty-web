import { ReactNode, useState } from 'react'
import { Band, CheckAnswer, CheckView, RequirementLine, SkillAnswer, SkillEntry } from '../api/client.ts'
import { useDismiss } from '../dismiss.ts'
import { useReference } from '../state/profile.ts'

const VERDICT_RANK: Record<string, number> = { '✕': 0, '?': 1, '≈': 2, '✓': 3 }
const VERDICT_CLASS: Record<string, string> = { '✕': 'no', '≈': 'near', '?': 'unknown', '✓': 'ok' }

function demanded(entry: SkillEntry): string {
  return entry.demand === 'Any' ? '' : entry.demand
}

function skillClass(entry: SkillEntry, have?: string): string {
  if (have === 'No') return 'no'
  if (!have) return 'unknown'
  return VERDICT_CLASS[entry.verdict] ?? 'unknown'
}

function sortedByVerdict(skills: SkillEntry[]): SkillEntry[] {
  return [...skills].sort((a, b) => (VERDICT_RANK[a.verdict] ?? 1) - (VERDICT_RANK[b.verdict] ?? 1))
}

function joinNames(names: string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

function entryKey(entry: SkillEntry): string {
  return entry.line + '|' + entry.skills.map((s) => s.name).join()
}

export function skillsToAnswer(band: Band): number | null {
  const entries = band.groups.flatMap((g) => g.skills)
  if (entries.length === 0) return null
  return entries.filter((e) => e.verdict === '?').length
}

interface SkillsProps {
  band: Band
  check?: CheckView | null
  onDecision: (answer: SkillAnswer) => Promise<void>
  action?: ReactNode
}

function shownOnce(entries: SkillEntry[], seen: Set<string>): { entry: SkillEntry; skills: SkillEntry['skills'] }[] {
  return sortedByVerdict(entries)
    .map((entry) => ({ entry, skills: entry.skills.filter((s) => !seen.has(s.name) && !!seen.add(s.name)) }))
    .filter((row) => row.skills.length > 0)
}

export function Skills({ band, check, onDecision, action }: SkillsProps) {
  const seen = new Set<string>()
  const columns = band.groups.map((g) => ({ label: g.label, skills: g.skills, rows: shownOnce(g.skills, seen) })).filter((g) => g.rows.length > 0)
  const [open, setOpen] = useState<{ label: string; key: string } | null>(null)
  const close = () => setOpen(null)
  useDismiss(open !== null, close, '.skill-picker, .skill-chip')
  if (columns.length === 0) return null

  return (
    <div className="skills">
      <div className="skill-cols">
        {columns.map((group, i) => (
          <SkillColumn
            action={i === 0 ? action : undefined}
            key={group.label}
            label={group.label}
            skills={group.skills}
            rows={group.rows}
            check={check}
            open={open?.label === group.label ? open.key : null}
            onOpen={(key) => setOpen(key === null ? null : { label: group.label, key })}
            onPick={async (skill, level) => {
              close()
              await onDecision({ skill, level })
            }}
          />
        ))}
      </div>
    </div>
  )
}

interface SkillColumnProps {
  action?: ReactNode
  label: string
  skills: SkillEntry[]
  rows: { entry: SkillEntry; skills: SkillEntry['skills'] }[]
  check?: CheckView | null
  open: string | null
  onOpen: (key: string | null) => void
  onPick: (skill: string, level: string) => Promise<void>
}

function SkillColumn({ label, skills, rows, check, open, onOpen, onPick, action }: SkillColumnProps) {
  const current = skills.find((e) => open?.startsWith(entryKey(e) + '#'))
  const currentName = current && open ? open.slice(entryKey(current).length + 1) : ''
  return (
    <div className="skill-col">
      <div className="skill-head">
        <h4>Skills {label}</h4>
      </div>
      <div className="skill-row">
      {action}
      <ul className="skill-list">
        {rows.map(({ entry, skills: shown }) => (
          <li key={entryKey(entry)} className="skill-group">
            {shown.map((skill) => {
              const key = entryKey(entry) + '#' + skill.name
              return (
                <span key={skill.name} className={`skill ${skillClass(entry, skill.have)}${open === key ? ' open' : ''}`}>
                  <button type="button" className="skill-chip" aria-expanded={open === key} title={entry.line} onClick={() => onOpen(open === key ? null : key)}>
                    {skill.have === 'No' && <span className="skill-x" aria-hidden="true">✕</span>}
                    {skill.name}
                    {skill.have && skill.have !== 'No' && <small>{skill.have}</small>}
                  </button>
                </span>
              )
            })}
          </li>
        ))}
      </ul>
      </div>
      {current && (
        <LevelPicker
          key={open}
          entry={current}
          name={currentName}
          checked={check?.answers.find((a) => a.requirement === current.line && (a.skills?.length ?? 0) > 0)}
          onPick={onPick}
        />
      )}
    </div>
  )
}

interface LevelPickerProps {
  entry: SkillEntry
  name: string
  checked?: CheckAnswer
  onPick: (skill: string, level: string) => Promise<void>
}

function LevelPicker({ entry, name, checked, onPick }: LevelPickerProps) {
  const have = entry.skills.find((s) => s.name === name)?.have ?? ''
  const levels = [...(useReference()?.options.skillLevels ?? []), { value: 'No', label: 'No' }]

  return (
    <div className="skill-picker">
      <strong>{name}</strong>
      <q>{entry.line}</q>
      <span className="skill-picker-facts">
        {demanded(entry) && <span>They ask: {demanded(entry)}</span>}
        <span>You: {have || 'not set'}</span>
        {entry.skills.length > 1 && <span>Any one of {joinNames(entry.skills.map((s) => s.name))} is enough</span>}
      </span>
      {checked && <span className="skill-picker-check">{checked.reason}</span>}
      <span className="skill-picker-levels" role="radiogroup" aria-label={`Your level in ${name}`}>
        {levels.map(({ value, label }) => (
          <button key={value} type="button" role="radio" aria-checked={have === value} autoFocus={have === value} className={have === value ? 'on' : ''} onClick={() => void onPick(name, value)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  )
}

export function CheckLine({ check, onRetry }: { check: CheckView; onRetry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  if (!check.state && !check.note && !check.retry) return null

  async function retry() {
    setBusy(true)
    try { await onRetry() }
    finally { setBusy(false) }
  }

  return (
    <p className="check-line">
      {check.state && <span>{check.state}</span>}
      {check.note && <span>{check.note}</span>}
      {check.retry && <button disabled={busy} onClick={() => void retry()}>Retry</button>}
    </p>
  )
}

interface OtherProps {
  band: Band
  check?: CheckView | null
  onDecision: (answer: SkillAnswer) => Promise<void>
}

export function OtherRequirements({ band, check, onDecision }: OtherProps) {
  const rows = band.groups.flatMap((g) => g.items)
  const [open, setOpen] = useState(false)
  if (rows.length === 0) return null
  const answers = new Map((check?.answers ?? []).map((a) => [a.index, a]))

  return (
    <section className="other-requirements">
      <button type="button" className="other-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <strong>Other requirements</strong>
        <span>({rows.length})</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul className="ask-list">
          {rows.map((item) => (
            <AskRow key={item.index} item={item} checked={answers.get(item.index)} onDecision={onDecision} />
          ))}
        </ul>
      )}
    </section>
  )
}

interface AskRowProps {
  item: RequirementLine
  checked?: CheckAnswer
  onDecision: (answer: SkillAnswer) => Promise<void>
}

type Answer = 'have' | 'not'

const ANSWERS: Record<Answer, string> = { have: 'I have it', not: 'I don’t' }

function AskRow({ item, checked, onDecision }: AskRowProps) {
  const [busy, setBusy] = useState<Answer | null>(null)

  const isUnknown = item.verdict === '?'

  async function answer(kind: Answer) {
    if (busy) return
    setBusy(kind)
    try { await onDecision({ requirementIndex: item.index, have: kind === 'have' }) }
    finally { setBusy(null) }
  }

  const mark = item.verdict === '✓' ? '✓' : item.verdict === '✕' ? '✕' : '?'
  const rowCls = item.verdict === '✓' ? 'match' : item.verdict === '✕' ? 'no' : 'unknown'
  const shown = isUnknown ? checked : undefined

  return (
    <li className={`ask-row ${rowCls}${shown ? ' checked' : ''}${busy ? ' pending' : ''}`}>
      <span className="ask-mark" aria-hidden="true">{busy ? '…' : mark}</span>
      <span className="ask-text">
        {item.text}
        {item.alts && item.alts.length > 0 && (
          <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>
            {' /' + item.alts.map((a) => ` ${a}`).join(' /')}
          </span>
        )}
      </span>
      {item.evidence && <span className="ask-evidence">{item.evidence}</span>}
      {isUnknown && (
        <div className="ask-actions">
          {(['have', 'not'] as const).map((kind) => (
            <button key={kind} className={kind} disabled={!!busy} onClick={() => void answer(kind)}>
              {busy === kind ? '…' : ANSWERS[kind]}
            </button>
          ))}
        </div>
      )}
      {shown && (
        <div className="ask-check">
          <span className={`check-mark ${shown.verdict === '✓' ? 'match' : 'no'}`} title="The model's verdict">{shown.verdict}</span>
          <span className="check-reason">{shown.reason}</span>
          {shown.excerpt && <q className="check-excerpt">{shown.excerpt}</q>}
        </div>
      )}
    </li>
  )
}
