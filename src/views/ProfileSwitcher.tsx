import { useEffect, useRef, useState } from 'react'
import { createProfile, deleteProfile, getProfiles, patchProfile, setActiveProfile, type ProfileListItem } from '../api/client.ts'
import { colorFor } from '../state/profile.ts'
import { Icon } from './Icon.tsx'

export { colorFor }

export function ProfileSwitcher({ profileOpen, onOpenProfile, onSwitch }: {
  profileOpen: boolean
  onOpenProfile: (id: number) => void
  onSwitch: (id: number) => void
}) {
  const [menu, setMenu] = useState(false)
  const [profiles, setProfiles] = useState<ProfileListItem[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getProfiles().then((r) => {
      setProfiles(r.profiles)
      const active = r.profiles.find((p) => p.active)
      if (active) setActiveId(active.id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!menu) { setCreating(false); setRenamingId(null); setDeletingId(null); return }
    const outside = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', esc) }
  }, [menu])

  async function switchTo(id: number) {
    if (id === activeId) { setMenu(false); onOpenProfile(id); return }
    try {
      const r = await setActiveProfile(id)
      setProfiles(r.profiles)
      setActiveId(id)
      setMenu(false)
      onSwitch(id)
    } catch { /* leave menu open */ }
  }

  async function doCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = createName.trim(); if (!name) return
    setCreateBusy(true)
    try {
      const created = await createProfile(name)
      const r = await setActiveProfile(created.id)
      setProfiles(r.profiles)
      setActiveId(created.id)
      setCreateName(''); setCreating(false); setMenu(false)
      onSwitch(created.id)
      onOpenProfile(created.id)
    } catch { /* leave form open */ } finally { setCreateBusy(false) }
  }

  async function doRename(e: React.FormEvent, p: ProfileListItem) {
    e.preventDefault()
    const name = renameDraft.trim(); if (!name) return
    try {
      await patchProfile(p.id, { name })
      const r = await getProfiles()
      setProfiles(r.profiles)
      setRenamingId(null)
    } catch { /* leave open */ }
  }

  async function doDelete(id: number) {
    try {
      const r = await deleteProfile(id)
      setProfiles(r.profiles)
      const next = r.profiles.find((p) => p.active)
      if (next) { setActiveId(next.id); onSwitch(next.id) }
      setDeletingId(null)
    } catch { /* leave open */ }
  }

  const active = profiles.find((p) => p.id === activeId)
  const idx = profiles.findIndex((p) => p.id === activeId)
  const color = colorFor(idx >= 0 ? idx : 0)

  return <div className="profile-switcher" ref={box}>
    <button type="button" className={`settings-button profile-button${profileOpen ? ' active' : ''}`}
      aria-haspopup="menu" aria-expanded={menu} title="Profiles" onClick={() => setMenu(!menu)}>
      <span className="profile-user-icon" style={{ color }}><Icon name="user" size={16}/></span>
      <span className="profile-switcher-name">{active?.name || 'Profile 1'}</span>
      <span className="profile-switcher-caret" aria-hidden="true">▾</span>
    </button>
    {menu ? <div className="profile-menu" role="menu" aria-label="Profiles">
      <p className="profile-menu-title">Profiles</p>
      {profiles.map((p, i) => renamingId === p.id
        ? <form key={p.id} className="profile-menu-rename" onSubmit={(e) => void doRename(e, p)}>
            <i className="profile-dot" style={{ background: colorFor(i) }} aria-hidden="true"/>
            <input autoFocus aria-label="Profile name" value={renameDraft} placeholder={p.name}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setRenamingId(null) } }}/>
            <button type="submit" className="primary">Save</button>
          </form>
        : deletingId === p.id
        ? <div key={p.id} className="profile-menu-rename">
            <span style={{ flex: 1, fontSize: 13, color: '#ececee' }}>Delete "{p.name}"?</span>
            <button type="button" className="primary" style={{ background: '#b23a22' }} onClick={() => void doDelete(p.id)}>Delete</button>
            <button type="button" onClick={() => setDeletingId(null)}>Cancel</button>
          </div>
        : <div key={p.id} className="profile-menu-row">
            <button type="button" role="menuitemradio" aria-checked={p.id === activeId}
              className={`profile-menu-item${p.id === activeId ? ' current' : ''}`}
              onClick={() => void switchTo(p.id)}>
              <i className="profile-dot" style={{ background: colorFor(i) }} aria-hidden="true"/>
              <span>{p.name || 'Profile 1'}</span>
              {p.id === activeId && <span className="profile-menu-check" aria-hidden="true">✓</span>}
            </button>
            <button type="button" className="profile-menu-rename-btn" title="Rename" aria-label={`Rename ${p.name}`}
              onClick={() => { setRenameDraft(p.name); setRenamingId(p.id); setDeletingId(null); setCreating(false) }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>
              </svg>
            </button>
            {profiles.length > 1 && <button type="button" className="profile-menu-rename-btn" title="Delete" aria-label={`Delete ${p.name}`}
              style={{ color: '#b23a22' }} onClick={() => { setDeletingId(p.id); setRenamingId(null); setCreating(false) }}>
              ×
            </button>}
          </div>)}
      {creating
        ? <form className="profile-menu-rename profile-menu-create" onSubmit={(e) => void doCreate(e)}>
            <i className="profile-dot" style={{ background: colorFor(profiles.length) }} aria-hidden="true"/>
            <input autoFocus aria-label="New profile name" value={createName} placeholder="Profile name"
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setCreating(false) } }}/>
            <button type="submit" className="primary" disabled={createBusy || !createName.trim()}>
              {createBusy ? 'Creating…' : 'Create'}
            </button>
          </form>
        : <button type="button" role="menuitem" className="profile-menu-item add"
            onClick={() => { setCreating(true); setRenamingId(null); setDeletingId(null) }}>
            + Add new profile
          </button>}
    </div> : null}
  </div>
}
