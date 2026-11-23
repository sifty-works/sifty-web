import { useState } from 'react'
import { trouble } from '../state/documents.ts'
import { type Note } from '../state/messages.ts'
import type { ProposalRow, UseProposalsResult } from '../state/proposals.ts'
import { Message } from './Messages.tsx'

const LEAD_REVIEW = 'Accepting adds the fact to your profile, with its source.'
const LEAD_EMPTY = 'Analyze a file to get new suggestions.'

function fieldLabel(field: string): string {
  const words = (part: string) => part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').toLowerCase()
  const text = field.split('.').map(words).join(' · ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function SuggestionCard({ row, onAccept, onReject }: {
  row: ProposalRow
  onAccept: (id: number) => Promise<void>
  onReject: (id: number) => Promise<void>
}) {
  const { item, leaving } = row
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)

  async function run(call: (id: number) => Promise<void>) {
    setBusy(true); setNote(null)
    try { await call(item.id) }
    catch (e) { setNote(trouble(e, 'Could not save')) }
    finally { setBusy(false) }
  }

  const accept = (label: string) => <button type="button" disabled={busy} onClick={() => void run(onAccept)}>{label}</button>
  const reject = (label: string) => <button type="button" disabled={busy} onClick={() => void run(onReject)}>{label}</button>

  return <article className={leaving ? 'profile-fact leaving' : 'profile-fact'} aria-hidden={leaving || undefined}>
    <div className="profile-fact-key">{fieldLabel(item.field)}</div>
    {item.current ? <div className="profile-conflict">
      <p><strong>Current</strong> {item.current}</p>
      <p><strong>Proposed</strong> {item.value}</p>
      <div className="profile-document-actions">{reject('Keep current')}{accept('Use proposed')}</div>
    </div> : <>
      <p className="profile-fact-value">{item.value}</p>
      <div className="profile-document-actions">{accept('Accept')}{reject('Reject')}</div>
    </>}
    {item.quote ? <blockquote>{item.quote}</blockquote> : null}
    <p className="profile-fact-source">{item.documentName}</p>
    <Message note={note}/>
  </article>
}

export function SuggestionsPanel({ proposals }: { proposals: UseProposalsResult }) {
  const { status, note, rows, count } = proposals
  const ready = status === 'ok'
  return <section className="profile-card profile-facts">
    <header className="profile-card-head">
      <div>
        <h2><span className="profile-ai-badge">✦ AI</span>{count ? `${count} to review` : ready ? 'Nothing to review' : 'Suggestions'}</h2>
        {ready ? <p>{count ? LEAD_REVIEW : LEAD_EMPTY}</p> : null}
      </div>
      <div className="profile-card-actions">
        <button type="button" disabled={status === 'loading'} onClick={() => void proposals.reload()}>Refresh</button>
      </div>
    </header>
    <div className="profile-card-body">
      <Message note={note}/>
      {status === 'loading' ? <p className="profile-hint">Loading…</p> : null}
      {rows.length ? <div className="profile-fact-list">
        {rows.map((row) => <SuggestionCard key={row.item.id} row={row} onAccept={proposals.accept} onReject={proposals.reject}/>)}
      </div> : null}
    </div>
  </section>
}
