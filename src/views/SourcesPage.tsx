import { useState } from 'react'
import { CollectStatus, StatusResponse, triggerCollect } from '../api/client.ts'
import { useSources } from '../state/sources.ts'
import { OfflineNotice } from './OfflineNotice.tsx'

interface Props {
  status: StatusResponse | null
  applyStatus: (data: CollectStatus) => void
}

const INTERVAL_OPTIONS = [
  { label: '15 minutes', value: '15m' },
  { label: '30 minutes', value: '30m' },
  { label: '1 hour', value: '1h' },
  { label: '3 hours', value: '3h' },
  { label: '6 hours', value: '6h' },
  { label: '12 hours', value: '12h' },
  { label: '1 day', value: '24h' },
  { label: '7 days', value: '168h' },
]

export function SourcesPage({ status, applyStatus }: Props) {
  const { state, add, toggle, remove, updateSchedule, addError } = useSources()
  const [nameVal, setNameVal] = useState('')
  const [urlVal, setUrlVal] = useState('')

  const isCollecting = status?.collecting != null
  const statusText =
    status?.collecting?.text ??
    (status?.lastRun?.state === 'failed' ? status.lastRun.message : null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const ok = await add(nameVal.trim(), urlVal.trim())
    if (ok) {
      setNameVal('')
      setUrlVal('')
    }
  }

  if (state.status === 'offline') return <OfflineNotice />

  if (state.status === 'error') {
    return (
      <div className="list-area list-area--center">
        <p className="list-message">{state.message}</p>
      </div>
    )
  }

  const sources = state.status === 'ok' ? state.sources : []
  const auto = state.status === 'ok' ? state.auto : false
  const interval = state.status === 'ok' ? state.interval : '3h'

  // If the server returns an interval not in the standard list, include it.
  const intervalOpts = INTERVAL_OPTIONS.some((o) => o.value === interval)
    ? INTERVAL_OPTIONS
    : [...INTERVAL_OPTIONS, { label: interval, value: interval }]

  return (
    <div className="settings-page">
      <section className="settings-section">
        <h2 className="settings-heading">Sources</h2>

        {sources.length > 0 && (
          <table className="sources-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Enabled</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.key}>
                  <td>{s.name}</td>
                  <td className="sources-url">{s.url}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => void toggle(s.key, e.target.checked)}
                      aria-label={`Enable ${s.name || s.url}`}
                    />
                  </td>
                  <td>
                    <button className="btn-link" onClick={() => void remove(s.key)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form className="add-source-form" onSubmit={(e) => void handleAdd(e)}>
          <fieldset className="add-source-fields">
            <input
              className="form-input"
              type="text"
              placeholder="Name (optional)"
              aria-label="Source name"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
            />
            <input
              className="form-input"
              type="url"
              placeholder="Address"
              aria-label="Source address"
              required
              value={urlVal}
              onChange={(e) => setUrlVal(e.target.value)}
            />
            <button className="btn-primary" type="submit">
              Add
            </button>
          </fieldset>
          {addError && <p className="form-error">{addError}</p>}
        </form>
      </section>

      <section className="settings-section">
        <h2 className="settings-heading">When collection runs</h2>

        <div className="schedule-row">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => void updateSchedule(e.target.checked, interval)}
            />
            Collect jobs automatically
          </label>
        </div>

        <div className="schedule-row">
          <label className="schedule-interval-label">
            Every
            <select
              className="form-select"
              value={interval}
              onChange={(e) => void updateSchedule(auto, e.target.value)}
            >
              {intervalOpts.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="schedule-row schedule-collect">
          <button
            className="btn-primary"
            disabled={isCollecting}
            onClick={() =>
              void triggerCollect(true).then(applyStatus).catch(() => {})
            }
          >
            Collect jobs
          </button>
          {statusText && <span className="collect-status">{statusText}</span>}
        </div>
      </section>
    </div>
  )
}
