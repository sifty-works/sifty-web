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

interface Line {
  left: string
  right: string
  amber: boolean
}

function runningText(status: StatusExtra | null, work: WorkResponse | null): string | null {
  if (status?.collecting) return status.collecting.text
  const job = work?.running[0]
  if (!job) return null
  const model = job.model ? ` · ${job.model.provider} (${job.model.model})` : ''
  const progress = job.progress ? ` · ${job.progress.done} of ${job.progress.total}` : ''
  return `${job.label}${job.subject ? `: ${job.subject}` : ''}${model}${progress}`
}

function idleText(status: StatusExtra | null): string {
  const last = status?.lastRun?.state === 'failed' ? null : status?.lastRun
  const when = last ? `last collection ${localTime(last.finished)}` : 'no collection yet'
  return `Nothing running · ${when} · ${status?.catalogue ?? 0} vacancies in the catalogue`
}

function lineOf(state: StatusState, work: RemoteState<WorkResponse>): Line | null {
  if (state.status === 'offline' || work.status === 'offline') {
    return { left: OFFLINE_TEXT, right: '', amber: false }
  }
  if (state.status === 'unknown') return null
  if (work.status === 'error') return { left: 'Background work could not be loaded.', right: '', amber: true }
  const status = state.data
  const data = work.status === 'ok' ? work.data : null
  const waiting = data?.waiting ?? []
  const blocked = waiting.find((row) => row.reason)
  const failed = status.lastRun?.state === 'failed' ? status.lastRun.message : null
  const running = runningText(status, data)
  const counts = waiting.map((row) => `${row.label}: ${row.count} waiting`).join(' · ')
  const left = running ?? blocked?.reason?.text ?? failed
  const right = running && blocked?.reason ? blocked.reason.text : counts
  return {
    left: left ?? idleText(status),
    right,
    amber: blocked != null || failed != null,
  }
}

export function StatusBar({ status, work, onOpen }: Props) {
  const line = lineOf(status, work)
  return (
    <button className={line?.amber ? 'status-bar amber' : 'status-bar'} onClick={onOpen}>
      <span className="status-bar-left">{line?.left}</span>
      <span className="status-bar-right">{line?.right}</span>
    </button>
  )
}
