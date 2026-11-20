import { useState } from 'react'
import { Band, RequirementLine } from '../api/client.ts'

interface Props {
  band: Band
  onDecision: (index: number, have: boolean, chosenSkill?: string) => Promise<void>
}

export function WhatTheyAsk({ band, onDecision }: Props) {
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

      {!hasItems ? (
        <p className="ask-not-found">{band.requirementsText}</p>
      ) : (
        band.groups.map((group) => (
          <div key={group.label}>
            <div className="ask-section-label">{group.label.toUpperCase()}</div>
            <ul className="ask-list" style={{ marginTop: 8 }}>
              {group.items.map((item) => (
                <AskRow key={item.index} item={item} onDecision={onDecision} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

interface AskRowProps {
  item: RequirementLine
  onDecision: (index: number, have: boolean, chosenSkill?: string) => Promise<void>
}

function AskRow({ item, onDecision }: AskRowProps) {
  const [busy, setBusy] = useState<'add' | 'dismiss' | null>(null)

  const isUnknown = item.verdict === '?'
  const namedSkills = item.namedSkills ?? []
  const hasMultipleSkills = isUnknown && namedSkills.length > 1

  async function handleAdd(chosenSkill?: string) {
    if (busy) return
    setBusy('add')
    try { await onDecision(item.index, true, chosenSkill) }
    finally { setBusy(null) }
  }

  async function handleDismiss() {
    if (busy) return
    setBusy('dismiss')
    try { await onDecision(item.index, false) }
    finally { setBusy(null) }
  }

  const mark = item.verdict === '✓' ? '✓' : item.verdict === '✕' ? '✕' : '?'
  const rowCls = item.verdict === '✓' ? 'match' : item.verdict === '✕' ? 'no' : 'unknown'

  return (
    <li className={`ask-row ${rowCls}${busy ? ' pending' : ''}`}>
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
        hasMultipleSkills ? (
          <div className="ask-actions ask-alts">
            {namedSkills.map((skill) => (
              <button
                key={skill}
                className="add"
                disabled={!!busy}
                onClick={() => void handleAdd(skill)}
                aria-label={`Add ${skill}`}
              >
                {busy === 'add' ? '…' : `+ ${skill}`}
              </button>
            ))}
            <button
              className="dismiss"
              disabled={!!busy}
              onClick={() => void handleDismiss()}
              aria-label="I do not have this"
            >
              {busy === 'dismiss' ? '…' : '−'}
            </button>
          </div>
        ) : (
          <div className="ask-actions">
            <button
              className="add"
              disabled={!!busy}
              onClick={() => void handleAdd(namedSkills[0])}
              aria-label="I have this"
            >
              {busy === 'add' ? '…' : '+'}
            </button>
            <button
              className="dismiss"
              disabled={!!busy}
              onClick={() => void handleDismiss()}
              aria-label="I do not have this"
            >
              {busy === 'dismiss' ? '…' : '−'}
            </button>
          </div>
        )
      )}
    </li>
  )
}
