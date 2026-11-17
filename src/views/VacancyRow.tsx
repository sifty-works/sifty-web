import { VacancyRow as VacancyRowData } from '../api/client.ts'

interface Props {
  row: VacancyRowData
}

export function VacancyRow({ row }: Props) {
  return (
    <div className="vacancy-row">
      <div className="vacancy-row__company">{row.company}</div>
      <div className="vacancy-row__title">{row.title}</div>
      <div className="vacancy-row__meta">
        <span className="vacancy-row__location">{row.location}</span>
        <span className="vacancy-row__sep"> · </span>
        <span className="vacancy-row__published">{row.published}</span>
      </div>
    </div>
  )
}
