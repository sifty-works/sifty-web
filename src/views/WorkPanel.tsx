import { WorkRunning } from '../api/client.ts'
import { useWork } from '../state/work.ts'
import { Message } from './Messages.tsx'

function localTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function progressText(job: WorkRunning): string {
  return job.progress ? `${job.progress.done} of ${job.progress.total}` : ''
}

export function WorkPanel() {
  const { state, note } = useWork()

  if (state.status === 'loading') return <p className="muted">Loading…</p>
  if (state.status === 'offline') {
    return <p className="muted">Sifty is not running. Start it and refresh the page.</p>
  }

  return (
    <>
      <h1>Background work</h1>
      <p className="lead">What Sifty is doing in the background, what is waiting and why, and what failed in the last 7 days.</p>
      <Message note={note} />
      {state.status === 'ok' && (
        <>
          <WorkSection
            title="Running"
            empty="Nothing is running."
            columns={['Work', 'Subject', 'Progress', 'Since']}
            rows={state.work.running.map((job) => ({
              key: job.id,
              cells: [job.label, job.subject, progressText(job), localTime(job.since)],
            }))}
          />
          <WorkSection
            title="Waiting"
            empty="Nothing is waiting."
            columns={['Work', 'Waiting', 'Reason']}
            rows={state.work.waiting.map((row) => ({
              key: row.kind,
              cells: [row.label, String(row.count), row.reason?.text ?? ''],
            }))}
          />
          <WorkSection
            title="Failed in the last 7 days"
            empty="Nothing failed."
            columns={['Work', 'Subject', 'Failed', 'Reason']}
            rows={state.work.failed.map((job) => ({
              key: job.id,
              cells: [job.label, job.subject, localTime(job.at), job.reason],
            }))}
          />
        </>
      )}
    </>
  )
}

interface SectionProps {
  title: string
  empty: string
  columns: string[]
  rows: { key: string | number; cells: string[] }[]
}

function WorkSection({ title, empty, columns, rows }: SectionProps) {
  return (
    <section className="s-card">
      <h2>{title}</h2>
      {rows.length === 0
        ? <p className="muted">{empty}</p>
        : (
          <table className="sites-table work-table">
            <thead>
              <tr>
                {columns.map((name) => <th key={name}>{name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  {row.cells.map((cell, i) => <td key={columns[i]}>{cell || <span className="muted">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </section>
  )
}
