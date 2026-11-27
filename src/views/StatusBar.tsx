import { StatusExtra, WorkResponse } from '../api/client.ts'
import { type RemoteState } from '../state/work.ts'
import { type StatusState } from '../state/status.ts'
import { OFFLINE_TEXT } from './OfflineNotice.tsx'
import { localTime } from './WorkTable.tsx'

interface Props {
  status: StatusState
  work: RemoteState<WorkResponse>
  onOpen: () => void
}

type Tone = 'idle' | 'running' | 'amber' | 'offline'

interface Queue {
  label: string
  count: number
  reason: string | null
  code: string | null
}

interface Line {
  tone: Tone
  title: string
  detail: string
  progress: { done: number; total: number } | null
  queues: Queue[]
}

function runningLine(status: StatusExtra, work: WorkResponse | null): Omit<Line, 'queues' | 'tone'> | null {
  if (status.collecting) {
    const { done, total, text } = status.collecting
    return { title: text, detail: '', progress: total > 0 ? { done, total } : null }
  }
  const job = work?.running[0]
  if (!job) return null
  const parts = [job.subject, job.model ? `${job.model.provider} · ${job.model.model}` : ''].filter(Boolean)
  const more = (work?.running.length ?? 1) - 1
  if (more > 0) parts.push(`+${more} more`)
  return { title: job.label, detail: parts.join(' · '), progress: job.progress }
}

function idleDetail(status: StatusExtra): string {
  const last = status.lastRun?.state === 'failed' ? null : status.lastRun
  const when = last ? `Last collection ${localTime(last.finished)}` : 'No collection yet'
  return `${when} · ${status.catalogue} in the catalogue`
}

function lineOf(state: StatusState, work: RemoteState<WorkResponse>): Line | null {
  if (state.status === 'offline' || work.status === 'offline') {
    return { tone: 'offline', title: 'Offline', detail: OFFLINE_TEXT, progress: null, queues: [] }
  }
  if (state.status === 'unknown') return null
  if (work.status === 'error') {
    return { tone: 'amber', title: 'Background work could not be loaded', detail: '', progress: null, queues: [] }
  }
  const status = state.data
  const data = work.status === 'ok' ? work.data : null
  const queues = (data?.waiting ?? [])
    .filter((row) => row.count > 0 || row.reason)
    .map((row) => ({ label: row.label, count: row.count, reason: row.reason?.text ?? null, code: row.reason?.code ?? null }))
  const blocked = queues.find((row) => row.reason)
  const failed = status.lastRun?.state === 'failed' ? status.lastRun.message : null
  const running = runningLine(status, data)
  if (running) {
    const detail = [running.detail, blocked?.reason, failed].filter(Boolean).join(' · ')
    return { tone: 'running', ...running, detail, queues }
  }
  if (blocked?.reason) return { tone: 'amber', title: `${blocked.label} ${blocked.code === 'paused' ? 'paused' : 'waiting'}`, detail: blocked.reason, progress: null, queues }
  if (failed) return { tone: 'amber', title: 'Last collection failed', detail: failed, progress: null, queues }
  return { tone: 'idle', title: 'Idle', detail: idleDetail(status), progress: null, queues }
}

function Progress({ done, total }: { done: number; total: number }) {
  const share = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <span className="status-progress" aria-label={`${done} of ${total}`}>
      <span className="status-progress-track">
        <span style={{ width: `${share}%` }} />
      </span>
      <span className="status-progress-text">
        {done} of {total}
      </span>
    </span>
  )
}

export function StatusBar({ status, work, onOpen }: Props) {
  const line = lineOf(status, work)
  if (!line) return <button className="status-bar" onClick={onOpen} aria-label="Background work" />
  return (
    <button className={`status-bar ${line.tone}`} onClick={onOpen} aria-label={`${line.title}. Open background work`}>
      <span className="status-bar-main">
        <span className="status-dot" aria-hidden="true" />
        <span className="status-bar-title">{line.title}</span>
        {line.detail && <span className="status-bar-detail">{line.detail}</span>}
        {line.progress && <Progress done={line.progress.done} total={line.progress.total} />}
      </span>
      {line.queues.length > 0 && (
        <span className="status-bar-queues">
          {line.queues.map((queue) => (
            <span key={queue.label} className={queue.reason ? 'status-queue paused' : 'status-queue'} title={queue.reason ?? `${queue.count} waiting`}>
              {queue.label}
              <b>{queue.count}</b>
            </span>
          ))}
        </span>
      )}
      <span className="status-bar-open" aria-hidden="true">
        Details ›
      </span>
    </button>
  )
}
