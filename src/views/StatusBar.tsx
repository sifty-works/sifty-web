import { useEffect, useRef, useState } from 'react'
import { listSources, ModelsPatch, ModelsResponse, StatusExtra, WorkResponse } from '../api/client.ts'
import { silent } from '../state/messages.ts'
import { useModels } from '../state/models.ts'
import { useDismiss } from '../dismiss.ts'
import { type StatusState } from '../state/status.ts'
import { type RemoteState } from '../state/work.ts'
import { options, workName } from './ModelsPanel.tsx'
import { Icon } from './Icon.tsx'
import { localTime } from './WorkTable.tsx'

interface Props {
  status: StatusState
  work: RemoteState<WorkResponse>
  newToday: number | null
  onOpen: (panel: string) => void
}

type Tone = 'amber'

interface Phrase {
  tone: Tone
  text: string
  panel: string
}

type Waiting = WorkResponse['waiting'][number]

function intervalMs(text: string): number {
  let total = 0
  for (const [, n, unit] of text.matchAll(/(\d+(?:\.\d+)?)(h|m|s)/g)) {
    total += Number(n) * (unit === 'h' ? 3600 : unit === 'm' ? 60 : 1) * 1000
  }
  return total
}

function clock(date: Date): string {
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString(undefined, { timeStyle: 'short' })
    : localTime(date.toISOString())
}

function collectedText(status: StatusExtra): string {
  const last = status.lastRun
  return !last || last.state === 'failed' ? 'No collection yet' : `Last collection ${clock(new Date(last.finished))}`
}

function nextText(status: StatusExtra, everyMs: number | null): string | null {
  const last = status.lastRun
  const finished = last ? new Date(last.finished) : null
  if (!everyMs || !finished || Number.isNaN(finished.getTime())) return null
  const next = new Date(finished.getTime() + everyMs)
  return `Next ${next.getTime() <= Date.now() ? 'soon' : clock(next)}`
}

function problemsOf(state: StatusState, work: RemoteState<WorkResponse>, paused: boolean): Phrase[] {
  if (state.status !== 'ok') return []
  const status = state.data
  const out: Phrase[] = []
  if (paused) out.push({ tone: 'amber', text: 'Paused — collection and analysis wait until you turn Sifty on', panel: 'monitor' })
  for (const row of work.status === 'ok' ? work.data.waiting : []) {
    if (!row.reason || paused && row.reason.code === 'paused') continue
    const verb = row.reason.code === 'paused' ? 'paused' : 'waiting'
    out.push({ tone: 'amber', text: `${row.label} ${verb} — ${row.reason.text}`, panel: 'monitor' })
  }
  if (status.lastRun?.state === 'failed') {
    out.push({ tone: 'amber', text: `Last collection failed — ${status.lastRun.message}`, panel: 'monitor' })
  }
  if (work.status === 'error') out.push({ tone: 'amber', text: 'Background work could not be loaded', panel: 'monitor' })
  if (status.attention) out.push({ tone: 'amber', text: status.attention.text, panel: 'sources' })
  return out
}

const TICK_MS = 4000

function Ticker({ items, onOpen }: { items: Phrase[]; onOpen: (panel: string) => void }) {
  const [at, setAt] = useState(0)
  const [hold, setHold] = useState(false)
  const count = items.length
  useEffect(() => {
    if (count < 2 || hold) return
    const timer = window.setInterval(() => setAt((i) => i + 1), TICK_MS)
    return () => window.clearInterval(timer)
  }, [count, hold])
  if (count === 0) return null
  const now = at % count
  const before = (at - 1 + count) % count
  const item = items[now]
  return (
    <button
      className="status-problem"
      onClick={() => onOpen(item.panel)}
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      title={items.map((p) => p.text).join('\n')}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-ticker">
        {count > 1 && at > 0 && <span key={`out-${at}`} className="status-tick out">{items[before].text}</span>}
        <span key={`in-${at}`} className={`status-tick${at > 0 ? ' in' : ''}`}>{item.text}</span>
      </span>
      {count > 1 && <span className="status-of">{now + 1}/{count}</span>}
    </button>
  )
}

interface Part {
  done: number
  total: number
}

const ANALYSIS = new Set(['analyze_vacancy', 'recompute_fit'])

const number = (n: number) => n.toLocaleString('en-US')

function duration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes < 60 ? `~${minutes} min` : `~${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
}

function leftOf(waiting: Waiting[]): number {
  return waiting.reduce((sum, row) => sum + row.count, 0)
}

function queueText(waiting: Waiting[], noun = ''): string {
  const seconds = waiting.reduce((sum, row) => sum + (row.eta ?? 0), 0)
  const left = `${number(leftOf(waiting))}${noun}`
  return seconds > 0 ? `${left} · ${duration(seconds)}` : left
}

function Track({ part }: { part: Part }) {
  return (
    <span className="status-track" aria-hidden="true">
      <span style={{ width: `${(part.done / part.total) * 100}%` }} />
    </span>
  )
}

function failing(models: ModelsResponse | null, provider: string): boolean {
  const state = models?.providers.find((p) => p.name === provider)?.state ?? ''
  return state !== '' && state !== 'ok'
}

function modelLabel(provider: string, model: string): string {
  const full = `${provider} · ${model}`
  return !model ? provider : full.length > 28 ? model : full
}

function ModelPicker({ models, save, onSettings }: {
  models: ModelsResponse
  save: (patch: ModelsPatch) => Promise<void>
  onSettings: () => void
}) {
  return (
    <div className="status-picker" role="dialog" aria-label="Models">
      {models.work.map((w) => (
        <label key={w.kind}>
          <span>{workName(w.kind)}</span>
          <select value={w.provider} onChange={(e) => void save({ work: { [w.kind]: e.target.value } })}>
            <option value="">Not chosen</option>
            {options(w).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      ))}
      <button className="status-picker-link" onClick={onSettings}>All model settings ›</button>
    </div>
  )
}

export function StatusBar({ status, work, newToday, onOpen }: Props) {
  const { state: modelState, save } = useModels(30000)
  const [open, setOpen] = useState(false)
  const [everyMs, setEveryMs] = useState<number | null>(null)
  const models = modelState.status === 'ok' ? modelState.models : null
  const pickerRef = useRef<HTMLDivElement>(null)

  useDismiss(open, () => setOpen(false), pickerRef)

  useEffect(() => {
    listSources()
      .then((s) => setEveryMs(s.auto ? intervalMs(s.interval) : null))
      .catch(silent('without the schedule the bar only omits the next collection time'))
  }, [status.status === 'ok' ? status.data.lastRun?.finished : null])

  const paused = models?.paused ?? false
  const offline = status.status === 'offline' || work.status === 'offline'
  const data = work.status === 'ok' ? work.data : null
  const extra = status.status === 'ok' ? status.data : null
  const load = data?.load ?? null
  const problems = offline ? [] : problemsOf(status, work, paused)
  const waiting = data ? data.waiting.filter((row) => row.count > 0) : []
  const analysing = waiting.filter((row) => ANALYSIS.has(row.kind))
  const other = waiting.filter((row) => !ANALYSIS.has(row.kind))
  const pending = leftOf(analysing)
  const peak = useRef(0)
  peak.current = pending === 0 ? 0 : Math.max(peak.current, pending)
  const job = data?.running.find((r) => r.model)
  const reading = models?.work.find((w) => w.kind === 'reading')?.provider ?? ''
  const provider = job?.model?.provider ?? reading
  const model = job?.model?.model ?? models?.providers.find((p) => p.name === reading)?.model ?? ''
  const label = provider ? modelLabel(provider, model) : 'Choose a model'
  const collecting = extra?.collecting ?? null
  const next = extra ? nextText(extra, everyMs) : null

  return (
    <div className={`status-bar${offline ? ' offline' : collecting || pending > 0 ? ' running' : ''}`}>
      {!offline && models && (
        <button
          className={`status-switch${paused ? '' : ' on'}`}
          role="switch"
          aria-checked={!paused}
          onClick={() => void save({ paused: !paused })}
          title={paused ? 'Sifty is paused: nothing is collected or analyzed; click to resume' : 'Sifty works in the background; click to pause'}
        >
          <span className="status-switch-word">Sifty</span>
          <span className="status-knob" aria-hidden="true" />
        </button>
      )}
      {offline ? (
        <span className="status-main"><span className="status-dot" aria-hidden="true" /><span className="status-text">Offline — Sifty is not running</span></span>
      ) : (
        <span className="status-left">
          <button className="status-block" onClick={() => onOpen('sources')} title={newToday ? `Collection; ${newToday} new roles in this profile's Inbox since midnight` : 'Collection'}>
            {collecting ? (
              <>
                <span className="status-text">{collecting.text}</span>
                {collecting.total > 0 && <Track part={{ done: Math.min(collecting.done, collecting.total), total: collecting.total }} />}
                {collecting.total > 0 && <span className="status-count">{collecting.done} / {collecting.total}</span>}
              </>
            ) : (
              <>
                <span className="status-text">{extra ? collectedText(extra) : ''}</span>
                {newToday !== null && newToday > 0 && <span className="status-new">+{number(newToday)} in Inbox</span>}
                {next && <span className="status-next" title="Next collection"><Icon name="clock" size={14} /> {next}</span>}
              </>
            )}
          </button>
        </span>
      )}
      {problems.length > 0 ? (
        <Ticker items={problems} onOpen={onOpen} />
      ) : (
        !offline && load !== null && <span className="status-load" title="Processor load of this computer">CPU {load}%</span>
      )}
      <div className="status-right">
      {pending > 0 && (
        <button className="status-block" onClick={() => onOpen('monitor')} title={analysing.map((row) => `${row.label}: ${row.count}`).join('\n')}>
          <span className="status-text">Analyzing</span>
          <Track part={{ done: peak.current - pending, total: peak.current }} />
          <span className="status-count">{queueText(analysing)}</span>
        </button>
      )}
      {!offline && pending === 0 && data && (
        <span className="status-done">All analyzed</span>
      )}
      {!offline && other.length > 0 && (
        <button
          className="status-queue"
          onClick={() => onOpen('monitor')}
          title={other.map((row) => `${row.label}: ${row.count}`).join('\n')}
        >
          {queueText(other, leftOf(other) === 1 ? ' job' : ' jobs')}
        </button>
      )}
      {!offline && models && (
        <button
          className={`status-calls${models.dailyLimit > 0 && models.todayCalls >= models.dailyLimit * 0.8 ? ' amber' : ''}`}
          onClick={() => onOpen('models')}
          title="Model calls today"
        >
          {models.dailyLimit > 0 ? `${number(models.todayCalls)} / ${number(models.dailyLimit)} calls` : `${number(models.todayCalls)} calls`}
        </button>
      )}
      {!offline && models && (
        <div className="status-model" ref={pickerRef}>
          <button
            className={failing(models, provider) ? 'amber' : undefined}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            title="Models"
          >
            <span>{label}</span> <b aria-hidden="true">›</b>
          </button>
          {open && <ModelPicker models={models} save={save} onSettings={() => { setOpen(false); onOpen('models') }} />}
        </div>
      )}
      </div>
    </div>
  )
}
