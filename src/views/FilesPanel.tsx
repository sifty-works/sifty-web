import { useRef, useState } from 'react'
import {
  addDocument, analyzeDocument, cancelDocument, deleteDocument, getDocumentOriginal, getDocumentText,
  OfflineError, refreshDocument, setDocumentEvidence, uploadDocument, type DocumentItem,
} from '../api/client.ts'
import { OFFLINE_MESSAGE, trouble, useDocuments, type UseDocumentsResult } from '../state/documents.ts'
import { describe, failure, type Note } from '../state/messages.ts'
import { Icon } from './Icon.tsx'
import { Message } from './Messages.tsx'
import { ContactsSection, Field, SectionShell, useSectionEditor, type FilesTabProps } from './ProfilePage.tsx'

const OPEN_SETTINGS = 'Open Settings.'
const DELETE_WARNING = 'Suggestions from it are removed; facts you already accepted stay in your profile.'
const BADGES: Record<string, { text: string; tone: string }> = {
  analysing: { text: 'Analysing…', tone: 'state-analysing' },
  analysed: { text: 'Analyzed', tone: 'state-analysed' },
  error: { text: 'Failed', tone: 'state-error' },
  unavailable: { text: 'No text', tone: 'state-unavailable' },
}
const ORIGINAL_REVOKE_MS = 60000
const FILES_LEAD = 'CVs and notes. Nothing is analyzed until you choose Analyze.'
const FILE_KINDS = /\.(pdf|md|txt)$/i
const REFUSED_KIND = 'The file must be a PDF, Markdown or plain text file.'

function meta(doc: DocumentItem): string {
  const parts = [doc.kind, `${doc.charCount.toLocaleString('en-US')} characters`]
  if (doc.state === 'analysed') {
    const facts = Number(doc.stateReason)
    if (Number.isFinite(facts)) parts.push(`${facts} ${facts === 1 ? 'fact' : 'facts'} found`)
  }
  return parts.join(' · ')
}

function badge(doc: DocumentItem): { text: string; tone: string } {
  if (doc.state === 'ready') return { text: doc.charCount > 0 ? 'Text ready' : 'Not read yet', tone: '' }
  return BADGES[doc.state] ?? { text: doc.state, tone: '' }
}

function ErrorReason({ reason, onOpenSettings }: { reason: string; onOpenSettings: () => void }) {
  if (!reason) return null
  const toSettings = reason.endsWith(OPEN_SETTINGS)
  const lead = toSettings ? reason.slice(0, -OPEN_SETTINGS.length).trimEnd() : reason
  return <div className="profile-document-error">
    <p className="danger">
      {lead}
      {toSettings ? <> <button type="button" className="document-link" onClick={onOpenSettings}>{OPEN_SETTINGS}</button></> : null}
    </p>
    <details className="document-details">
      <summary>Technical details</summary>
      <code>{reason}</code>
    </details>
  </div>
}

export function DocumentCard({ doc, onChange, onRemove, onOpenSettings }: {
  doc: DocumentItem
  onChange: (item: DocumentItem) => void
  onRemove: (id: number) => void
  onOpenSettings: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const reason = doc.stateReason ?? ''

  async function run(call: () => Promise<DocumentItem>, fallback: string) {
    setBusy(true); setNote(null)
    try { onChange(await call()) }
    catch (e) { setNote(trouble(e, fallback)) }
    finally { setBusy(false) }
  }

  async function toggleText() {
    if (text !== null) { setText(null); return }
    setBusy(true); setNote(null)
    try { setText(await getDocumentText(doc.id)) }
    catch (e) { setNote(trouble(e, 'Could not load the text')) }
    finally { setBusy(false) }
  }

  async function openOriginal() {
    const tab = window.open('', '_blank')
    setBusy(true); setNote(null)
    try {
      const url = URL.createObjectURL(await getDocumentOriginal(doc.id))
      if (tab) tab.location.href = url
      else setNote(failure('The browser blocked the new tab.'))
      setTimeout(() => URL.revokeObjectURL(url), ORIGINAL_REVOKE_MS)
    } catch (e) {
      tab?.close()
      setNote(trouble(e, 'Could not open the original'))
    } finally { setBusy(false) }
  }

  async function remove() {
    setBusy(true); setNote(null)
    try { await deleteDocument(doc.id); onRemove(doc.id) }
    catch (e) { setNote(trouble(e, 'Could not delete')); setConfirming(false); setBusy(false) }
  }

  const hasText = doc.charCount > 0
  const analyse = doc.state === 'analysing'
    ? <button type="button" disabled={busy} onClick={() => void run(() => cancelDocument(doc.id), 'Could not cancel')}>Cancel analysis</button>
    : hasText && doc.state === 'error'
      ? <button type="button" disabled={busy} onClick={() => void run(() => analyzeDocument(doc.id), 'Could not start the analysis')}>Retry analysis</button>
      : hasText && (doc.state === 'ready' || doc.state === 'analysed')
        ? <button type="button" disabled={busy} onClick={() => void run(() => analyzeDocument(doc.id), 'Could not start the analysis')}>Analyze</button>
        : null

  return <article className="profile-document">
    <div className="profile-document-head">
      <strong>{doc.name}</strong>
      <span className={`profile-state ${badge(doc).tone}`.trim()}>{badge(doc).text}</span>
      <button type="button" className="profile-doc-delete" title="Delete" aria-label={`Delete ${doc.name}`}
        disabled={busy} onClick={() => setConfirming(true)}><Icon name="trash" size={15}/></button>
    </div>
    {confirming ? <div className="profile-doc-confirm" role="alertdialog" aria-label={`Delete ${doc.name}?`}>
      <p><strong>Delete this {doc.address ? 'link' : 'file'}?</strong> {DELETE_WARNING}</p>
      <div className="profile-document-actions">
        <button type="button" className="profile-doc-confirm-delete" disabled={busy} onClick={() => void remove()}>{busy ? 'Deleting…' : 'Delete'}</button>
        <button type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    </div> : null}
    <p className="muted">{meta(doc)}</p>
    {doc.address ? <p className="muted profile-link-url">
      <a href={doc.address} target="_blank" rel="noreferrer">{doc.address.replace(/^https?:\/\/(www\.)?/, '')} ↗</a>
    </p> : null}
    {doc.state === 'analysing' ? <p className="profile-hint">Analysing…</p> : null}
    {doc.state === 'ready' || doc.state === 'unavailable' ? (reason ? <p className="profile-hint">{reason}</p> : null) : null}
    {doc.state === 'error' ? <ErrorReason reason={reason} onOpenSettings={onOpenSettings}/> : null}
    <Message note={note}/>
    <div className="profile-document-actions">
      {analyse}
      {doc.state === 'ready'
        ? <button type="button" disabled={busy} onClick={() => void toggleText()}>{text !== null ? 'Hide text' : 'View text'}</button>
        : null}
      {!doc.address && doc.state !== 'analysing' && (doc.state === 'unavailable' || !hasText)
        ? <button type="button" disabled={busy} onClick={() => { setText(null); void run(() => refreshDocument(doc.id), 'Could not read the file again') }}>Refresh</button>
        : null}
      {doc.address
        ? <button type="button" disabled={busy} onClick={() => { setText(null); void run(() => refreshDocument(doc.id), 'Could not read the page again') }}>Refresh source</button>
        : null}
      {doc.kind !== 'text' ? <button type="button" disabled={busy} onClick={() => void openOriginal()}>Original</button> : null}
      <label className="profile-inline-check">
        <input type="checkbox" checked={doc.evidence} disabled={busy}
          onChange={(e) => void run(() => setDocumentEvidence(doc.id, e.target.checked), 'Could not save')}/>
        Use as evidence
      </label>
    </div>
    {text !== null && doc.state === 'ready' ? <div className="profile-document-text"><pre>{text}</pre></div> : null}
  </article>
}

async function addAndReload(source: { name: string; text: string } | { url: string }, reload: () => Promise<void>) {
  try { await addDocument(source) }
  catch (e) {
    throw e instanceof OfflineError ? new Error(OFFLINE_MESSAGE) : e
  }
  await reload()
}

function Listing({ documents, items, empty, onOpenSettings }: {
  documents: UseDocumentsResult
  items: DocumentItem[]
  empty?: string
  onOpenSettings: () => void
}) {
  const { state } = documents
  if (state.status === 'loading') return <p className="profile-hint">Loading…</p>
  if (state.status === 'error') return <Message note={{ kind: 'failure', text: state.message }}/>
  if (items.length === 0) return empty ? <p className="profile-hint">{empty}</p> : null
  return <div className="document-list">{items.map((doc) => <DocumentCard key={doc.id} doc={doc}
    onChange={documents.replace} onRemove={documents.drop} onOpenSettings={onOpenSettings}/>)}</div>
}

function FilesSection({ documents, items, onOpenSettings }: {
  documents: UseDocumentsResult
  items: DocumentItem[]
  onOpenSettings: () => void
}) {
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [uploading, setUploading] = useState(false)
  const [over, setOver] = useState(false)
  const [report, setReport] = useState<{ note: Note; refresh: boolean } | null>(null)
  const chooser = useRef<HTMLInputElement>(null)

  const editor = useSectionEditor(
    () => { setName(''); setBody('') },
    () => addAndReload({ name, text: body }, documents.reload),
  )

  async function upload(files: File[]) {
    if (files.length === 0) return
    setReport(null); setUploading(true)
    let failed = 0
    let reason = ''
    let offline = false
    for (const file of files) {
      if (!FILE_KINDS.test(file.name)) { failed++; reason = REFUSED_KIND; continue }
      try { await uploadDocument(file) }
      catch (e) {
        if (e instanceof OfflineError) { offline = true; break }
        failed++; reason = describe(e, 'Upload failed')
      }
    }
    setUploading(false)
    await documents.reload()
    if (offline || failed === 0) return
    setReport(files.length === 1
      ? { note: failure(reason), refresh: false }
      : { note: failure(`${failed} of ${files.length} uploads failed. Successful files are kept.`), refresh: true })
  }

  const adding = <button type="button" className="primary" disabled={uploading} onClick={() => chooser.current?.click()}>
    {uploading ? 'Uploading…' : '+ Add files'}
  </button>

  return <SectionShell id="profile-files" title="Files" editLabel="Paste text instead" actions={adding} {...editor}>
    <p className="profile-hint">{FILES_LEAD}</p>
    {editor.editing ? <div className="profile-fields">
      <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)}/></Field>
      <Field label="Text"><textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)}/></Field>
    </div> : null}
    <div className={`files-drop${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); setOver(false); void upload(Array.from(e.dataTransfer.files)) }}>
      <input ref={chooser} type="file" multiple accept=".pdf,.md,.txt" hidden aria-label="Choose files"
        onChange={(e) => { const chosen = Array.from(e.target.files ?? []); e.target.value = ''; void upload(chosen) }}/>
      <button type="button" className={`profile-dropzone${uploading ? ' busy' : ''}`} disabled={uploading}
        onClick={() => chooser.current?.click()}>
        <strong>{uploading ? 'Uploading…' : 'Drop files here'}</strong>
        <span>pdf, md, txt · up to 2 MB</span>
      </button>
      <Message note={report?.note} onDismiss={() => setReport(null)}/>
      {report?.refresh ? <div className="profile-document-actions">
        <button type="button" onClick={() => { setReport(null); void documents.reload() }}>Refresh</button>
      </div> : null}
      <Listing documents={documents} items={items} empty="No documents yet." onOpenSettings={onOpenSettings}/>
    </div>
  </SectionShell>
}

function FetchedPages({ documents, items, onOpenSettings }: {
  documents: UseDocumentsResult
  items: DocumentItem[]
  onOpenSettings: () => void
}) {
  const [address, setAddress] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function add() {
    setAdding(true); setError('')
    try { await addAndReload({ url: address }, documents.reload); setAddress('') }
    catch (e) { setError(describe(e, 'Could not add the link')) }
    finally { setAdding(false) }
  }

  return <div className="profile-links-docs">
    <p className="profile-links-docs-heading muted">Fetched pages</p>
    <Listing documents={documents} items={items} onOpenSettings={onOpenSettings}/>
    <div className="profile-link-add">
      <div className="profile-link-add-row">
        <input type="url" placeholder="https://example.com/about" value={address} disabled={adding} aria-label="URL to add"
          onChange={(e) => { setAddress(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') void add() }}/>
        <button type="button" disabled={adding} onClick={() => void add()}>{adding ? 'Adding…' : '+ Add link'}</button>
      </div>
      {error ? <p className="profile-link-add-error" role="alert">{error}</p> : null}
    </div>
  </div>
}

export function FilesTab({ me, saveMe, onOpenSettings }: FilesTabProps) {
  const documents = useDocuments()
  const { state } = documents
  const all = state.status === 'ok' ? state.documents : []

  return <div className="profile-cols-files">
    <div className="profile-col-files-docs">
      <Message note={documents.note}/>
      <FilesSection documents={documents} items={all.filter((d) => !d.address)} onOpenSettings={onOpenSettings}/>
      <ContactsSection me={me} onSave={saveMe}
        extra={<FetchedPages documents={documents} items={all.filter((d) => d.address)} onOpenSettings={onOpenSettings}/>}/>
    </div>
  </div>
}
