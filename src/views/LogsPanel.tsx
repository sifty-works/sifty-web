import { useState } from 'react'
import { LogEntry } from '../api/client.ts'
import { useLogs } from '../state/work.ts'
import { Refusal } from './Refusal.tsx'
import { OfflineNotice } from './OfflineNotice.tsx'
import { localTime, WorkSection } from './WorkTable.tsx'

function attrsText(entry: LogEntry): string {
  return entry.attrs.map((a) => `${a.key}=${a.value}`).join(' ')
}

export function LogsPanel() {
  const { state, note, reload } = useLogs()
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    await reload()
    setBusy(false)
  }

  if (state.status === 'loading') return <p className="muted">Loading…</p>
  if (state.status === 'offline') return <OfflineNotice />

  return (
    <>
      <h1>Logs</h1>
      <p className="lead">What failed in the last 7 days, and the latest warnings and errors of the server log.</p>
      <p><button disabled={busy} onClick={() => void refresh()}>Refresh</button></p>
      <Refusal note={note} />
      {state.status === 'ok' && (
        <>
          <WorkSection
            title="Failed in the last 7 days"
            empty="Nothing failed."
            columns={['Work', 'Subject', 'Failed', 'Reason']}
            rows={state.data.failed.map((job) => ({
              key: job.id,
              cells: [job.label, job.subject, localTime(job.at), job.reason],
            }))}
          />
          <WorkSection
            title="Warnings and errors"
            empty="Nothing in the log."
            columns={['Time', 'Level', 'Message', 'Attributes']}
            rows={state.data.entries.map((entry, i) => ({
              key: i,
              cells: [localTime(entry.time), entry.level, entry.message, attrsText(entry)],
            }))}
          />
        </>
      )}
    </>
  )
}
