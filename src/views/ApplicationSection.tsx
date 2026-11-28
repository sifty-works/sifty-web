import { useEffect, useRef, useState } from 'react'
import type { ApplicationField } from '../api/client.ts'
import { DIRECT_ACTION, RETRY_ACTION, useApplication } from '../state/application.ts'
import { announce, failure } from '../state/messages.ts'
import { ApplicationChat, type Discussion } from './ApplicationChat.tsx'
import { Refusal } from './Refusal.tsx'

const SOURCES: Record<string, string> = { my_data: 'My data', qa: 'Q&A', drafted: 'drafted', user: 'you' }
const NO_EDIT = new Set(['file'])

const answerText = (f: ApplicationField) => f.values.join(', ')
const isMulti = (f: ApplicationField) => /multi/i.test(f.kind)

function draftOf(f: ApplicationField, values = f.values): string {
  return isMulti(f) ? values.join('\n') : values.join(', ')
}

interface Applied {
  key: string
  values: string[]
  nonce: number
}

function valuesOf(f: ApplicationField, draft: string): string[] {
  if (isMulti(f)) return draft.split('\n').map((v) => v.trim()).filter(Boolean)
  return draft.trim() ? [draft.trim()] : []
}

function quote(f: ApplicationField): string {
  const answer = answerText(f)
  const lines = answer ? answer.split(/\r?\n/).map((line, i) => `> ${i === 0 ? 'A: ' : ''}${line}`.trimEnd()) : []
  return [`> Q: ${f.label}`, ...lines].join('\n') + '\n\n'
}

async function copy(f: ApplicationField) {
  try {
    await navigator.clipboard.writeText(answerText(f))
    announce({ kind: 'report', text: 'Copied' }, 'application-copy')
  } catch (err) {
    announce(failure(err, 'Could not copy'), 'application-copy')
  }
}

interface FieldProps {
  field: ApplicationField
  discussing: boolean
  applied: Applied | undefined
  onSave: (values: string[], revision: number) => Promise<string | null>
  onDiscuss: () => void
  onEditing: (values: string[] | null) => void
}

function FieldRow({ field, discussing, applied, onSave, onDiscuss, onEditing }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [revision, setRevision] = useState(field.revision)
  if (revision !== field.revision) {
    setRevision(field.revision)
    setDraft(null)
  }
  const [appliedNonce, setAppliedNonce] = useState(0)
  if (applied && applied.nonce !== appliedNonce) {
    setAppliedNonce(applied.nonce)
    setRefused(null)
    setDraft(draftOf(field, applied.values))
  }
  useEffect(() => {
    onEditing(draft === null ? null : valuesOf(field, draft))
  }, [draft])
  useEffect(() => () => onEditing(null), [])
  const choice = field.options.length > 0 && !isMulti(field)

  async function save() {
    if (draft === null) return
    setBusy(true)
    const message = await onSave(valuesOf(field, draft), field.revision)
    setBusy(false)
    setRefused(message)
    if (message === null) setDraft(null)
  }

  return (
    <li className={discussing ? 'app-field app-discussed' : 'app-field'}>
      <div className="app-field-head">
        <span className="app-label">{field.label}{field.required && <span className="app-req" title="Required"> *</span>}</span>
        {field.source && <span className="app-source">{SOURCES[field.source] ?? field.source}</span>}
      </div>
      {draft === null ? (
        <>
          {field.values.length > 0 && <p className="app-answer">{answerText(field)}</p>}
          {field.note && <p className="app-note">{field.note}</p>}
          <div className="app-field-actions">
            {field.values.length > 0 && <button onClick={() => void copy(field)}>Copy</button>}
            {!NO_EDIT.has(field.kind) && field.note !== 'Your consent' && (
              <button onClick={() => { setRefused(null); setDraft(draftOf(field)) }}>Edit</button>
            )}
            <button onClick={onDiscuss}>Discuss</button>
          </div>
        </>
      ) : (
        <div className="app-edit">
          {choice ? (
            <select value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={field.label}>
              <option value="" />
              {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <textarea
              value={draft}
              rows={isMulti(field) || field.kind.includes('long') ? 5 : 2}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={field.label}
            />
          )}
          <div className="app-field-actions">
            <button className="primary" disabled={busy} onClick={() => void save()}>Save</button>
            <button disabled={busy} onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </div>
      )}
      {refused && <Refusal note={failure(refused)} />}
    </li>
  )
}

interface Props {
  id: number
  onApplyDirectly: () => void
}

export function ApplicationSection({ id, onApplyDirectly }: Props) {
  const { state, retry, save } = useApplication(id)
  const [discussing, setDiscussing] = useState<Discussion | null>(null)
  const [applied, setApplied] = useState<Applied | null>(null)
  const counter = useRef(0)
  const editing = useRef(new Map<string, string[]>())
  const view = state.status === 'ok' ? state.view : null
  const action = view?.action ?? ''

  return (
    <section className="listing-panel application-panel">
      <header className="panel-head">
        <h2>Application</h2>
        {view?.system && <span className="panel-sub">{view.system}</span>}
      </header>
      {state.status === 'loading' && <p className="muted">Loading…</p>}
      {state.status === 'error' && <Refusal note={failure(state.message)} />}
      {view && (view.text || action) && (
        <p className="check-line">
          {view.text && <span>{view.text}</span>}
          {action === RETRY_ACTION && <button onClick={() => void retry()}>{action}</button>}
          {action === DIRECT_ACTION && <button onClick={onApplyDirectly}>{action}</button>}
          {action !== '' && action !== RETRY_ACTION && action !== DIRECT_ACTION && <span>{action} (coming)</span>}
        </p>
      )}
      {view && view.fields.length > 0 ? (
        <div className="app-split">
          <div className="app-left">
            <ul className="app-fields">
              {view.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  discussing={discussing?.key === f.key}
                  applied={applied?.key === f.key ? applied : undefined}
                  onSave={(values, revision) => save(f.key, values, revision)}
                  onEditing={(values) => {
                    if (values) editing.current.set(f.key, values)
                    else editing.current.delete(f.key)
                  }}
                  onDiscuss={() => setDiscussing({ key: f.key, text: quote(f), nonce: ++counter.current })}
                />
              ))}
            </ul>
            <p className="muted app-extension">Fill the form on the employer's page with the Sifty extension.</p>
          </div>
          <ApplicationChat
            id={id}
            fields={view.fields}
            discussing={discussing}
            valuesOf={(key) => editing.current.get(key) ?? view.fields.find((f) => f.key === key)?.values ?? []}
            onClear={() => setDiscussing(null)}
            onUse={(key, values) => setApplied({ key, values, nonce: ++counter.current })}
          />
        </div>
      ) : (
        <p className="muted app-extension">Fill the form on the employer's page with the Sifty extension.</p>
      )}
    </section>
  )
}
