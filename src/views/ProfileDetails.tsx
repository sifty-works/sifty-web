import { useRef, useState } from 'react'
import { patchProfile, type Demographics, type Experience, type Language, type MePatchReq, type Skill } from '../api/client.ts'
import { announce, failure, retract } from '../state/messages.ts'
import { labelOf } from '../state/profile.ts'
import { MonthYearInput } from './DateInputs.tsx'
import { type ProfilePageData, Field, Md, NotSet, SectionShell, useSectionEditor } from './ProfilePage.tsx'

function insertMd(el: HTMLTextAreaElement, before: string, after: string, cb: (v: string) => void) {
  const { selectionStart: s, selectionEnd: e, value: v } = el
  const sel = v.slice(s, e)
  cb(v.slice(0, s) + before + sel + after + v.slice(e))
  requestAnimationFrame(() => { el.setSelectionRange(s + before.length, s + before.length + sel.length); el.focus() })
}

function prefixLine(el: HTMLTextAreaElement, prefix: string, cb: (v: string) => void) {
  const { selectionStart: s, value: v } = el
  const ls = v.lastIndexOf('\n', s - 1) + 1
  const has = v.slice(ls).startsWith(prefix)
  if (has) { cb(v.slice(0, ls) + v.slice(ls + prefix.length)); requestAnimationFrame(() => { el.setSelectionRange(s - prefix.length, s - prefix.length); el.focus() }) }
  else { cb(v.slice(0, ls) + prefix + v.slice(ls)); requestAnimationFrame(() => { el.setSelectionRange(s + prefix.length, s + prefix.length); el.focus() }) }
}

function MDArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  function wrap(b: string, a: string) { if (ref.current) insertMd(ref.current, b, a, onChange) }
  function pfx(p: string) { if (ref.current) prefixLine(ref.current, p, onChange) }
  return <div className="profile-md-area">
    <div className="profile-md-toolbar">
      <button type="button" onMouseDown={(e) => { e.preventDefault(); wrap('**', '**') }}><b>B</b></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); wrap('*', '*') }}><i>I</i></button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); pfx('# ') }}>H1</button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); pfx('## ') }}>H2</button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); pfx('### ') }}>H3</button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); pfx('- ') }}>• List</button>
      <button type="button" onMouseDown={(e) => { e.preventDefault(); pfx('1. ') }}>1. List</button>
    </div>
    <textarea ref={ref} rows={4} value={value} onChange={(e) => onChange(e.target.value)}/>
  </div>
}

const SKILL_LEVEL_TIPS: Record<string, string> = {
  beginner: 'Beginner — learning, some exposure',
  proficient: 'Proficient — can work independently',
  expert: 'Expert — deep knowledge, can mentor others',
}

function SkillChip({ skill }: { skill: Skill }) {
  const level = (skill.level ?? '').toLowerCase()
  const tip = SKILL_LEVEL_TIPS[level]
  const title = tip ? `${skill.name}: ${tip}${skill.source ? ` · from ${skill.source}` : ''}` : skill.name
  return <span className={`profile-skill level-${level || 'none'}`} title={title}>{skill.name}</span>
}

function SkillsSection({ data }: { data: ProfilePageData }) {
  const { me, profile, ref } = data
  const [skills, setSkills] = useState<Skill[]>([])
  const [copyBusy, setCopyBusy] = useState(false)
  const opts = ref?.options

  function beginEdit() {
    setSkills(me?.skills?.map((s) => ({ ...s })) ?? [])
  }

  async function save() {
    await data.saveMe({ skills: skills.length ? skills : null } as MePatchReq)
  }

  const editor = useSectionEditor(beginEdit, save)

  async function copyToSearch() {
    if (!profile) return
    setCopyBusy(true); retract('skills')
    try {
      const existing = new Set((profile.effective.keywords ?? []).map((k) => k.toLowerCase()))
      const toAdd = (me?.skills ?? []).map((s) => s.name).filter((n) => !existing.has(n.toLowerCase()))
      if (toAdd.length) {
        await patchProfile(profile.id, { keywords: [...(profile.effective.keywords ?? []), ...toAdd] })
        await data.reload()
      }
    } catch (e) { announce(failure(e, 'Could not copy skills to search'), 'skills') } finally { setCopyBusy(false) }
  }

  async function removeAbsent(i: number) {
    const next = (me?.absentSkills ?? []).filter((_, j) => j !== i)
    try { await data.saveMe({ absentSkills: next.length ? next : null } as MePatchReq); retract('skills') }
    catch (e) { announce(failure(e, 'Could not remove the skill'), 'skills') }
  }

  async function removeConfirmed(i: number) {
    const next = (me?.confirmedFacts ?? []).filter((_, j) => j !== i)
    try { await data.saveMe({ confirmedFacts: next.length ? next : null } as MePatchReq); retract('skills') }
    catch (e) { announce(failure(e, 'Could not remove the fact'), 'skills') }
  }

  function addSkill() { setSkills((s) => [...s, { name: '' }]) }
  function removeSkill(i: number) { setSkills((s) => s.filter((_, j) => j !== i)) }
  function updateSkill(i: number, sk: Skill) { setSkills((s) => s.map((x, j) => j === i ? sk : x)) }

  const displaySkills = me?.skills ?? []
  const absentSkills = me?.absentSkills ?? []
  const confirmedFacts = me?.confirmedFacts ?? []

  return <SectionShell title="Skills" {...editor}>
    {editor.editing ? <>
      <div className="profile-rows">
        {skills.map((sk, i) => <div key={i} className="profile-row profile-row-skill">
          <Field label={i === 0 ? 'Name' : undefined as unknown as string}>
            <input value={sk.name} placeholder="Skill name" onChange={(e) => updateSkill(i, { ...sk, name: e.target.value })}/>
          </Field>
          <Field label={i === 0 ? 'Level' : undefined as unknown as string}>
            <select value={sk.level ?? ''} onChange={(e) => updateSkill(i, { ...sk, level: e.target.value || undefined })}>
              <option value="">Not set</option>
              {opts?.skillLevels.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <button type="button" className="profile-remove" aria-label={`Remove ${sk.name}`} onClick={() => removeSkill(i)}>×</button>
        </div>)}
      </div>
      <button type="button" className="profile-add" onClick={addSkill}>+ Add skill</button>
    </> : <>
      {displaySkills.length ? <div className="profile-skill-chips">
        {displaySkills.map((sk, i) => <SkillChip key={i} skill={sk}/>)}
      </div> : <NotSet/>}
      {displaySkills.length ? <div className="profile-skill-legend">
        <span className="profile-skill level-beginner">Beginner</span>
        <span className="profile-skill level-proficient">Proficient</span>
        <span className="profile-skill level-expert">Expert</span>
      </div> : null}
      {profile && displaySkills.length ? <div className="profile-absent-skills">
        <h4>Copy to search</h4>
        <p className="profile-absent-note">Add skill names as search terms for this profile. Skills already in search are skipped.</p>
        <div className="profile-document-actions">
          <button type="button" className="primary" disabled={copyBusy} onClick={() => void copyToSearch()}>
            {copyBusy ? 'Copying…' : 'Copy all skills to search'}
          </button>
        </div>
      </div> : null}
      {absentSkills.length ? <div className="profile-absent-skills">
        <h4>Skills you do not have</h4>
        <p className="profile-absent-note">Marked from vacancies with the cross. A requirement for one of these counts as not met, and it is not offered again.</p>
        <div className="profile-skill-chips">{absentSkills.map((sk, i) => <span key={i} className="profile-skill absent">
          {sk.name}<button type="button" className="profile-skill-remove" aria-label={`Remove ${sk.name}`} onClick={() => void removeAbsent(i)}>×</button>
        </span>)}</div>
      </div> : null}
      {confirmedFacts.length ? <div className="profile-absent-skills">
        <h4>Confirmed by you</h4>
        <p className="profile-absent-note">Marked from vacancies. These requirements are decided ✓ or ✕ by code without asking the model, and are listed here so you can remove them.</p>
        <div className="profile-skill-chips">{confirmedFacts.map((f, i) => <span key={i} className={`profile-skill ${f.have ? 'confirmed-have' : 'absent'}`}>
          {f.have ? '✓ ' : '✕ '}{f.text}<button type="button" className="profile-skill-remove" aria-label={`Remove ${f.text}`} onClick={() => void removeConfirmed(i)}>×</button>
        </span>)}</div>
      </div> : null}
    </>}
  </SectionShell>
}

function ExperienceSection({ data }: { data: ProfilePageData }) {
  const { me } = data
  const [roles, setRoles] = useState<Experience[]>([])

  function beginEdit() {
    setRoles(me?.experience?.map((r) => ({ ...r })) ?? [])
  }

  async function save() {
    await data.saveMe({ experience: roles.length ? roles : null } as MePatchReq)
  }

  const editor = useSectionEditor(beginEdit, save)

  function addRole() { setRoles((r) => [...r, { title: '', company: '' }]) }
  function removeRole(i: number) { setRoles((r) => r.filter((_, j) => j !== i)) }
  function updateRole(i: number, r: Experience) { setRoles((rs) => rs.map((x, j) => j === i ? r : x)) }

  const exp = me?.experience ?? []

  return <SectionShell title="Experience"
    description="Used by the detailed assessment and preparation; not part of the quick score. Dates are month/year and never invent a day."
    {...editor}>
    {editor.editing ? <>
      {roles.map((r, i) => <div key={i} className="profile-row profile-row-experience">
        <Field label="Company"><input value={r.company} onChange={(e) => updateRole(i, { ...r, company: e.target.value })}/></Field>
        <Field label="Role"><input value={r.title} onChange={(e) => updateRole(i, { ...r, title: e.target.value })}/></Field>
        <MonthYearInput label="Start" value={r.start ?? ''} onChange={(v) => updateRole(i, { ...r, start: v || undefined })} disabled={false}/>
        <MonthYearInput label="End" value={r.end ?? ''} onChange={(v) => updateRole(i, { ...r, end: v || undefined })} disabled={r.current}/>
        <label className="profile-inline-check">
          <input type="checkbox" checked={r.current ?? false} onChange={(e) => updateRole(i, { ...r, current: e.target.checked, end: e.target.checked ? undefined : r.end })}/>
          Currently working here
        </label>
        <div className="profile-field-block" style={{ gridColumn: '1/-1' }}>
          <span>Summary</span>
          <MDArea value={r.summary ?? ''} onChange={(v) => updateRole(i, { ...r, summary: v || undefined })}/>
          <small>Bold, italic, headings and lists are supported; other formatting is not stored.</small>
        </div>
        <button type="button" className="profile-remove-text" onClick={() => removeRole(i)}>Remove this role</button>
      </div>)}
      <button type="button" className="profile-add" onClick={addRole}>+ Add role</button>
    </> : <>
      {exp.length ? <ul className="profile-list">
        {exp.map((r, i) => <li key={i}>
          <p><strong>{r.title}</strong> · {r.company}</p>
          <p className="muted" style={{ fontSize: 12 }}>{[r.start, r.current ? 'Present' : r.end].filter(Boolean).join(' – ')}</p>
          {r.summary ? <Md text={r.summary}/> : null}
        </li>)}
      </ul> : <NotSet/>}
    </>}
  </SectionShell>
}

function LanguagesSection({ data }: { data: ProfilePageData }) {
  const { me, ref } = data
  const [langs, setLangs] = useState<Language[]>([])
  const opts = ref?.options

  function beginEdit() {
    setLangs(me?.languages?.map((l) => ({ ...l })) ?? [])
  }

  async function save() {
    await data.saveMe({ languages: langs.length ? langs : null } as MePatchReq)
  }

  const editor = useSectionEditor(beginEdit, save)

  function add() { setLangs((l) => [...l, { name: '' }]) }
  function remove(i: number) { setLangs((l) => l.filter((_, j) => j !== i)) }
  function update(i: number, lang: Language) { setLangs((l) => l.map((x, j) => j === i ? lang : x)) }

  const display = me?.languages ?? []

  return <SectionShell title="Languages"
    description="Used by the detailed assessment and preparation; not part of the quick score. Pre-A1 is an honest beginner label, not CEFR A0."
    {...editor}>
    {editor.editing ? <>
      <div className="profile-rows">
        {langs.map((lang, i) => <div key={i} className="profile-row profile-row-language">
          <Field label={i === 0 ? 'Language' : undefined as unknown as string}>
            <input value={lang.name} placeholder="e.g. English" onChange={(e) => update(i, { ...lang, name: e.target.value })}/>
          </Field>
          <Field label={i === 0 ? 'Level' : undefined as unknown as string}>
            <select value={lang.level ?? ''} onChange={(e) => update(i, { ...lang, level: e.target.value || undefined })}>
              <option value="">Not set</option>
              {opts?.languageLevels.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <button type="button" className="profile-remove" aria-label={`Remove ${lang.name}`} onClick={() => remove(i)}>×</button>
        </div>)}
      </div>
      <button type="button" className="profile-add" onClick={add}>+ Add language</button>
    </> : <>
      {display.length ? <div className="profile-tags">{display.map((l, i) => <span key={i} title={l.level ? labelOf(opts?.languageLevels ?? [], l.level) : undefined}>{l.name}{l.level ? ` · ${l.level}` : ''}</span>)}</div> : <NotSet/>}
    </>}
  </SectionShell>
}

function DemographicsSection({ data }: { data: ProfilePageData }) {
  const { me, ref } = data
  const opts = ref?.options

  const blank = (): Demographics => ({ gender: undefined, genderDescription: undefined, race: undefined, raceDescription: undefined, ethnicity: undefined, disability: undefined, veteranStatus: undefined, criminalRecord: undefined })
  const [d, setD] = useState<Demographics>(blank)

  function beginEdit() {
    setD(me?.demographics ? { ...me.demographics } : blank())
  }

  async function save() {
    const hasAny = !!(d.gender || d.race?.length || d.ethnicity || d.disability || d.veteranStatus || d.criminalRecord)
    await data.saveMe({ demographics: hasAny ? d : null } as MePatchReq)
  }

  const editor = useSectionEditor(beginEdit, save)

  function toggleRace(v: string) {
    const cur = d.race ?? []
    if (v === 'prefer_not') setD({ ...d, race: ['prefer_not'], raceDescription: undefined })
    else setD({ ...d, race: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur.filter((x) => x !== 'prefer_not'), v] })
  }

  const demo = me?.demographics
  const hasAny = demo && !!(demo.gender || demo.race?.length || demo.ethnicity || demo.disability || demo.veteranStatus || demo.criminalRecord)

  return <SectionShell title="Application form answers"
    description="Used only to fill application forms, never sent to a model."
    {...editor}>
    {editor.editing ? <div className="profile-fields">
      <Field label="Gender">
        <select value={d.gender ?? ''} onChange={(e) => setD({ ...d, gender: e.target.value || undefined })}>
          <option value="">Prefer not to say</option>
          {opts?.gender.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      {d.gender === 'self_describe' ? <Field label="Self-description">
        <input value={d.genderDescription ?? ''} onChange={(e) => setD({ ...d, genderDescription: e.target.value })}/>
      </Field> : null}
      <div className="profile-field">
        <span>Race</span>
        <div className="profile-checks">
          {opts?.race.map((o) => <label key={o.value}>
            <input type="checkbox" checked={(d.race ?? []).includes(o.value)} onChange={() => toggleRace(o.value)}/>{o.label}
          </label>)}
        </div>
      </div>
      {d.race?.length && !d.race.includes('prefer_not') ? <Field label="Race self-description">
        <input value={d.raceDescription ?? ''} onChange={(e) => setD({ ...d, raceDescription: e.target.value })}/>
      </Field> : null}
      <Field label="Ethnicity">
        <select value={d.ethnicity ?? ''} onChange={(e) => setD({ ...d, ethnicity: e.target.value || undefined })}>
          <option value="">Prefer not to say</option>
          {opts?.ethnicity.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Disability status">
        <select value={d.disability ?? ''} onChange={(e) => setD({ ...d, disability: e.target.value || undefined })}>
          <option value="">Prefer not to say</option>
          {opts?.disability.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Veteran status">
        <select value={d.veteranStatus ?? ''} onChange={(e) => setD({ ...d, veteranStatus: e.target.value || undefined })}>
          <option value="">Prefer not to say</option>
          {opts?.veteranStatus.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Criminal record">
        <select value={d.criminalRecord ?? ''} onChange={(e) => setD({ ...d, criminalRecord: e.target.value || undefined })}>
          <option value="">Prefer not to say</option>
          {opts?.criminalRecord.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    </div> : <div className="profile-read">
      {!hasAny ? <NotSet/> : <>
        {demo?.gender ? <div className="profile-read-line"><strong>Gender</strong>{labelOf(opts?.gender ?? [], demo.gender)}{demo.genderDescription ? ` (${demo.genderDescription})` : ''}</div> : null}
        {demo?.race?.length ? <div className="profile-read-line"><strong>Race</strong>{demo.race.map((v) => labelOf(opts?.race ?? [], v)).join(', ')}{demo.raceDescription ? ` (${demo.raceDescription})` : ''}</div> : null}
        {demo?.ethnicity ? <div className="profile-read-line"><strong>Ethnicity</strong>{labelOf(opts?.ethnicity ?? [], demo.ethnicity)}</div> : null}
        {demo?.disability ? <div className="profile-read-line"><strong>Disability</strong>{labelOf(opts?.disability ?? [], demo.disability)}</div> : null}
        {demo?.veteranStatus ? <div className="profile-read-line"><strong>Veteran</strong>{labelOf(opts?.veteranStatus ?? [], demo.veteranStatus)}</div> : null}
        {demo?.criminalRecord ? <div className="profile-read-line"><strong>Criminal record</strong>{labelOf(opts?.criminalRecord ?? [], demo.criminalRecord)}</div> : null}
      </>}
    </div>}
  </SectionShell>
}

export function DetailsColumn({ data }: { data: ProfilePageData }) {
  return <>
    <p className="profile-col-heading">Personal details</p>
    <SkillsSection data={data}/>
    <ExperienceSection data={data}/>
    <LanguagesSection data={data}/>
    <DemographicsSection data={data}/>
  </>
}
