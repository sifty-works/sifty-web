import { Fragment, useState } from 'react'
import { VacancyAction, VacancyView } from '../api/client.ts'
import { SessionDecision } from '../state/decisions.ts'
import type { Note } from '../state/messages.ts'
import { FitBand } from './FitBand.tsx'
import { Message } from './Messages.tsx'
import { WhatTheyAsk } from './WhatTheyAsk.tsx'
import { WhatTheyOffer } from './WhatTheyOffer.tsx'

type Place = 'main' | 'links' | 'segment'
interface ActionStyle { lead?: string; trail?: string; code?: string; cls?: string; place?: Place }

export const ACTIONS: Record<string, ActionStyle> = {
  block: {},
  dismiss: { lead: '✕', code: 'KeyN', cls: 'no-button' },
  select: { lead: '✓', code: 'KeyY', cls: 'primary' },
  inbox: {},
  apply: { trail: '↗', code: 'KeyA', cls: 'apply-seg-active', place: 'segment' },
  confirm: { lead: '✓', cls: 'link-button', place: 'links' },
  delete: { lead: '×', cls: 'link-button split-delete', place: 'links' },
  undo: {},
  restore: {},
}

interface Props {
  view: VacancyView
  sessionDecision?: SessionDecision | null
  actionError?: Note | null
  notice?: Note | null
  onAction: (key: string) => void
  onClearNotice: () => void
  onSkillDecision: (index: number, have: boolean, chosenSkill?: string) => Promise<void>
  onCheckRetry: () => Promise<void>
}

export function VacancyPage({ view, sessionDecision, actionError, notice, onAction, onClearNotice, onSkillDecision, onCheckRetry }: Props) {
  const placed = (place: Place) =>
    (view.actions ?? []).filter((a) => (ACTIONS[a.key]?.place ?? 'main') === place)
  const buttons = (list: VacancyAction[]) =>
    list.map((a) => <ActionButton key={a.key} action={a} onAction={onAction} />)
  const mainRow = buttons(placed('main'))
  const segment = placed('segment')
  const links = placed('links')

  const appAvailable = false
  const appDisabledHint = view.stage === 'inbox'
    ? 'Shortlist this role to open Application'
    : 'Application is not available yet'
  const [activeTab, setActiveTab] = useState<'overview' | 'application'>('overview')

  return (
    <>
      <div className="detail-top">
        <div className="role-heading">
          <p className="company">
            {view.industries.map((ind) => <span key={ind} className="ind-chip">{ind}</span>)}
            {view.company}
          </p>
          <h1>{view.title}</h1>
          <div className="role-meta">
            {view.expired && <span className="state-expired">Listing expired</span>}
            <span>{view.published}</span>
            {view.sources.map((s) =>
              s.url ? (
                <a key={s.name} className="source-link" href={s.url} target="_blank" rel="noreferrer" title={`Found on ${s.name}`}>
                  {s.name}
                </a>
              ) : (
                <span key={s.name} className="source-link" title={`Found on ${s.name}`}>{s.name}</span>
              ),
            )}
            {view.original && (
              <a href={view.original} target="_blank" rel="noreferrer">
                Original listing ↗
              </a>
            )}
            {view.applied && <span>{view.applied}</span>}
          </div>
          {view.status && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{view.status}</p>}
        </div>

        <div className="review-actions">
          {sessionDecision ? (
            <SessionDecisionActions
              decision={sessionDecision}
              onUndo={() => onAction('undo')}
            />
          ) : (
            <>
              {segment.length > 0 ? (
                <div className="shortlist-top">
                  {mainRow}
                  <div className="apply-seg">{buttons(segment)}</div>
                </div>
              ) : mainRow}
              {links.length > 0 && (
                <div className="action-links-row">
                  {links.map((action, i) => (
                    <Fragment key={action.key}>
                      {i > 0 && <span className="action-links-sep" aria-hidden="true">|</span>}
                      <ActionButton action={action} onAction={onAction} />
                    </Fragment>
                  ))}
                </div>
              )}
            </>
          )}
          <Message note={actionError} inline />
        </div>
      </div>

      <div className="detail-tabs-row">
        <div className="detail-tabs" role="tablist">
          <button
            role="tab"
            className={activeTab === 'overview' ? 'active' : undefined}
            aria-selected={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            role="tab"
            className={activeTab === 'application' ? 'active' : undefined}
            aria-selected={activeTab === 'application'}
            disabled={!appAvailable}
            title={appDisabledHint}
            onClick={() => { if (appAvailable) setActiveTab('application') }}
          >
            Application
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          <Message note={notice} onDismiss={onClearNotice} />

          <FitBand band={view.band} />

          <div className="what-cards" style={{ marginTop: 14 }}>
            <WhatTheyAsk band={view.band} check={view.check} onDecision={onSkillDecision} onRetry={onCheckRetry} />
            <WhatTheyOffer offer={view.offer} />
          </div>

          <div className="overview-stack">
            <section className="listing-panel">
              <header className="panel-head">
                <h2>Listing text</h2>
                {view.listing.state && <span className="panel-sub">{view.listing.state}</span>}
              </header>
              {view.listing.html ? (
                <div
                  className="listing-text"
                  dangerouslySetInnerHTML={{ __html: view.listing.html }}
                />
              ) : (
                <p className="listing-missing">{view.listing.empty}</p>
              )}
            </section>
          </div>
        </>
      )}
    </>
  )
}

interface ActionButtonProps {
  action: VacancyAction
  onAction: (key: string) => void
}

function ActionButton({ action, onAction }: ActionButtonProps) {
  const { lead, trail, code, cls } = ACTIONS[action.key] ?? {}
  const text = `${lead ? `${lead} ` : ''}${action.label}${trail ? ` ${trail} ` : ''}`
  return (
    <button
      className={cls}
      onClick={() => onAction(action.key)}
    >
      {text}{code && <kbd>{code.replace('Key', '')}</kbd>}
    </button>
  )
}

interface SessionDecisionActionsProps {
  decision: SessionDecision
  onUndo: () => void
}

function SessionDecisionActions({ decision, onUndo }: SessionDecisionActionsProps) {
  const text =
    decision.to === 'shortlist'
      ? 'Moved to Shortlist'
      : decision.to === 'applied'
        ? 'Confirmed application'
        : 'Dismissed — hidden after this session'

  return (
    <>
      <span className={decision.to === 'dismissed' ? 'danger' : 'muted'}>{text}</span>
      <button onClick={onUndo}>Undo</button>
    </>
  )
}
