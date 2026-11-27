import { useState } from 'react'
import { Band, CheckAnswer, CheckView, RequirementLine, SkillAnswer, SkillEntry } from '../api/client.ts'
import { useDismiss } from '../dismiss.ts'
import { useReference } from '../state/profile.ts'

interface Props {
  band: Band
  check?: CheckView | null
  onDecision: (answer: SkillAnswer) => Promise<void>
  onRetry: () => Promise<void>
}

const VERDICT_RANK: Record<string, number> = { '✕': 0, '≈': 1, '?': 2, '✓': 3 }
const VERDICT_CLASS: Record<string, string> = { '✕': 'no', '≈': 'near', '?': 'unknown', '✓': 'ok' }

function demanded(entry: SkillEntry): string {
  return entry.demand === 'Any' ? '' : entry.demand
}

function sortedByVerdict(skills: SkillEntry[]): SkillEntry[] {
  return [...skills].sort((a, b) => (VERDICT_RANK[a.verdict] ?? 2) - (VERDICT_RANK[b.verdict] ?? 2))
}

function joinNames(names: string[]): string {
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}

export function WhatTheyAsk({ band, check, onDecision, onRetry }: Props) {
  const answers = new Map((check?.answers ?? []).map((a) => [a.index, a]))
  const columns = band.groups.filter((g) => g.skills.length > 0)
  const rows = band.groups.flatMap((g) => g.items)
  const hasItems = columns.length > 0 || rows.length > 0
  const [open, setOpen] = useState<{ label: string; key: string } | null>(null)
  const close = () => setOpen(null)
  useDismiss(open !== null, close, '.ask-picker, .ask-skill-chip')
  const current = columns.flatMap((g) => g.skills.map((entry) => ({ label: g.label, entry }))).find((c) => open?.label === c.label && open.key === entryKey(c.entry))

  return (
    <section className="what-ask">
      <div className="card-icon-head">
        <span className="card-icon-box" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f4f4f5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <circle cx="12" cy="12" r="4.5" />
            <circle cx="12" cy="12" r="0.8" fill="#f4f4f5" stroke="none" />
          </svg>
        </span>
        <div className="card-title-block">
          <span className="card-title">What they ask</span>
          <span className="card-subtitle">{band.requirementsText}</span>
        </div>
      </div>

      {check && <CheckLine check={check} onRetry={onRetry} />}

      {!hasItems ? (
        <p className="ask-not-found">{band.requirementsText}</p>
      ) : (
        <>
          {columns.length > 0 && (
            <div className="ask-skill-cols">
              {columns.map((group) => (
                <SkillColumn key={group.label} label={group.label} skills={group.skills} open={open?.label === group.label ? open.key : null} onOpen={(key) => setOpen(key === null ? null : { label: group.label, key })} />
              ))}
              {current && (
                <LevelPicker
                  key={open?.label + '|' + open?.key}
                  entry={current.entry}
                  checked={check?.answers.find((a) => a.requirement === current.entry.line && (a.skills?.length ?? 0) > 0)}
                  onPick={async (skill, level) => {
                    close()
                    await onDecision({ skill, level })
                  }}
                />
              )}
            </div>
          )}
          {rows.length > 0 && (
            <div>
              <div className="ask-section-label">OTHER REQUIREMENTS</div>
              <ul className="ask-list" style={{ marginTop: 8 }}>
                {rows.map((item) => (
                  <AskRow key={item.index} item={item} checked={answers.get(item.index)} onDecision={onDecision} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

interface SkillColumnProps {
  label: string
  skills: SkillEntry[]
  open: string | null
  onOpen: (key: string | null) => void
}

function SkillColumn({ label, skills, open, onOpen }: SkillColumnProps) {
  const have = skills.filter((e) => e.verdict === '✓').length
  return (
    <div className="ask-skill-col">
      <div className="ask-skill-head">
        <span>{label}</span>
        <small>{have} of {skills.length}</small>
      </div>
      <ul className="ask-skill-list">
        {sortedByVerdict(skills).map((entry) => {
          const key = entryKey(entry)
          return (
            <li key={key} className={`ask-skill ${VERDICT_CLASS[entry.verdict] ?? 'unknown'}${open === key ? ' open' : ''}`}>
              <button type="button" className="ask-skill-chip" aria-expanded={open === key} title={entry.line} onClick={() => onOpen(open === key ? null : key)}>
                <span className="ask-skill-mark" aria-hidden="true">{entry.verdict}</span>
                {joinNames(entry.skills.map((s) => s.name))}
                {demanded(entry) && <small>{demanded(entry)}</small>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function entryKey(entry: SkillEntry): string {
  return entry.line + '|' + entry.skills.map((s) => s.name).join()
}

interface LevelPickerProps {
  entry: SkillEntry
  checked?: CheckAnswer
  onPick: (skill: string, level: string) => Promise<void>
}

function LevelPicker({ entry, checked, onPick }: LevelPickerProps) {
  const [name, setName] = useState(entry.skills[0]?.name ?? '')
  const have = entry.skills.find((s) => s.name === name)?.have ?? ''
  const levels = [...(useReference()?.options.skillLevels ?? []), { value: 'No', label: 'No' }]

  return (
    <div className="ask-picker">
      {entry.skills.length > 1 ? (
        <span className="ask-picker-alts" role="radiogroup" aria-label="Skill">
          {entry.skills.map((s) => (
            <button key={s.name} type="button" role="radio" aria-checked={s.name === name} className={s.name === name ? 'on' : ''} onClick={() => setName(s.name)}>
              {s.name}
            </button>
          ))}
        </span>
      ) : (
        <strong>{name}</strong>
      )}
      <q>{entry.line}</q>
      <span className="ask-picker-facts">
        {demanded(entry) && <span>They ask: {demanded(entry)}</span>}
        <span>You: {have || 'not set'}</span>
      </span>
      {checked && <span className="ask-picker-check">{checked.reason}</span>}
      <span className="ask-picker-levels" role="radiogroup" aria-label={`Your level in ${name}`}>
        {levels.map(({ value, label }) => (
          <button key={value} type="button" role="radio" aria-checked={have === value} autoFocus={have === value} className={have === value ? 'on' : ''} onClick={() => void onPick(name, value)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  )
}

function CheckLine({ check, onRetry }: { check: CheckView; onRetry: () => Promise<void> }) {
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

interface AskRowProps {
  item: RequirementLine
  checked?: CheckAnswer
  onDecision: (answer: SkillAnswer) => Promise<void>
}

type Answer = 'add' | 'dismiss'

const ANSWERS: Record<Answer, { glyph: string; label: string }> = {
  add: { glyph: '+', label: 'I have this' },
  dismiss: { glyph: '−', label: 'I do not have this' },
}

function AskRow({ item, checked, onDecision }: AskRowProps) {
  const [busy, setBusy] = useState<Answer | null>(null)

  const isUnknown = item.verdict === '?'

  async function answer(kind: Answer) {
    if (busy) return
    setBusy(kind)
    try { await onDecision({ requirementIndex: item.index, have: kind === 'add' }) }
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
      {item.evidence && !isUnknown && (
        <span className="ask-evidence">{item.evidence}</span>
      )}
      {isUnknown && (
        <div className="ask-actions">
          {(['add', 'dismiss'] as const).map((kind) => (
            <button key={kind} className={kind} disabled={!!busy} onClick={() => void answer(kind)} aria-label={ANSWERS[kind].label}>
              {busy === kind ? '…' : ANSWERS[kind].glyph}
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
