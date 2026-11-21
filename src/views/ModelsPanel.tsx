import { useEffect, useState } from 'react'
import { ModelsPatch, ModelsResponse, ProviderView, WorkView } from '../api/client.ts'
import { useModels } from '../state/models.ts'

const WORK_NAMES: Record<string, string> = {
  reading: 'Reading',
  shortlist_check: 'Shortlist check',
  preparation: 'Preparation',
}

function workName(kind: string): string {
  return WORK_NAMES[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
}

function options(work: WorkView): string[] {
  return work.provider && !work.choices.includes(work.provider)
    ? [work.provider, ...work.choices]
    : work.choices
}

export function ModelsPanel() {
  const { state, error, save, check } = useModels()
  const [checking, setChecking] = useState<string | null>(null)

  if (state.status === 'loading') return <p className="muted">Loading…</p>
  if (state.status === 'offline') {
    return <p className="muted">Sifty is not running. Start it and refresh the page.</p>
  }

  const models = state.models

  async function runCheck(name: string) {
    setChecking(name)
    await check(name)
    setChecking(null)
  }

  return (
    <>
      <h1>Models</h1>
      <p className="lead">Each kind of work uses the provider you choose. Nothing paid is used in bulk unless you allow it.</p>
      {error && <p className="error">{error}</p>}

      <section className="s-card">
        <h2>Work</h2>
        <table className="sites-table">
          <thead>
            <tr>
              <th>Work</th>
              <th>Provider</th>
            </tr>
          </thead>
          <tbody>
            {models.work.map((w) => (
              <tr key={w.kind}>
                <td>{workName(w.kind)}</td>
                <td>
                  <select
                    value={w.provider}
                    aria-label={`${workName(w.kind)} provider`}
                    onChange={(e) => void save({ work: { [w.kind]: e.target.value } })}
                  >
                    <option value="">Not chosen</option>
                    {options(w).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="s-card">
        <h2>Providers</h2>
        {models.providers.length === 0
          ? <p className="muted">No providers configured yet.</p>
          : (
            <table className="sites-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Model</th>
                  <th>Cost</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {models.providers.map((p: ProviderView) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.kind}</td>
                    <td>{p.model || <span className="muted">—</span>}</td>
                    <td>{p.cost}</td>
                    <td>
                      {checking === p.name
                        ? <span className="muted">Checking…</span>
                        : p.state || <span className="muted">Not checked</span>}
                    </td>
                    <td>
                      <button disabled={checking === p.name} onClick={() => void runCheck(p.name)}>
                        Check
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </section>

      <BackgroundWork models={models} onSave={save} />
    </>
  )
}

interface BackgroundWorkProps {
  models: ModelsResponse
  onSave: (patch: ModelsPatch) => Promise<void>
}

function BackgroundWork({ models, onSave }: BackgroundWorkProps) {
  const [limit, setLimit] = useState(String(models.dailyLimit))

  useEffect(() => { setLimit(String(models.dailyLimit)) }, [models.dailyLimit])

  function commitLimit() {
    const text = limit.trim()
    const value = Number(text)
    if (text === '' || !Number.isInteger(value) || value < 0) {
      setLimit(String(models.dailyLimit))
      return
    }
    if (value !== models.dailyLimit) void onSave({ dailyLimit: value })
  }

  return (
    <section className="s-card">
      <h2>Background work</h2>
      <label className="s-switch-row">
        <input
          type="checkbox"
          checked={models.allowPaidBulk}
          onChange={(e) => void onSave({ allowPaidBulk: e.target.checked })}
        />
        Allow paid bulk work
      </label>
      <label className="s-switch-row" style={{ marginTop: 8 }}>
        <input
          type="checkbox"
          checked={models.paused}
          onChange={(e) => void onSave({ paused: e.target.checked })}
        />
        Pause background model work
      </label>
      <label className="s-switch-row" style={{ marginTop: 12 }}>
        Daily limit of background model calls
        <input
          type="number"
          min={0}
          style={{ width: 90 }}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onBlur={commitLimit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLimit() }}
        />
        <span className="muted">0 means no limit</span>
      </label>
      <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
        {models.todayCalls} background calls today
      </p>
    </section>
  )
}
