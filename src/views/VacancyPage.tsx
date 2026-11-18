import { VacancyView } from '../api/client.ts'

interface Props {
  view: VacancyView
  onAction: (key: string, url?: string) => void
}

export function VacancyPage({ view, onAction }: Props) {
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

      {view.actions.length > 0 && (
        <div className="vacancy-page__actions">
          {view.actions.map((action) => (
            <button
              key={action.key}
              className="btn-action"
              onClick={() => onAction(action.key, action.url)}
              title={action.message}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

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
