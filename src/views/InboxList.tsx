import { useState } from 'react'
import { addExclusion } from '../api/client.ts'
import { useVacancies } from '../state/vacancies.ts'
import { OfflineNotice } from './OfflineNotice.tsx'
import { SearchField } from './SearchField.tsx'
import { VacancyRow } from './VacancyRow.tsx'

interface Props {
  reloadTrigger?: number
}

export function InboxList({ reloadTrigger }: Props) {
  const [blockCount, setBlockCount] = useState(0)
  const { state, query, setQuery, resetQuery } = useVacancies((reloadTrigger ?? 0) + blockCount)

  async function handleBlock(company: string) {
    await addExclusion('company', company)
    setBlockCount((n) => n + 1)
  }

  if (state.status === 'offline') {
    return <OfflineNotice />
  }

  if (state.status === 'error') {
    return (
      <div className="list-area list-area--center">
        <p className="list-message">{state.message}</p>
      </div>
    )
  }

  const rows = state.status === 'ok' ? state.rows : []
  const total = state.status === 'ok' ? state.total : 0
  const empty = state.status === 'ok' ? state.empty : ''
  const loading = state.status === 'loading'

  return (
    <div className="list-area list-area--col">
      <div className="list-toolbar">
        <SearchField value={query} onChange={setQuery} />
      </div>

      <div className="list-scroll">
        {loading ? null : rows.length === 0 ? (
          <div className="list-empty">
            <p className="list-message">{empty}</p>
            {query.trim() !== '' && (
              <button className="btn-reset" onClick={resetQuery}>
                Reset filters
              </button>
            )}
          </div>
        ) : (
          rows.map((row) => (
              <VacancyRow key={row.id} row={row} onBlock={() => void handleBlock(row.company)} />
            ))
        )}
      </div>

      {!loading && (
        <div className="list-footer">
          Showing {rows.length} / {total} roles
        </div>
      )}
    </div>
  )
}
