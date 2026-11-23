import { useEffect, useRef, useState } from 'react'
import { Band, CheckAnswer, CheckView, RequirementLine } from '../api/client.ts'

interface Props {
  band: Band
  check?: CheckView | null
  onDecision: (index: number, have: boolean, chosenSkill?: string) => Promise<void>
  onRetry: () => Promise<void>
}

export function WhatTheyAsk({ band, check, onDecision, onRetry }: Props) {
  const answers = new Map((check?.answers ?? []).map((a) => [a.index, a]))
  const totalItems = band.groups.reduce((sum, g) => sum + g.items.length, 0)
  const hasItems = totalItems > 0

  let okCount = 0, noCount = 0, nsCount = 0
  for (const group of band.groups) {
    for (const item of group.items) {
      if (item.verdict === '✓') okCount++
      else if (item.verdict === '✕') noCount++
      else nsCount++
    }
  }

  const subtitle = hasItems
    ? `${totalItems} requirement${totalItems === 1 ? '' : 's'}`
    : band.requirementsText

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
          <span className="card-subtitle">{subtitle}</span>
        </div>
        {hasItems && (okCount > 0 || noCount > 0 || nsCount > 0) && (
          <div className="card-counts" aria-label="Requirement counts">
            {okCount > 0 && <span className="count-pill ok">✓ {okCount}</span>}
            {noCount > 0 && <span className="count-pill no">✕ {noCount}</span>}
            {nsCount > 0 && <span className="count-pill ns">? {nsCount}</span>}
          </div>
        )}
      </div>

      {check && <CheckLine check={check} onRetry={onRetry} />}

      {!hasItems ? (
        <p className="ask-not-found">{band.requirementsText}</p>
      ) : (
        band.groups.map((group) => (
          <div key={group.label}>
            <div className="ask-section-label">{group.label.toUpperCase()}</div>
            <ul className="ask-list" style={{ marginTop: 8 }}>
              {group.items.map((item) => (
                <AskRow key={item.index} item={item} checked={answers.get(item.index)} onDecision={onDecision} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
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
  onDecision: (index: number, have: boolean, chosenSkill?: string) => Promise<void>
}

type Answer = 'add' | 'dismiss'

const ANSWERS = {
  add: {
    glyph: '+',
    label: 'I have this',
    skillLine: (skill: string) => `I have ${skill}`,
    wholeLine: 'I have this requirement',
  },
  dismiss: {
    glyph: '−',
    label: 'I do not have this',
    skillLine: (skill: string) => `I do not have ${skill}`,
    wholeLine: 'I do not have this requirement',
  },
}

interface AnswerControlProps {
  kind: Answer
  skills: string[]
  busy: Answer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (chosenSkill?: string) => void
}

function AnswerControl({ kind, skills, busy, open, onOpenChange, onChoose }: AnswerControlProps) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const copy = ANSWERS[kind]
  const hasList = skills.length > 1

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (hostRef.current && !hostRef.current.contains(e.target as Node)) onOpenChange(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onOpenChange(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, onOpenChange])

  function choose(chosenSkill?: string) {
    onOpenChange(false)
    onChoose(chosenSkill)
  }

  const button = (
    <button
      ref={buttonRef}
      className={kind}
      disabled={!!busy}
      onClick={() => (hasList ? onOpenChange(!open) : onChoose(kind === 'add' ? skills[0] : undefined))}
      aria-label={copy.label}
      {...(hasList ? { 'aria-haspopup': 'menu' as const, 'aria-expanded': open } : {})}
    >
      {busy === kind ? '…' : copy.glyph}
    </button>
  )

  if (!hasList) return button

  return (
    <span className="ask-choice" ref={hostRef}>
      {button}
      {open && (
        <div className="ask-menu" role="menu">
          {skills.map((skill) => (
            <button key={skill} role="menuitem" onClick={() => choose(skill)}>
              {copy.skillLine(skill)}
            </button>
          ))}
          <button role="menuitem" onClick={() => choose()}>
            {copy.wholeLine}
          </button>
        </div>
      )}
    </span>
  )
}

function AskRow({ item, checked, onDecision }: AskRowProps) {
  const [busy, setBusy] = useState<Answer | null>(null)
  const [openList, setOpenList] = useState<Answer | null>(null)

  const isUnknown = item.verdict === '?'
  const namedSkills = item.namedSkills ?? []

  async function answer(kind: Answer, chosenSkill?: string) {
    if (busy) return
    setBusy(kind)
    try { await onDecision(item.index, kind === 'add', chosenSkill) }
    finally { setBusy(null) }
  }

  const setListOpen = (kind: Answer) => (open: boolean) =>
    setOpenList((current) => (open ? kind : current === kind ? null : current))

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
            <AnswerControl
              key={kind}
              kind={kind}
              skills={namedSkills}
              busy={busy}
              open={openList === kind}
              onOpenChange={setListOpen(kind)}
              onChoose={(chosenSkill) => void answer(kind, chosenSkill)}
            />
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
