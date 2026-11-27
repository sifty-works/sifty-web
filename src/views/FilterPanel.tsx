import { useMemo, useRef } from 'react'
import { useDismiss } from '../dismiss.ts'
import { SourceCount, VacancyFilters } from '../api/client.ts'

interface SourceEntry {
  key: string
  name: string
}

interface Props {
  filters: VacancyFilters
  allSources: SourceEntry[]
  sourceCounts: SourceCount[]
  rowCount: number
  total: number
  onChange: (f: VacancyFilters) => void
  onReset: () => void
  onClose: () => void
}

const FIT_OPTIONS = [
  { value: 'strong', label: 'Strong 75+' },
  { value: 'partial', label: 'Partial 55–74' },
  { value: 'weak', label: 'Weak' },
  { value: 'not_scored', label: 'Not scored' },
] as const

export function FilterPanel({
  filters,
  allSources,
  sourceCounts,
  rowCount,
  total,
  onChange,
  onReset,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(true, onClose, ref)

  const sourceCountMap = useMemo(
    () => new Map(sourceCounts.map((sc) => [sc.name, sc.count])),
    [sourceCounts],
  )

  const sourceList = useMemo(() => {
    const allKeys = new Set(allSources.map((s) => s.key))
    const extra = filters.sources
      .filter((k) => !allKeys.has(k))
      .map((k) => ({ key: k, name: k }))
    return [...allSources, ...extra]
  }, [allSources, filters.sources])

  function toggleFit(value: string) {
    const fit = filters.fit.includes(value)
      ? filters.fit.filter((f) => f !== value)
      : [...filters.fit, value]
    onChange({ ...filters, fit })
  }

  function toggleSource(key: string) {
    const sources = filters.sources.includes(key)
      ? filters.sources.filter((s) => s !== key)
      : [...filters.sources, key]
    onChange({ ...filters, sources })
  }

  const showSources = sourceList.length > 0

  return (
    <div className="filter-popover" ref={ref}>
      <div className="fp-groups">
        <div className="fp-group">
          <h4>Fit</h4>
          <div className="fp-chips">
            {FIT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                className="fp-chip"
                aria-pressed={filters.fit.includes(value)}
                onClick={() => toggleFit(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="fp-group">
          <h4>Published</h4>
          <div className="fp-chips">
            <div className="fp-seg">
              <button
                aria-pressed={filters.published === ''}
                onClick={() => onChange({ ...filters, published: '' })}
              >
                All
              </button>
              <button
                aria-pressed={filters.published === '7'}
                onClick={() => onChange({ ...filters, published: '7' })}
              >
                7 days
              </button>
              <button
                aria-pressed={filters.published === '30'}
                onClick={() => onChange({ ...filters, published: '30' })}
              >
                30 days
              </button>
            </div>
          </div>
        </div>

        <div className="fp-group">
          <h4>Role</h4>
          <div className="fp-chips">
            <button
              className="fp-chip"
              aria-pressed={filters.remote}
              onClick={() => onChange({ ...filters, remote: !filters.remote })}
            >
              Remote
            </button>
            <button
              className="fp-chip"
              aria-pressed={filters.leadership}
              onClick={() => onChange({ ...filters, leadership: !filters.leadership })}
            >
              Leadership title
            </button>
          </div>
        </div>

        {showSources && (
          <div className="fp-group">
            <h4>Sources</h4>
            <div className="fp-chips">
              {sourceList.map(({ key, name }) => (
                <button
                  key={key}
                  className="fp-chip"
                  aria-pressed={filters.sources.includes(key)}
                  onClick={() => toggleSource(key)}
                >
                  {name} <small>({sourceCountMap.get(key) ?? 0})</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="filter-summary">
        <span>Showing {rowCount} / {total} roles</span>
        <button onClick={onReset}>Reset filters</button>
      </div>
    </div>
  )
}
