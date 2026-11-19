import { useEffect, useMemo, useRef } from 'react'
import { IndustryCount, SourceCount, VacancyFilters } from '../api/client.ts'

interface SourceEntry {
  key: string
  name: string
}

interface Props {
  filters: VacancyFilters
  allIndustries: string[]
  allSources: SourceEntry[]
  industryCounts: IndustryCount[]
  sourceCounts: SourceCount[]
  rowCount: number
  total: number
  onChange: (f: VacancyFilters) => void
  onReset: () => void
  onClose: () => void
}

export function FilterPanel({
  filters,
  allIndustries,
  allSources,
  industryCounts,
  sourceCounts,
  rowCount,
  total,
  onChange,
  onReset,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Build count lookup maps.
  const industryCountMap = useMemo(
    () => new Map(industryCounts.map((ic) => [ic.name, ic.count])),
    [industryCounts],
  )
  const sourceCountMap = useMemo(
    () => new Map(sourceCounts.map((sc) => [sc.name, sc.count])),
    [sourceCounts],
  )

  // Show all vocabulary entries; also show any selected entry not in the vocabulary.
  const industryList = useMemo(() => {
    const extra = filters.industries.filter((n) => !allIndustries.includes(n))
    return [...allIndustries, ...extra]
  }, [allIndustries, filters.industries])

  const sourceList = useMemo(() => {
    const allKeys = new Set(allSources.map((s) => s.key))
    const extra = filters.sources
      .filter((k) => !allKeys.has(k))
      .map((k) => ({ key: k, name: k }))
    return [...allSources, ...extra]
  }, [allSources, filters.sources])

  function toggleIndustry(name: string) {
    const industries = filters.industries.includes(name)
      ? filters.industries.filter((i) => i !== name)
      : [...filters.industries, name]
    onChange({ ...filters, industries })
  }

  function toggleSource(key: string) {
    const sources = filters.sources.includes(key)
      ? filters.sources.filter((s) => s !== key)
      : [...filters.sources, key]
    onChange({ ...filters, sources })
  }

  const showIndustries = industryList.length > 0
  const showSources = sourceList.length > 0

  return (
    <div className="filter-popover" ref={ref}>
      <div className="fp-groups">
        <div className="fp-group">
          <h4>Collected</h4>
          <div className="fp-chips">
            <div className="fp-seg">
              <button
                aria-pressed={filters.collected === ''}
                onClick={() => onChange({ ...filters, collected: '' })}
              >
                Any time
              </button>
              <button
                aria-pressed={filters.collected === '7'}
                onClick={() => onChange({ ...filters, collected: '7' })}
              >
                7 days
              </button>
              <button
                aria-pressed={filters.collected === '30'}
                onClick={() => onChange({ ...filters, collected: '30' })}
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

        {showIndustries && (
          <div className="fp-group">
            <h4>Industries</h4>
            <div className="fp-chips">
              {industryList.map((name) => (
                <button
                  key={name}
                  className="fp-chip"
                  aria-pressed={filters.industries.includes(name)}
                  onClick={() => toggleIndustry(name)}
                >
                  {name} <small>({industryCountMap.get(name) ?? 0})</small>
                </button>
              ))}
            </div>
          </div>
        )}

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
