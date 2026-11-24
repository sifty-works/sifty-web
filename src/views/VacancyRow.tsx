import { VacancyRow as VacancyRowData } from '../api/client.ts'

interface Props {
  row: VacancyRowData
  selected?: boolean
  onSelect: () => void

  decidedTo?: string | null
}

export function VacancyRow({ row, selected, onSelect, decidedTo }: Props) {
  const classes = [
    'job-row',
    row.unread ? 'unseen' : 'seen',
    selected ? 'selected' : '',
    decidedTo === 'dismissed' ? 'session-no' : '',
  ].filter(Boolean).join(' ')

  const { fit } = row
  const scoreClasses = [
    'score',
    fit.bucket.toLowerCase() === 'strong' ? 'strong' : '',
    fit.dimmed ? 'previous' : '',
  ].filter(Boolean).join(' ')

  const isCounts = fit.requirementsText.startsWith('✓')
  const scoreTitle = fit.requirementsText
    ? `${fit.text} · ${fit.requirementsText}`
    : fit.text

  return (
    <button className={classes} onClick={onSelect} aria-pressed={selected}>
      <div className="row-company">
        <span className="row-co-name">{row.company}</span>
      </div>
      <div className="row-icons">
        {fit.score !== null && (
          <span className={scoreClasses} title={scoreTitle}>{fit.score}</span>
        )}
        {isCounts && (
          <span className="score" title={scoreTitle}>{fit.requirementsText}</span>
        )}
      </div>
      <strong>
        {decidedTo === 'shortlist' && <span className="yes-check" title="Shortlisted">✓ </span>}
        {row.title}
      </strong>
      <div className="row-location" title={row.locationFull}>
        {row.expired && <span title="Listing expired">◷ </span>}
        {row.location}
        {row.applied && <span> · {row.applied}</span>}
      </div>
      <div className="row-location">{row.published}</div>
    </button>
  )
}
