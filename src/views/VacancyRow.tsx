import { useState } from 'react'
import { VacancyRow as VacancyRowData } from '../api/client.ts'

interface Props {
  row: VacancyRowData
  onBlock?: () => void
}

export function VacancyRow({ row, onBlock }: Props) {
  const [hovering, setHovering] = useState(false)
  const canBlock = onBlock != null && row.company !== 'Unknown'

  return (
    <div
      className="vacancy-row"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="vacancy-row__company">{row.company}</div>
      <div className="vacancy-row__title">{row.title}</div>
      <div className="vacancy-row__meta">
        <span className="vacancy-row__location">{row.location}</span>
        <span className="vacancy-row__sep"> · </span>
        <span className="vacancy-row__published">{row.published}</span>
        {hovering && canBlock && (
          <button className="btn-link vacancy-row__block" onClick={onBlock}>
            Block company
          </button>
        )}
      </div>
    </div>
  )
}
