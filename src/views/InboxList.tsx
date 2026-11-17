import { useVacancies } from '../state/vacancies.ts'

export function InboxList() {
  const state = useVacancies()

  if (state.status === 'loading') {
    return <div className="list-area list-area--center" />
  }

  if (state.status === 'offline') {
    return (
      <div className="list-area list-area--center">
        <p className="list-message">
          Sifty is not running. Start it and refresh the page.
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="list-area list-area--center">
        <p className="list-message">{state.message}</p>
      </div>
    )
  }

  if (state.rows.length === 0) {
    return (
      <div className="list-area list-area--center">
        <p className="list-message">{state.empty}</p>
      </div>
    )
  }

  return <div className="list-area">{/* rows rendered in later slices */}</div>
}
