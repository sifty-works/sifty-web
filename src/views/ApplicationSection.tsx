import { useState } from 'react'
import type { ApplicationField } from '../api/client.ts'
import { DIRECT_ACTION, RETRY_ACTION, useApplication } from '../state/application.ts'
import { announce, failure } from '../state/messages.ts'
import { Refusal } from './Refusal.tsx'

const SOURCES: Record<string, string> = { my_data: 'My data', qa: 'Q&A', drafted: 'drafted', user: 'you' }
const NO_EDIT = new Set(['file'])

const answerText = (f: ApplicationField) => f.values.join(', ')
const isMulti = (f: ApplicationField) => /multi/i.test(f.kind)

function draftOf(f: ApplicationField): string {
  return isMulti(f) ? f.values.join('\n') : f.values.join(', ')
}

function valuesOf(f: ApplicationField, draft: string): string[] {
  if (isMulti(f)) return draft.split('\n').map((v) => v.trim()).filter(Boolean)
  return draft.trim() ? [draft.trim()] : []
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
  onSave: (values: string[], revision: number) => Promise<string | null>
}

function FieldRow({ field, onSave }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [revision, setRevision] = useState(field.revision)
  if (revision !== field.revision) {
    setRevision(field.revision)
    setDraft(null)
  }
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
    <li className="app-field">
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
      {view && view.fields.length > 0 && (
        <ul className="app-fields">
          {view.fields.map((f) => (
            <FieldRow key={f.key} field={f} onSave={(values, revision) => save(f.key, values, revision)} />
          ))}
        </ul>
      )}
      <p className="muted app-extension">Fill the form on the employer's page with the Sifty extension.</p>
    </section>
  )
}
