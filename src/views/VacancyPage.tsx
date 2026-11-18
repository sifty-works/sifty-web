import { Fragment } from 'react'
import { VacancyView } from '../api/client.ts'
import { SessionDecision } from '../state/decisions.ts'

// Keys that map to keyboard shortcut hints shown as <kbd> caps.
const KEY_HINT: Record<string, string> = { select: 'Y', dismiss: 'N', apply: 'A' }
const GLYPH: Record<string, string> = { select: '✓', dismiss: '✕', confirm: '✓', delete: '×' }

// Keys rendered as small link-buttons on a second line below main actions.
const LINK_KEYS = new Set(['confirm', 'delete'])

interface Props {
  view: VacancyView
  sessionDecision?: SessionDecision | null
  actionError?: string | null
  onAction: (key: string, url?: string, message?: string) => void
}

export function VacancyPage({ view, sessionDecision, actionError, onAction }: Props) {
  const mainActions = view.actions?.filter((a) => !LINK_KEYS.has(a.key)) ?? []
  const linkActions = view.actions?.filter((a) => LINK_KEYS.has(a.key)) ?? []

  // Shortlist layout when the server supplies an 'apply' action.
  const applyAction = mainActions.find((a) => a.key === 'apply')
  const isShortlist = applyAction != null

  return (
    <>
      <div className="detail-top">
        <div className="role-heading">
          <p className="company">{view.company}</p>
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
          ) : isShortlist ? (
            /* Shortlist: .shortlist-top + .action-links-row (see application.css) */
            <>
              <div className="shortlist-top">
                {/* All main actions except apply render as plain buttons on the left */}
                {mainActions
                  .filter((a) => a.key !== 'apply')
                  .map((a) => (
                    <ActionButton key={a.key} action={a} onAction={onAction} />
                  ))}
                {/* Apply seg on the right — no "via employer site" right segment yet */}
                <div className="apply-seg">
                  <button
                    className="apply-seg-active"
                    onClick={() => onAction(applyAction.key, applyAction.url, applyAction.message)}
                  >
                    {applyAction.label} ↗ <kbd>A</kbd>
                  </button>
                </div>
              </div>
              {linkActions.length > 0 && (
                <div className="action-links-row">
                  {linkActions.map((action, i) => (
                    <Fragment key={action.key}>
                      {i > 0 && (
                        <span className="action-links-sep" aria-hidden="true">|</span>
                      )}
                      <ActionButton action={action} onAction={onAction} />
                    </Fragment>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Inbox / archive: plain action buttons + optional link row */
            <>
              {mainActions.map((action) => (
                <ActionButton key={action.key} action={action} onAction={onAction} />
              ))}
              {linkActions.length > 0 && (
                <div className="action-links-row">
                  {linkActions.map((action, i) => (
                    <Fragment key={action.key}>
                      {i > 0 && (
                        <span className="action-links-sep" aria-hidden="true">|</span>
                      )}
                      <ActionButton action={action} onAction={onAction} />
                    </Fragment>
                  ))}
                </div>
              )}
            </>
          )}
          {actionError && (
            <span className="danger" style={{ fontSize: 13 }}>{actionError}</span>
          )}
        </div>
      </div>

      <section className="listing-panel" style={{ marginTop: 24 }}>
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
    </>
  )
}

interface ActionButtonProps {
  action: { key: string; label: string; url?: string; message?: string }
  onAction: (key: string, url?: string, message?: string) => void
}

function ActionButton({ action, onAction }: ActionButtonProps) {
  const hint = KEY_HINT[action.key]
  const glyph = GLYPH[action.key]
  const label = glyph ? `${glyph} ${action.label}` : action.label
  const cls =
    action.key === 'select' ? 'primary'
    : action.key === 'delete' ? 'link-button split-delete'
    : action.key === 'dismiss' ? 'no-button'
    : action.key === 'confirm' ? 'link-button'
    : ''
  return (
    <button
      className={cls || undefined}
      onClick={() => onAction(action.key, action.url, action.message)}
    >
      {label}{hint && <kbd>{hint}</kbd>}
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
