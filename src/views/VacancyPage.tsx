import { VacancyView } from '../api/client.ts'
import { SessionDecision } from '../state/decisions.ts'

interface Props {
  view: VacancyView
  /**
   * When set, this vacancy was decided in the current session.
   * The actions area shows the session decision state with an Undo button
   * instead of the server-provided actions.
   */
  sessionDecision?: SessionDecision | null
  /** Error text from the last failed action, shown below the actions. */
  actionError?: string | null
  onAction: (key: string, url?: string, message?: string) => void
}

export function VacancyPage({ view, sessionDecision, actionError, onAction }: Props) {
  return (
    <div className="vacancy-page">
      <div className="vacancy-page__header">
        <div className="vacancy-page__company">{view.company}</div>
        <h2 className="vacancy-page__title">{view.title}</h2>
        <div className="vacancy-page__meta">
          {view.expired && <span className="vacancy-expired">Listing expired · </span>}
          <span>{view.published}</span>
          {view.sources.map((s) => (
            <span key={s}> · {s}</span>
          ))}
          {view.original && (
            <span>
              {' · '}
              <a
                className="vacancy-page__link"
                href={view.original}
                target="_blank"
                rel="noreferrer"
              >
                Original listing ↗
              </a>
            </span>
          )}
          {view.applied && (
            <span className="vacancy-page__applied"> · {view.applied}</span>
          )}
        </div>
        {view.status && (
          <div className="vacancy-page__status">{view.status}</div>
        )}
      </div>

      <div className="vacancy-page__actions">
        {sessionDecision ? (
          <SessionDecisionActions decision={sessionDecision} onUndo={() => onAction('undo')} />
        ) : (
          view.actions.map((action) => (
            <button
              key={action.key}
              className="btn-action"
              onClick={() => onAction(action.key, action.url, action.message)}
              title={action.message}
            >
              {action.label}
            </button>
          ))
        )}
        {actionError && (
          <div className="vacancy-page__action-error">{actionError}</div>
        )}
      </div>

      <div className="vacancy-page__listing">
        <div className="vacancy-listing__state">{view.listing.state}</div>
        {view.listing.html ? (
          <div
            className="vacancy-listing__body"
            dangerouslySetInnerHTML={{ __html: view.listing.html }}
          />
        ) : (
          <p className="vacancy-listing__empty">{view.listing.empty}</p>
        )}
      </div>
    </div>
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
      : 'Dismissed — hidden after this session'

  return (
    <>
      <span className="vacancy-page__decided-text">{text}</span>
      <button className="btn-action" onClick={onUndo}>
        Undo
      </button>
    </>
  )
}
