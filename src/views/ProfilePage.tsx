import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkPhoto, createQA, deleteQA, getMe, getProfile, getProfiles, getQA, patchMe, patchProfile,
  PHOTO_URL, removePhoto, updateQA, uploadPhoto,
  type MeData, type ProfileDetailResp, type ProfileListItem, type ProfilePatchReq, type MePatchReq,
  type QAItem, type ReferenceResp,
} from '../api/client.ts'
import { useReference } from '../state/profile.ts'
import { Icon } from './Icon.tsx'

export function NotSet() { return <span className="profile-not-set">Not set</span> }

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="profile-field-block"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>
}

export function SectionShell({ id, title, description, editing, saving, error, onEdit, onCancel, onSave, children }: {
  id?: string; title: string; description?: string; editing: boolean; saving: boolean; error: string
  onEdit: () => void; onCancel: () => void; onSave: () => void; children: React.ReactNode
}) {
  return <section className={`profile-card${editing ? ' editing' : ''}`} id={id}>
    <header className="profile-card-head">
      <div><h2>{title}</h2>{editing && description ? <p className="muted">{description}</p> : null}</div>
      <div className="profile-card-actions">
        {editing ? <>
          <button type="button" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </> : <button type="button" className="profile-pencil" title="Edit" aria-label={`Edit ${title}`} onClick={onEdit}><Icon name="pencil" size={16}/></button>}
      </div>
    </header>
    {error ? <div className="banner error" role="alert">{error}</div> : null}
    <div className="profile-card-body">{children}</div>
  </section>
}

export function useSectionEditor(fill: () => void, commit: () => Promise<unknown>) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    try { await commit(); setEditing(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save') }
    finally { setSaving(false) }
  }

  return {
    editing, saving, error,
    onEdit: () => { fill(); setError(''); setEditing(true) },
    onCancel: () => setEditing(false),
    onSave: () => void save(),
  }
}

export function TagInput({ label, title, desc, variant, values, placeholder, onChange }: {
  label: string; title?: string; desc?: string; variant?: string; values: string[]; placeholder?: string; onChange: (v: string[]) => void
}) {
  const [text, setText] = useState('')
  function add(raw: string) {
    const incoming = raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
    if (!incoming.length) return
    const seen = new Set(values.map((s) => s.toLowerCase()))
    const next = [...values]
    for (const item of incoming) if (!seen.has(item.toLowerCase())) { seen.add(item.toLowerCase()); next.push(item) }
    onChange(next); setText('')
  }
  const chips = values.map((v, i) => <span key={`${v}-${i}`} className="profile-tag">{v}
    <button type="button" aria-label={`Remove ${v}`} onClick={(e) => { e.stopPropagation(); onChange(values.filter((_, j) => j !== i)) }}>×</button>
  </span>)
  const addInput = <label className="profile-tag-add"><span aria-hidden="true">+</span>
    <input aria-label={label} value={text} placeholder={placeholder ?? ''}
      onChange={(e) => { const n = e.target.value; if (/[,\n]/.test(n)) add(n); else setText(n) }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === 'Tab') && text.trim()) { e.preventDefault(); add(text) }
        else if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1))
      }}
      onPaste={(e) => { const p = e.clipboardData.getData('text'); if (/[,\n]/.test(p)) { e.preventDefault(); add(text + p) } }}
      onBlur={() => { if (text.trim()) add(text) }}/>
  </label>
  if (title) return <div className="profile-what-row">
    <span className="profile-what-op">{label}</span>
    <div className={`profile-what-box${variant ? ` ${variant}` : ''}`}>
      <div className="profile-what-box-head">
        <span className="profile-what-box-title">{title}</span>
        {desc ? <p className="profile-what-box-desc">{desc}</p> : null}
      </div>
      <div className="profile-what-chips">{chips}{addInput}</div>
    </div>
  </div>
  return <div className="profile-field profile-tag-field">
    <span>{label}</span>
    <div className="profile-tag-input" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
      {chips}
      <input aria-label={label} value={text} placeholder={values.length ? '' : placeholder}
        onChange={(e) => { const n = e.target.value; if (/[,\n]/.test(n)) add(n); else setText(n) }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === 'Tab') && text.trim()) { e.preventDefault(); add(text) }
          else if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1))
        }}
        onPaste={(e) => { const p = e.clipboardData.getData('text'); if (/[,\n]/.test(p)) { e.preventDefault(); add(text + p) } }}
        onBlur={() => { if (text.trim()) add(text) }}/>
    </div>
    <small>Press Enter or comma to add.</small>
  </div>
}

export function Md({ text }: { text: string }) {
  if (!text.trim()) return null
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') { i++; continue }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2)); i++
      }
      nodes.push(<ul key={i}>{items.map((it, j) => <li key={j}><MdInline text={it}/></li>)}</ul>)
    } else {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() !== '') { para.push(lines[i]); i++ }
      nodes.push(<p key={i}>{para.map((l, j) => <span key={j}><MdInline text={l}/>{j < para.length - 1 ? <br/> : null}</span>)}</p>)
    }
  }
  return <div className="profile-rich-view">{nodes}</div>
}

function MdInline({ text }: { text: string }) {
  const parts: React.ReactNode[] = []
  let rem = text, k = 0
  const push = (node: React.ReactNode) => parts.push(<span key={k++}>{node}</span>)
  while (rem) {
    const bold = rem.match(/\*\*(.+?)\*\*/)
    const ital = rem.match(/_(.+?)_/)
    const link = rem.match(/\[(.+?)\]\((.+?)\)/)
    const first = [bold, ital, link].filter(Boolean).sort((a, b) => (a!.index ?? 999) - (b!.index ?? 999))[0]
    if (!first) { push(rem); break }
    if (first.index) push(rem.slice(0, first.index))
    if (first === bold) push(<strong>{first[1]}</strong>)
    else if (first === ital) push(<em>{first[1]}</em>)
    else push(<a href={first[2]} target="_blank" rel="noreferrer">{first[1]}</a>)
    rem = rem.slice((first.index ?? 0) + first[0].length)
  }
  return <>{parts}</>
}

export type ProfilePageData = {
  me: MeData | null
  profile: ProfileDetailResp | null
  profiles: ProfileListItem[]
  ref: ReferenceResp | null
  loading: boolean
  error: string
  reload: () => void
  saveMe: (patch: MePatchReq) => Promise<void>
  saveProfile: (patch: ProfilePatchReq) => Promise<void>
  firstProfileName: () => string
  inherited: Set<string>
}

export function useProfilePage(profileId: number): ProfilePageData {
  const [me, setMe] = useState<MeData | null>(null)
  const [profile, setProfile] = useState<ProfileDetailResp | null>(null)
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refData = useReference()

  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [meData, profs] = await Promise.all([getMe(), getProfiles()])
      setMe(meData); setProfiles(profs.profiles)
      const p = await getProfile(profileId)
      setProfile(p)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile')
    } finally { setLoading(false) }
  }, [profileId])

  useEffect(() => { void reload() }, [reload])

  const saveMe = useCallback(async (patch: MePatchReq) => {
    const updated = await patchMe(patch)
    setMe(updated)
  }, [])

  const saveProfile = useCallback(async (patch: ProfilePatchReq) => {
    const updated = await patchProfile(profileId, patch)
    setProfile(updated)
  }, [profileId])

  const inherited = new Set(Object.keys(profile?.inherited ?? {}))
  const firstProfileName = useCallback(() => profiles[0]?.name ?? '', [profiles])

  return { me, profile, profiles, ref: refData, loading, error, reload, saveMe, saveProfile, firstProfileName, inherited }
}

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

function ProfileHeader({ me, profile, onClose, onReload }: {
  me: MeData; profile: ProfileDetailResp; onClose: () => void; onReload: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [savingId, setSavingId] = useState(false)
  const [idError, setIdError] = useState('')

  const [headlineEditing, setHeadlineEditing] = useState(false)
  const [headlineDraft, setHeadlineDraft] = useState('')
  const [savingHL, setSavingHL] = useState(false)
  const [hlError, setHlError] = useState('')

  const [photoExists, setPhotoExists] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void checkPhoto().then(setPhotoExists) }, [])

  function beginEdit() {
    setDisplayName(me.displayName ?? ''); setLegalName(me.legalName ?? '')
    setIdError(''); setEditing(true)
  }

  async function saveIdentity() {
    setSavingId(true); setIdError('')
    try {
      await patchMe({ displayName: displayName || null, legalName: legalName || null })
      onReload(); setEditing(false)
    } catch (e) { setIdError(e instanceof Error ? e.message : 'Could not save') }
    finally { setSavingId(false) }
  }

  async function saveHeadline() {
    setSavingHL(true); setHlError('')
    try {
      await patchProfile(profile.id, { headline: headlineDraft || null })
      onReload(); setHeadlineEditing(false)
    } catch (e) { setHlError(e instanceof Error ? e.message : 'Could not save') }
    finally { setSavingHL(false) }
  }

  async function handlePhoto(file: File) {
    const MAX = 2 * 1024 * 1024
    if (file.size > MAX) { setPhotoError('Photo must be at most 2 MiB'); return }
    setPhotoBusy(true); setPhotoError('')
    try { await uploadPhoto(file); setPhotoExists(true) }
    catch (e) { setPhotoError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setPhotoBusy(false) }
  }

  async function handleRemovePhoto() {
    setPhotoBusy(true); setPhotoError('')
    try { await removePhoto(); setPhotoExists(false) }
    catch (e) { setPhotoError(e instanceof Error ? e.message : 'Remove failed') }
    finally { setPhotoBusy(false) }
  }

  const exp = me.experience ?? []
  const cur = exp.find((r) => r.current) ?? exp[0]
  const roleLine = [cur?.title, cur?.company].filter(Boolean).join(' · ')
  const computedMeta = roleLine || 'Candidate profile'
  const name = me.displayName || 'Your profile'
  const headline = profile.headline || computedMeta

  return <header className="profile-identity">
    <button type="button" className="profile-avatar" disabled={photoBusy}
      aria-label={photoExists ? 'Change profile photo' : 'Upload profile photo'}
      onClick={() => photoRef.current?.click()}>
      {photoExists ? <img src={PHOTO_URL} alt=""/> : initials(me.displayName ?? '') ? <span>{initials(me.displayName ?? '')}</span> : <Icon name="user" size={28}/>}
      <span className="profile-avatar-cam" aria-hidden="true">{photoBusy ? '…' : '+'}</span>
    </button>
    <input ref={photoRef} type="file" accept=".png,.jpg,.jpeg,.webp" hidden aria-label="Choose profile photo"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) void handlePhoto(f); e.target.value = '' }}/>
    <div className="profile-identity-main">
      {editing ? <div className="profile-identity-editor">
        <div className="profile-fields-grid">
          <Field label="Display name"><input value={displayName} onChange={(e) => setDisplayName(e.target.value)}/></Field>
          <Field label="Legal name"><input value={legalName} onChange={(e) => setLegalName(e.target.value)}/></Field>
        </div>
        <p className="profile-hint">Legal name is optional; used only where a form asks for it.</p>
        {idError ? <p className="error" role="alert">{idError}</p> : null}
        <div className="profile-identity-actions">
          <button type="button" onClick={() => setEditing(false)} disabled={savingId}>Cancel</button>
          <button type="button" className="primary" onClick={() => void saveIdentity()} disabled={savingId}>{savingId ? 'Saving…' : 'Save'}</button>
        </div>
      </div> : <>
        <h1>{name}
          <button type="button" className="profile-pencil profile-inline-edit" title="Edit name" aria-label="Edit name" onClick={beginEdit}><Icon name="pencil" size={15}/></button>
        </h1>
        {headlineEditing ? <div className="profile-headline-editor">
          <input className="profile-headline-input" value={headlineDraft} maxLength={160} aria-label="Headline"
            onChange={(e) => setHeadlineDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveHeadline() } if (e.key === 'Escape') setHeadlineEditing(false) }}/>
          {hlError ? <p className="error" role="alert">{hlError}</p> : null}
          <div className="profile-headline-actions">
            <button type="button" onClick={() => setHeadlineEditing(false)} disabled={savingHL}>Cancel</button>
            <button type="button" className="primary" onClick={() => void saveHeadline()} disabled={savingHL}>{savingHL ? 'Saving…' : 'Save'}</button>
          </div>
        </div> : <p className="profile-identity-meta">
          {headline}
          <button type="button" className="profile-pencil" title="Edit headline" aria-label="Edit headline"
            onClick={() => { setHeadlineDraft(profile.headline || ''); setHeadlineEditing(true) }}><Icon name="pencil" size={13}/></button>
        </p>}
        <p className="profile-identity-note">
          {me.legalName ? `Legal name: ${me.legalName} · ` : ''}
          {photoExists ? 'Offered when an application form asks for a photo' : 'No photo · click the avatar to add one…'}
        </p>
      </>}
    </div>
    {photoError ? <p className="profile-avatar-error error" role="alert">{photoError}</p> : null}
    {!editing ? <div className="profile-identity-actions">
      {photoExists ? <button type="button" onClick={() => void handleRemovePhoto()} disabled={photoBusy}>Remove photo</button> : null}
      <button type="button" className="profile-close" onClick={onClose}>Close</button>
    </div> : null}
  </header>
}

function QAPanel() {
  const [items, setItems] = useState<QAItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [editQ, setEditQ] = useState(''); const [editA, setEditA] = useState('')
  const [addQ, setAddQ] = useState(''); const [addA, setAddA] = useState('')
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [addSaving, setAddSaving] = useState(false)
  const [err, setErr] = useState<Record<number, string>>({})
  const [addErr, setAddErr] = useState('')

  useEffect(() => {
    void getQA().then((r) => { setItems(r.items); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  async function doAdd() {
    if (!addQ.trim()) return
    setAddSaving(true); setAddErr('')
    try {
      const item = await createQA(addQ.trim(), addA.trim())
      setItems((p) => [...p, item]); setAddQ(''); setAddA('')
    } catch (e) { setAddErr(e instanceof Error ? e.message : 'Could not save') }
    finally { setAddSaving(false) }
  }

  async function doEdit(id: number) {
    setSaving((p) => ({ ...p, [id]: true })); setErr((p) => ({ ...p, [id]: '' }))
    try {
      const item = await updateQA(id, editQ.trim() || null, editA.trim() || null)
      setItems((p) => p.map((x) => x.id === id ? item : x)); setEditId(null)
    } catch (e) { setErr((p) => ({ ...p, [id]: e instanceof Error ? e.message : 'Could not save' })) }
    finally { setSaving((p) => ({ ...p, [id]: false })) }
  }

  async function doDelete(id: number) {
    setSaving((p) => ({ ...p, [id]: true }))
    try { await deleteQA(id); setItems((p) => p.filter((x) => x.id !== id)) }
    catch (e) { setErr((p) => ({ ...p, [id]: e instanceof Error ? e.message : 'Could not delete' })) }
    finally { setSaving((p) => ({ ...p, [id]: false })) }
  }

  return <div className="profile-qa-panel">
    <p className="profile-col-heading">Questions &amp; Answers</p>
    <p className="profile-hint">Answers you approve or edit from the Application tab are saved here and offered again on future applications. They are shared across all your profiles.</p>
    {loading ? <p>Loading…</p> : null}
    {!loading && !items.length ? <p className="profile-hint">No saved answers yet.</p> : null}
    {items.map((item) => <article key={item.id} className="profile-qa-entry">
      {editId === item.id ? <>
        <div className="profile-fields">
          <Field label="Question"><input value={editQ} onChange={(e) => setEditQ(e.target.value)}/></Field>
          <Field label="Answer"><textarea rows={3} value={editA} onChange={(e) => setEditA(e.target.value)}/></Field>
        </div>
        {err[item.id] ? <div className="banner error" role="alert">{err[item.id]}</div> : null}
        <div className="profile-document-actions">
          <button type="button" disabled={saving[item.id]} onClick={() => void doEdit(item.id)}>{saving[item.id] ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => setEditId(null)}>Cancel</button>
        </div>
      </> : <>
        <p className="profile-qa-question">{item.question}</p>
        <p className="profile-qa-answer">{item.answer}</p>
        {err[item.id] ? <div className="banner error" role="alert">{err[item.id]}</div> : null}
        <div className="profile-document-actions">
          <button type="button" disabled={saving[item.id]} onClick={() => { setEditQ(item.question); setEditA(item.answer); setEditId(item.id) }}>Edit</button>
          <button type="button" disabled={saving[item.id]} onClick={() => void doDelete(item.id)}>Delete</button>
        </div>
      </>}
    </article>)}
    <details className="profile-qa-add">
      <summary>Add an answer</summary>
      <div className="profile-fields">
        <Field label="Question"><input value={addQ} onChange={(e) => setAddQ(e.target.value)} placeholder="e.g. What is your notice period?"/></Field>
        <Field label="Answer"><textarea rows={3} value={addA} onChange={(e) => setAddA(e.target.value)} placeholder="e.g. Two weeks"/></Field>
      </div>
      {addErr ? <div className="banner error" role="alert">{addErr}</div> : null}
      <div className="profile-document-actions">
        <button type="button" disabled={addSaving || !addQ.trim()} onClick={() => void doAdd()}>{addSaving ? 'Saving…' : 'Add'}</button>
      </div>
    </details>
  </div>
}

const LINKEDIN_PREFIX = 'https://www.linkedin.com/in/'
const GITHUB_PREFIX = 'https://github.com/'
const X_PREFIX = 'https://x.com/'

function toHandle(url: string, prefix: string): string {
  if (!url) return ''
  return url.startsWith(prefix) ? url.slice(prefix.length).replace(/\/$/, '') : url
}
function toUrl(handle: string, prefix: string): string {
  if (!handle) return ''
  return handle.startsWith('https://') || handle.startsWith('http://') ? handle : prefix + handle.replace(/\/$/, '')
}

function ContactsSection({ me, onSave }: { me: MeData; onSave: (patch: MePatchReq) => Promise<void> }) {
  const [d, setD] = useState({ email: '', phone: '', linkedin: '', github: '', x: '', website: '' })

  const editor = useSectionEditor(
    () => setD({
      email: me.email ?? '', phone: me.phone ?? '',
      linkedin: toHandle(me.linkedin ?? '', LINKEDIN_PREFIX),
      github: toHandle(me.github ?? '', GITHUB_PREFIX),
      x: toHandle(me.x ?? '', X_PREFIX),
      website: me.website ?? '',
    }),
    () => onSave({
      email: d.email || null, phone: d.phone || null,
      linkedin: toUrl(d.linkedin, LINKEDIN_PREFIX) || null,
      github: toUrl(d.github, GITHUB_PREFIX) || null,
      x: toUrl(d.x, X_PREFIX) || null,
      website: d.website || null,
    }),
  )

  const anyContact = !!(me.email || me.phone || me.linkedin || me.github || me.x || me.website)
  const liHandle = toHandle(me.linkedin ?? '', LINKEDIN_PREFIX)
  const ghHandle = toHandle(me.github ?? '', GITHUB_PREFIX)
  const xHandle = toHandle(me.x ?? '', X_PREFIX)

  return <SectionShell id="profile-contacts" title="Contacts and links"
    description="Contact details used only when an application form asks. LinkedIn, GitHub and X take a handle; the full URL is stored."
    {...editor}>
    {editor.editing ? <div className="profile-fields">
      <Field label="Email"><input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })}/></Field>
      <Field label="Phone"><input type="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })}/></Field>
      <Field label="LinkedIn" hint={LINKEDIN_PREFIX + 'your-handle'}>
        <input value={d.linkedin} placeholder="your-handle" onChange={(e) => setD({ ...d, linkedin: e.target.value })}/>
      </Field>
      <Field label="GitHub" hint={GITHUB_PREFIX + 'your-handle'}>
        <input value={d.github} placeholder="your-handle" onChange={(e) => setD({ ...d, github: e.target.value })}/>
      </Field>
      <Field label="X" hint={X_PREFIX + 'your-handle'}>
        <input value={d.x} placeholder="your-handle" onChange={(e) => setD({ ...d, x: e.target.value })}/>
      </Field>
      <Field label="Website"><input type="url" value={d.website} placeholder="https://" onChange={(e) => setD({ ...d, website: e.target.value })}/></Field>
    </div> : <div className="profile-read">
      {me.email ? <div className="profile-read-line"><strong>Email</strong> {me.email}</div> : null}
      {me.phone ? <div className="profile-read-line"><strong>Phone</strong> {me.phone}</div> : null}
      {liHandle ? <div className="profile-read-line"><strong>LinkedIn</strong> <a href={me.linkedin} target="_blank" rel="noreferrer">{liHandle}</a></div> : null}
      {ghHandle ? <div className="profile-read-line"><strong>GitHub</strong> <a href={me.github} target="_blank" rel="noreferrer">{ghHandle}</a></div> : null}
      {xHandle ? <div className="profile-read-line"><strong>X</strong> <a href={me.x} target="_blank" rel="noreferrer">{xHandle}</a></div> : null}
      {me.website ? <div className="profile-read-line"><strong>Website</strong> <a href={me.website} target="_blank" rel="noreferrer">{me.website.replace(/^https?:\/\/(www\.)?/, '')}</a></div> : null}
      {!anyContact ? <NotSet/> : null}
    </div>}
  </SectionShell>
}

type Tab = 'files' | 'profile' | 'qa'

type ProfilePageProps = {
  profileId: number
  onClose: () => void
  profileTab?: React.ComponentType<ProfilePageData>
}

export function ProfilePage({ profileId, onClose, profileTab: ProfileTab }: ProfilePageProps) {
  const data = useProfilePage(profileId)
  const [tab, setTab] = useState<Tab>('profile')
  const { me, profile, loading, error } = data

  return <section className="profile-screen" aria-label="Candidate profile">
    <div className="profile-inner">
      {loading ? <p>Loading profile…</p> : null}
      {error ? <div className="banner error" role="alert">{error}</div> : null}
      {!loading && me && profile
        ? <ProfileHeader me={me} profile={profile} onClose={onClose} onReload={data.reload}/>
        : !loading ? <header className="profile-head">
            <h1>Candidate profile</h1>
            <button type="button" onClick={onClose}>Close</button>
          </header> : null}

      {!loading && me && profile ? <>
        <div className="profile-tabs">
          <div className="profile-tabs-seg">
            <button type="button" aria-pressed={tab === 'files'} onClick={() => setTab('files')}>Files</button>
            <button type="button" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>Profile</button>
            <button type="button" aria-pressed={tab === 'qa'} onClick={() => setTab('qa')}>Questions &amp; Answers</button>
          </div>
        </div>

        {tab === 'files' ? <div className="profile-cols-profile" style={{ maxWidth: 760 }}>
          <div className="profile-col-left">
            <ContactsSection me={me} onSave={data.saveMe}/>
          </div>
        </div> : null}

        {tab === 'profile' && ProfileTab ? <ProfileTab {...data}/> : null}
        {tab === 'profile' && !ProfileTab ? <p className="profile-hint">Profile sections loading…</p> : null}

        {tab === 'qa' ? <QAPanel/> : null}
      </> : null}
    </div>
  </section>
}
