import { VacancyRow as VacancyRowData } from '../api/client.ts'

interface Props {
  row: VacancyRowData
  selected?: boolean
  onSelect: () => void
  /** Set when this row was decided in the current session: 'shortlist' | 'dismissed'. */
  decidedTo?: string | null
}

export function VacancyRow({ row, selected, onSelect, decidedTo }: Props) {
  const classes = [
    'job-row',
    row.unread ? 'unseen' : 'seen',
    selected ? 'selected' : '',
    decidedTo === 'dismissed' ? 'session-no' : '',
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} onClick={onSelect} aria-pressed={selected}>
      <div className="row-company">{row.company}</div>
      <strong>
        {decidedTo === 'shortlist' && <span className="yes-check" title="Shortlisted">✓ </span>}
        {row.title}
      </strong>
      <div className="row-location">
        {row.expired && <span title="Listing expired">◷ </span>}
        {row.location}
        {row.applied && <span> · {row.applied}</span>}
      </div>
      <div className="row-location">{row.published}</div>
    </button>
  )
}
