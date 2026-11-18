import { VacancyRow as VacancyRowData } from '../api/client.ts'

interface Props {
  row: VacancyRowData
  selected?: boolean
  onSelect: () => void
  /** Set when this row was decided in the current session: 'shortlist' | 'dismissed'. */
  decidedTo?: string | null
}

export function VacancyRow({ row, selected, onSelect, decidedTo }: Props) {
  return (
    <div
      className={[
        'vacancy-row',
        row.unread ? 'vacancy-row--unread' : '',
        selected ? 'vacancy-row--selected' : '',
        decidedTo ? 'vacancy-row--decided' : '',
      ].filter(Boolean).join(' ')}
      onClick={onSelect}
    >
      <div className="vacancy-row__company">{row.company}</div>
      <div className="vacancy-row__title">
        {decidedTo === 'shortlist' && (
          <span className="vacancy-row__decided-badge vacancy-row__decided-badge--shortlist">✓ Shortlisted · </span>
        )}
        {decidedTo === 'dismissed' && (
          <span className="vacancy-row__decided-badge vacancy-row__decided-badge--dismissed">Dismissed · </span>
        )}
        {row.title}
      </div>
      <div className="vacancy-row__meta">
        {row.expired && <span className="vacancy-expired">Listing expired · </span>}
        <span className="vacancy-row__location">{row.location}</span>
        <span className="vacancy-row__sep"> · </span>
        <span className="vacancy-row__published">{row.published}</span>
        {row.applied && (
          <>
            <span className="vacancy-row__sep"> · </span>
            <span className="vacancy-row__applied">{row.applied}</span>
          </>
        )}
      </div>
    </div>
  )
}
