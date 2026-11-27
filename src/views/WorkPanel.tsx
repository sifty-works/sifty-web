import { WorkResponse, WorkRunning } from '../api/client.ts'
import { type UseRemoteResult } from '../state/work.ts'
import { Refusal } from './Refusal.tsx'
import { OfflineNotice } from './OfflineNotice.tsx'
import { localTime, WorkSection } from './WorkTable.tsx'

function progressText(job: WorkRunning): string {
  return job.progress ? `${job.progress.done} of ${job.progress.total}` : ''
}

export function WorkPanel({ work: { state, note } }: { work: UseRemoteResult<WorkResponse> }) {

  if (state.status === 'loading') return <p className="muted">Loading…</p>
  if (state.status === 'offline') return <OfflineNotice />

  return (
    <>
      <h1>Background work</h1>
      <p className="lead">What Sifty is doing in the background, and what is waiting and why.</p>
      <Refusal note={note} />
      {state.status === 'ok' && (
        <>
          <WorkSection
            title="Running"
            empty="Nothing is running."
            columns={['Work', 'Subject', 'Progress', 'Since']}
            rows={state.data.running.map((job) => ({
              key: job.id,
              cells: [job.label, job.subject, progressText(job), localTime(job.since)],
            }))}
          />
          <WorkSection
            title="Waiting"
            empty="Nothing is waiting."
            columns={['Work', 'Waiting', 'Reason']}
            rows={state.data.waiting.map((row) => ({
              key: row.kind,
              cells: [row.label, String(row.count), row.reason?.text ?? ''],
            }))}
          />
        </>
      )}
    </>
  )
}
