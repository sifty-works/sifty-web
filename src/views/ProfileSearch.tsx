import { useEffect, useMemo, useRef, useState } from 'react'
import { DetailsColumn } from './ProfileDetails.tsx'
import {
  addExclusion, getExclusions, removeExclusion,
  type Compensation, type Exclusion, type Location, type MePatchReq,
  type ProfilePatchReq, type WorkAuthorization,
} from '../api/client.ts'
import { geoLabel, labelOf, regionLabel } from '../state/profile.ts'
import { DateInput } from './DateInputs.tsx'
import { type ProfilePageData, Field, NotSet, SectionShell, TagInput, useSectionEditor } from './ProfilePage.tsx'

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return ''
  if (!currency) return amount.toLocaleString()
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) }
  catch { return `${currency} ${amount.toLocaleString()}` }
}

type GeoItem = { code: string; label: string; group: 'region' | 'country' }

function useGeoItems(ref: ProfilePageData['ref']) {
  return useMemo<GeoItem[]>(() => {
    if (!ref) return []
    const regions: GeoItem[] = ref.regions.map((r) => ({
      code: r.name, label: regionLabel(r), group: 'region' as const,
    }))
    const countries: GeoItem[] = ref.countries.map((c) => ({
      code: c.code, label: c.name, group: 'country' as const,
    }))
    return [...regions, ...countries]
  }, [ref])
}

function CountryTypeahead({ value, onChange, label, allItems, placeholder }: {
  value: string; onChange: (v: string) => void; label: string; allItems: GeoItem[]; placeholder?: string
}) {
  const [text, setText] = useState(() => {
    const found = allItems.find((i) => i.code === value)
    return found ? found.label : value
  })
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const found = allItems.find((i) => i.code === value)
    setText(found ? found.label : value)
  }, [value, allItems])

  const matches = useMemo(() => {
    if (!text.trim()) return allItems.slice(0, 50)
    const q = text.toLowerCase()
    return allItems.filter((i) => i.label.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)).slice(0, 60)
  }, [text, allItems])

  function select(item: GeoItem) {
    onChange(item.code); setText(item.label); setOpen(false); setCursor(-1)
  }

  function handleBlur() {
    setTimeout(() => {
      if (!listRef.current?.contains(document.activeElement)) {
        setOpen(false)

        const found = allItems.find((i) => i.label.toLowerCase() === text.toLowerCase())
        if (found) onChange(found.code)
        else if (text.trim()) onChange(text.trim())
      }
    }, 150)
  }

  return <div className="country-typeahead">
    <input ref={inputRef} aria-label={label} aria-autocomplete="list" aria-expanded={open}
      value={text} placeholder={placeholder ?? 'Country or region…'}
      onChange={(e) => { setText(e.target.value); setOpen(true); setCursor(-1) }}
      onFocus={() => setOpen(true)} onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)) }
        if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)) }
        if (e.key === 'Enter' && cursor >= 0 && matches[cursor]) { e.preventDefault(); select(matches[cursor]) }
        if (e.key === 'Escape') { setOpen(false); setCursor(-1) }
      }}/>
    {open && matches.length > 0 ? <ul ref={listRef} className="country-typeahead-listbox" role="listbox" aria-label={label}>
      {matches.map((item, i) => <li key={item.code} role="option" aria-selected={item.code === value}
        className={`country-typeahead-option${i === cursor ? ' active' : ''}`}
        onMouseDown={() => select(item)}>{item.label}</li>)}
    </ul> : null}
  </div>
}

function LocationsEditor({ locations, onChange, label, allItems }: {
  locations: Location[]; onChange: (v: Location[]) => void; label: string; allItems: GeoItem[]
}) {
  function add() { onChange([...locations, { country: '' }]) }
  function remove(i: number) { onChange(locations.filter((_, j) => j !== i)) }
  function update(i: number, loc: Location) { onChange(locations.map((l, j) => j === i ? loc : l)) }

  return <div>
    <div className="profile-rows">
      {locations.map((loc, i) => <div key={i} className="profile-row profile-row-location">
        <div className="profile-fields-grid">
          <div className="profile-field-block"><span>Country or region</span>
            <CountryTypeahead value={loc.country} allItems={allItems} label={`${label} ${i + 1} country`}
              onChange={(v) => update(i, { ...loc, country: v })}/>
          </div>
          <Field label="City"><input value={loc.city ?? ''} placeholder="City (optional)"
            onChange={(e) => update(i, { ...loc, city: e.target.value || undefined })}/></Field>
        </div>
        <button type="button" className="profile-remove" aria-label={`Remove location ${i + 1}`}
          onClick={() => remove(i)}>×</button>
      </div>)}
    </div>
    <button type="button" className="profile-add" onClick={add}>+ Add location</button>
  </div>
}

function AuthorizationEditor({ items, onChange, allItems, statusOpts }: {
  items: WorkAuthorization[]; onChange: (v: WorkAuthorization[]) => void; allItems: GeoItem[]
  statusOpts: { value: string; label: string }[]
}) {
  function add() { onChange([...items, { country: '' }]) }
  function remove(i: number) { onChange(items.filter((_, j) => j !== i)) }
  function update(i: number, wa: WorkAuthorization) { onChange(items.map((w, j) => j === i ? wa : w)) }

  return <div>
    <div className="profile-rows">
      {items.map((wa, i) => <div key={i} className="profile-row profile-row-authorization">
        <div className="profile-field-block"><span>Country or region</span>
          <CountryTypeahead value={wa.country} allItems={allItems} label={`Authorization ${i + 1} country`}
            onChange={(v) => update(i, { ...wa, country: v })}/>
        </div>
        <Field label="Status">
          <select value={wa.status ?? ''} onChange={(e) => update(i, { ...wa, status: e.target.value || undefined })}>
            <option value="">Not set</option>
            {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <button type="button" className="profile-remove" aria-label={`Remove authorization ${i + 1}`}
          onClick={() => remove(i)}>×</button>
      </div>)}
    </div>
    <button type="button" className="profile-add" onClick={add}>+ Add country</button>
  </div>
}

function InheritedNote({ fieldName, inherited, firstProfileName }: {
  fieldName: string; inherited: Set<string>; firstProfileName: () => string
}) {
  if (!inherited.has(fieldName)) return null
  const name = firstProfileName()
  return <p className="profile-inherited-from">From {name ? `"${name}"` : 'your first profile'}</p>
}

function inheritedClass(fieldName: string, inherited: Set<string>) {
  return inherited.has(fieldName) ? ' profile-inherited-value' : ''
}

function WhatSection({ data }: { data: ProfilePageData }) {
  const { profile, inherited, firstProfileName } = data
  const eff = profile?.effective

  const [roles, setRoles] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [allOf, setAllOf] = useState<string[]>([])
  const [industries, setIndustries] = useState<string[]>([])

  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [exclLoading, setExclLoading] = useState(false)

  useEffect(() => {
    if (!profile) return
    setExclLoading(true)
    void getExclusions(profile.id).then((r) => { setExclusions(r.exclusions.filter((e) => e.kind === 'word')); setExclLoading(false) }).catch(() => setExclLoading(false))
  }, [profile])

  function beginEdit() {
    setRoles(eff?.targetRoles ?? [])
    setKeywords(eff?.keywords ?? [])
    setAllOf(eff?.allOf ?? [])
    setIndustries(eff?.targetIndustries ?? [])
  }

  async function save() {
    const patch: ProfilePatchReq = {
      targetRoles: roles.length ? roles : null,
      keywords: keywords.length ? keywords : null,
      allOf: allOf.length ? allOf : null,
      targetIndustries: industries.length ? industries : null,
    }
    await data.saveProfile(patch)
  }

  const editor = useSectionEditor(beginEdit, save)

  async function addExcl(value: string) {
    if (!profile) return
    try {
      const r = await addExclusion('word', value, profile.id)
      setExclusions(r.exclusions.filter((e) => e.kind === 'word'))
    } catch {  }
  }

  async function removeExcl(id: number) {
    if (!profile) return
    try {
      const r = await removeExclusion(id, profile.id)
      setExclusions(r.exclusions.filter((e) => e.kind === 'word'))
    } catch {  }
  }

  const inds = eff?.targetIndustries ?? []
  const inh = inherited.has('targetIndustries')

  return <SectionShell title="What you're looking for"
    {...editor}>
    {editor.editing ? <div className="profile-fields">
      <TagInput label="Roles" title="Target roles — looked for in the title" variant="roles" values={roles} placeholder="Add a role…" onChange={setRoles}/>
      <TagInput label="Words" title="Words — anywhere in the listing" desc="at least one must appear; when target roles are set, the title must also hold one" variant="any" values={keywords} placeholder="Add a word…" onChange={setKeywords}/>
      <TagInput label="All of these" title="All of these" desc="every term must appear in the listing" variant="all" values={allOf} placeholder="Add a term…" onChange={setAllOf}/>
      <div className="profile-what-row">
        <span className="profile-what-op">Except</span>
        <div className="profile-what-box except">
          <div className="profile-what-box-head">
            <span className="profile-what-box-title">Except — hides a listing when found in its title or company</span>
          </div>
          <div className="profile-what-chips">
            {exclusions.map((ex) => <span key={ex.id} className="profile-tag">{ex.value}
              <button type="button" aria-label={`Remove ${ex.value}`} onClick={() => void removeExcl(ex.id)}>×</button>
            </span>)}
            <label className="profile-tag-add"><span aria-hidden="true">+</span><ExclInput onAdd={(v) => void addExcl(v)} disabled={exclLoading}/></label>
          </div>
        </div>
      </div>
      <TagInput label="Industries" title="Industries" variant="any" values={industries} placeholder="Add an industry…" onChange={setIndustries}/>
    </div> : <div className="profile-read">
      {(eff?.targetRoles ?? []).length ? <div className={`profile-read-line${inheritedClass('targetRoles', inherited)}`}>
        <strong>Roles</strong><ReadTags values={eff!.targetRoles!}/>
      </div> : null}
      {(eff?.keywords ?? []).length ? <div className="profile-read-line"><strong>Words</strong><ReadTags values={eff!.keywords!}/></div> : null}
      {(eff?.allOf ?? []).length ? <div className="profile-read-line"><strong>All of these</strong><ReadTags values={eff!.allOf!}/></div> : null}
      {exclusions.length ? <div className="profile-read-line"><strong>Except</strong>
        <div className="profile-tags">{exclusions.map((e) => <span key={e.id}>{e.value}</span>)}</div>
      </div> : null}
      {inds.length ? <div className={`profile-read-line${inh ? ' profile-inherited-value' : ''}`}>
        <strong>Industries</strong>
        <div className="profile-tags">{inds.map((v, i) => <span key={i}>{v}</span>)}</div>
      </div> : null}
      {inh ? <InheritedNote fieldName="targetIndustries" inherited={inherited} firstProfileName={firstProfileName}/> : null}
      {!(eff?.targetRoles ?? []).length && !(eff?.keywords ?? []).length && !(eff?.allOf ?? []).length && !exclusions.length && !inds.length ? <NotSet/> : null}
    </div>}
  </SectionShell>
}

function ExclInput({ onAdd, disabled }: { onAdd: (v: string) => void; disabled: boolean }) {
  const [text, setText] = useState('')
  function commit() { const v = text.trim(); if (v) { onAdd(v); setText('') } }
  return <input aria-label="Add excluded word" value={text} disabled={disabled} placeholder="add word…"
    onChange={(e) => { const n = e.target.value; if (/[,\n]/.test(n)) { const v = n.replace(/[,\n].*/,'').trim(); if(v){ onAdd(v); setText('') } else setText('') } else setText(n) }}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit() } }}
    onBlur={commit}/>
}

function ReadTags({ values }: { values: string[] }) {
  if (!values.length) return <NotSet/>
  return <div className="profile-tags">{values.map((v, i) => <span key={i}>{v}</span>)}</div>
}

function CompensationSection({ data }: { data: ProfilePageData }) {
  const { profile, inherited, firstProfileName, ref } = data
  const eff = profile?.effective
  const opts = ref?.options

  type C = { cashMin: string; cashTarget: string; currency: string; period: string; grossNet: string; payment: string; equityOnTop: boolean; drMin: string; drTarget: string; drCurrency: string }
  const [d, setD] = useState<C>({ cashMin: '', cashTarget: '', currency: '', period: '', grossNet: '', payment: '', equityOnTop: false, drMin: '', drTarget: '', drCurrency: '' })

  function compToState(c: Compensation | null | undefined): C {
    if (!c) return { cashMin: '', cashTarget: '', currency: '', period: '', grossNet: '', payment: '', equityOnTop: false, drMin: '', drTarget: '', drCurrency: '' }
    return {
      cashMin: c.cashMin != null ? String(c.cashMin) : '',
      cashTarget: c.cashTarget != null ? String(c.cashTarget) : '',
      currency: c.currency ?? '',
      period: c.period ?? '',
      grossNet: c.grossNet ?? '',
      payment: c.crypto ?? '',
      equityOnTop: c.equityOnTop ?? false,
      drMin: c.dayRates?.min != null ? String(c.dayRates.min) : '',
      drTarget: c.dayRates?.target != null ? String(c.dayRates.target) : '',
      drCurrency: c.dayRates?.currency ?? '',
    }
  }

  function beginEdit() {
    setD(compToState(eff?.compensation))
  }

  async function save() {
    const cashMin = d.cashMin ? Number(d.cashMin) : null
    const cashTarget = d.cashTarget ? Number(d.cashTarget) : null
    const drMin = d.drMin ? Number(d.drMin) : null
    const drTarget = d.drTarget ? Number(d.drTarget) : null
    const hasComp = cashMin != null || cashTarget != null || d.currency || d.period
    const hasDR = drMin != null || drTarget != null
    const patch: ProfilePatchReq = {
      compensation: hasComp ? {
        cashMin, cashTarget,
        currency: d.currency || undefined,
        period: d.period || undefined,
        grossNet: d.grossNet || undefined,
        crypto: d.payment || undefined,
        equityOnTop: d.equityOnTop || null,
        dayRates: hasDR ? { min: drMin, target: drTarget, currency: d.drCurrency || undefined } : null,
      } : null,
    }
    await data.saveProfile(patch)
  }

  const editor = useSectionEditor(beginEdit, save)

  const c = eff?.compensation
  const inh = inherited.has('compensation')

  return <SectionShell title="Compensation"
    description="Amounts are compared by Fits you. Currency is EUR or USD; an unset currency or period is not assumed."
    {...editor}>
    {editor.editing ? <div className={`profile-fields${inh ? ' profile-inherited-value' : ''}`}>
      <div className="profile-fields-grid">
        <Field label="Minimum compensation"><input type="number" min={0} value={d.cashMin} onChange={(e) => setD({ ...d, cashMin: e.target.value })}/></Field>
        <Field label="Desired compensation"><input type="number" min={0} value={d.cashTarget} onChange={(e) => setD({ ...d, cashTarget: e.target.value })}/></Field>
        <Field label="Currency">
          <select value={d.currency} onChange={(e) => setD({ ...d, currency: e.target.value })}>
            <option value="">Not set</option>
            {opts?.currencies.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="profile-fields-grid">
        <Field label="Amount period">
          <select value={d.period} onChange={(e) => setD({ ...d, period: e.target.value })}>
            <option value="">Not set</option>
            {opts?.periods.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Taxes">
          <select value={d.grossNet} onChange={(e) => setD({ ...d, grossNet: e.target.value })}>
            <option value="">Not set</option>
            <option value="gross">Before taxes</option>
            <option value="net">After taxes</option>
          </select>
        </Field>
        <Field label="Payment method">
          <select value={d.payment} onChange={(e) => setD({ ...d, payment: e.target.value })}>
            <option value="">Not set</option>
            {opts?.paymentMethods.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <label className="profile-inline-check"><input type="checkbox" checked={d.equityOnTop} onChange={(e) => setD({ ...d, equityOnTop: e.target.checked })}/> Interested in equity or tokens on top of base pay</label>
      <p className="profile-sub-label">Day rate (for contracts)</p>
      <div className="profile-fields-grid">
        <Field label="Minimum / day"><input type="number" min={0} value={d.drMin} onChange={(e) => setD({ ...d, drMin: e.target.value })}/></Field>
        <Field label="Target / day"><input type="number" min={0} value={d.drTarget} onChange={(e) => setD({ ...d, drTarget: e.target.value })}/></Field>
        <Field label="Day rate currency">
          <select value={d.drCurrency} onChange={(e) => setD({ ...d, drCurrency: e.target.value })}>
            <option value="">Not set</option>
            {opts?.currencies.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
    </div> : <div className={`profile-read${inh ? ' profile-inherited-value' : ''}`}>
      {inh ? <p className="profile-inherited-from">From {firstProfileName()} — set your own to override</p> : null}
      {!c ? <NotSet/> : <>
        <div className="profile-read-line"><strong>Salary</strong>
          {c.cashMin == null && c.cashTarget == null
            ? (c.currency ? <>No amount · currency retained: {c.currency}</> : <NotSet/>)
            : <>{fmtMoney(c.cashMin, c.currency)} – {fmtMoney(c.cashTarget, c.currency)}</>}
        </div>
        <div className="profile-read-line"><strong>Taxes and period</strong>
          {[c.grossNet ? (c.grossNet === 'gross' ? 'Before taxes' : c.grossNet === 'net' ? 'After taxes' : c.grossNet) : '', c.period ? labelOf(opts?.periods ?? [], c.period) : ''].filter(Boolean).join(' · ') || <NotSet/>}
        </div>
        <div className="profile-read-line"><strong>Payment method</strong>
          {c.crypto ? labelOf(opts?.paymentMethods ?? [], c.crypto) : 'Crypto accepted (default — no restriction)'}
        </div>
        <div className="profile-read-line"><strong>Equity/tokens</strong>
          {c.equityOnTop ? 'Interested in addition to base pay' : 'No additional equity/token request'}
        </div>
        {c.dayRates && (c.dayRates.min != null || c.dayRates.target != null) ? <div className="profile-read-line"><strong>Day rate</strong>
          {fmtMoney(c.dayRates.min, c.dayRates.currency)} – {fmtMoney(c.dayRates.target, c.dayRates.currency)} per day
        </div> : null}
      </>}
    </div>}
  </SectionShell>
}

function EngagementSection({ data }: { data: ProfilePageData }) {
  const { profile, inherited, firstProfileName, ref } = data
  const eff = profile?.effective
  const opts = ref?.options

  const [engagement, setEngagement] = useState<string[]>([])
  const [workModes, setWorkModes] = useState<string[]>([])
  const [hoursMode, setHoursMode] = useState('')
  const [weekly, setWeekly] = useState('')
  const [weeklyMin, setWeeklyMin] = useState('')
  const [weeklyMax, setWeeklyMax] = useState('')

  function beginEdit() {
    setEngagement(eff?.engagement ?? [])
    setWorkModes(eff?.workModes ?? [])
    setHoursMode(eff?.hours?.mode ?? '')
    setWeekly(eff?.hours?.weekly != null ? String(eff.hours.weekly) : '')
    setWeeklyMin(eff?.hours?.weeklyMin != null ? String(eff.hours.weeklyMin) : '')
    setWeeklyMax(eff?.hours?.weeklyMax != null ? String(eff.hours.weeklyMax) : '')
  }

  async function save() {
    const isPartTime = hoursMode === 'part_time'
    const patch: ProfilePatchReq = {
      engagement: engagement.length ? engagement : null,
      workModes: workModes.length ? workModes : null,
      hours: hoursMode ? {
        mode: hoursMode,
        weekly: isPartTime && weekly ? Number(weekly) : null,
        weeklyMin: isPartTime && weeklyMin ? Number(weeklyMin) : null,
        weeklyMax: isPartTime && weeklyMax ? Number(weeklyMax) : null,
      } : null,
    }
    await data.saveProfile(patch)
  }

  const editor = useSectionEditor(beginEdit, save)

  function toggleArr(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]
  }

  const inhEng = inherited.has('engagement')
  const inhWM = inherited.has('workModes')
  const inhHr = inherited.has('hours')

  return <SectionShell title="Engagement, hours and work modes"
    description="Used by Fits you. Employment and Contract may both be acceptable."
    {...editor}>
    {editor.editing ? <div className="profile-fields">
      <p className="profile-group-heading">Engagement</p>
      <div className={`profile-checks${inhEng ? ' profile-inherited-value' : ''}`}>
        {opts?.engagement.map((o) => <label key={o.value}>
          <input type="checkbox" checked={engagement.includes(o.value)} onChange={() => setEngagement(toggleArr(engagement, o.value))}/>{o.label}
        </label>)}
      </div>
      <p className="profile-hint">Consultant work belongs to Contract.</p>
      <InheritedNote fieldName="engagement" inherited={inherited} firstProfileName={firstProfileName}/>
      <p className="profile-group-heading">Working time</p>
      <div className={inhHr ? ' profile-inherited-value' : ''}>
        <Field label="Full- or part-time">
          <select value={hoursMode} onChange={(e) => setHoursMode(e.target.value)}>
            <option value="">Not set</option>
            {opts?.workingTime.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <InheritedNote fieldName="hours" inherited={inherited} firstProfileName={firstProfileName}/>
      </div>
      {hoursMode === 'part_time' ? <div className="profile-fields-grid">
        <Field label="Hours / week"><input type="number" min={1} max={40} value={weekly} onChange={(e) => setWeekly(e.target.value)}/></Field>
        <Field label="Min hours"><input type="number" min={1} max={40} value={weeklyMin} onChange={(e) => setWeeklyMin(e.target.value)}/></Field>
        <Field label="Max hours"><input type="number" min={1} max={40} value={weeklyMax} onChange={(e) => setWeeklyMax(e.target.value)}/></Field>
      </div> : null}
      <p className="profile-group-heading">Work modes</p>
      <div className={`profile-checks${inhWM ? ' profile-inherited-value' : ''}`}>
        {opts?.workModes.map((o) => <label key={o.value}>
          <input type="checkbox" checked={workModes.includes(o.value)} onChange={() => setWorkModes(toggleArr(workModes, o.value))}/>{o.label}
        </label>)}
      </div>
      <InheritedNote fieldName="workModes" inherited={inherited} firstProfileName={firstProfileName}/>
    </div> : <div className="profile-read">
      <div className={`profile-read-line${inhEng ? ' profile-inherited-value' : ''}`}>
        <strong>Engagement</strong>
        {eff?.engagement?.length ? <ReadTags values={eff.engagement.map((v) => labelOf(opts?.engagement ?? [], v))}/> : <NotSet/>}
      </div>
      <div className={`profile-read-line${inhHr ? ' profile-inherited-value' : ''}`}>
        <strong>Working time</strong>
        {eff?.hours?.mode ? <span>
          {labelOf(opts?.workingTime ?? [], eff.hours.mode)}
          {eff.hours.mode === 'part_time' && eff.hours.weekly != null ? ` · ${eff.hours.weekly}h/week` : ''}
        </span> : <NotSet/>}
      </div>
      <div className={`profile-read-line${inhWM ? ' profile-inherited-value' : ''}`}>
        <strong>Work modes</strong>
        {eff?.workModes?.length ? <ReadTags values={eff.workModes.map((v) => labelOf(opts?.workModes ?? [], v))}/> : <NotSet/>}
      </div>
    </div>}
  </SectionShell>
}

function GeoSection({ data }: { data: ProfilePageData }) {
  const { profile, me, inherited, firstProfileName, ref } = data
  const eff = profile?.effective
  const opts = ref?.options
  const allItems = useGeoItems(ref)

  const [locations, setLocations] = useState<Location[]>([])
  const [relocation, setRelocation] = useState('')
  const [timeZones, setTimeZones] = useState<string[]>([])
  const [curLoc, setCurLoc] = useState<Location | null>(null)
  const [authorizations, setAuthorizations] = useState<WorkAuthorization[]>([])

  function beginEdit() {
    setLocations(eff?.preferredLocations ?? [])
    setRelocation(eff?.relocation ?? '')
    setTimeZones(eff?.timeZones ?? [])
    setCurLoc(me?.currentLocation ?? null)
    setAuthorizations(me?.workAuthorizations ?? [])
  }

  async function save() {
    await Promise.all([
      data.saveProfile({
        preferredLocations: locations.length ? locations : null,
        relocation: relocation || null,
        timeZones: timeZones.length ? timeZones : null,
      } as ProfilePatchReq),
      data.saveMe({
        currentLocation: curLoc?.country ? curLoc : null,
        workAuthorizations: authorizations.length ? authorizations : null,
      } as MePatchReq),
    ])
  }

  const editor = useSectionEditor(beginEdit, save)

  function toggleTZ(code: string) {
    setTimeZones((z) => z.includes(code) ? z.filter((x) => x !== code) : [...z, code])
  }

  const inh = inherited.has('preferredLocations')

  const prefRegions = eff?.preferredLocations?.filter((l) => ref?.regions.some((r) => r.name.toUpperCase() === l.country.toUpperCase())) ?? []
  const prefWork = eff?.preferredLocations?.filter((l) => !ref?.regions.some((r) => r.name.toUpperCase() === l.country.toUpperCase())) ?? []

  return <SectionShell title="Geography and authorization"
    description="Used by the detailed assessment and preparation; not the quick score. No stated eligibility is not ineligibility, and current residence does not prove work authorization."
    {...editor}>
    {editor.editing ? <div className="profile-fields">
      <p className="profile-group-heading">Current location</p>
      <div className="profile-fields-grid">
        <div className="profile-field-block"><span>Country</span>
          <CountryTypeahead value={curLoc?.country ?? ''} allItems={allItems} label="Current country"
            placeholder="Start typing…"
            onChange={(v) => setCurLoc((l) => ({ ...(l ?? {}), country: v }))}/>
        </div>
        <Field label="City (optional)"><input value={curLoc?.city ?? ''} placeholder="Choose a country first"
          onChange={(e) => setCurLoc((l) => ({ country: l?.country ?? '', city: e.target.value || undefined }))}/></Field>
      </div>
      <p className="profile-hint">Where you live now. It does not by itself prove work authorization in that country.</p>
      <p className={`profile-group-heading${inh ? ' profile-inherited-value' : ''}`}>Preferred work locations</p>
      <LocationsEditor locations={locations} onChange={setLocations} label="Location" allItems={allItems}/>
      <InheritedNote fieldName="preferredLocations" inherited={inherited} firstProfileName={firstProfileName}/>
      <p className="profile-group-heading">Work authorization</p>
      <AuthorizationEditor items={authorizations} onChange={setAuthorizations} allItems={allItems} statusOpts={opts?.workAuthorization ?? []}/>
      <Field label="Willing to relocate">
        <select value={relocation} onChange={(e) => setRelocation(e.target.value)}>
          <option value="">Not set</option>
          {opts?.relocation.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <p className="profile-group-heading">Desired timezones</p>
      <div className="profile-checks">
        {ref?.timeZoneBands.map((b) => <label key={b.code}>
          <input type="checkbox" checked={timeZones.includes(b.code)} onChange={() => toggleTZ(b.code)}/>{b.label}
        </label>)}
      </div>
    </div> : <div className="profile-read">
      <div className="profile-read-line">
        <strong>Current location</strong>
        {me?.currentLocation?.country ? geoLabel(me.currentLocation, ref?.countries ?? [], ref?.regions ?? []) : <NotSet/>}
      </div>
      <div className="profile-read-line">
        <strong>Preferred regions</strong>
        {prefRegions.length ? <div className="profile-tags">
          {prefRegions.map((l, i) => <span key={i}>{geoLabel(l, ref?.countries ?? [], ref?.regions ?? [])}</span>)}
        </div> : <NotSet/>}
      </div>
      <div className={`profile-read-line${inh ? ' profile-inherited-value' : ''}`}>
        <strong>Preferred work locations</strong>
        {prefWork.length ? <div className="profile-tags">
          {prefWork.map((l, i) => <span key={i}>{geoLabel(l, ref?.countries ?? [], ref?.regions ?? [])}</span>)}
        </div> : <NotSet/>}
      </div>
      <InheritedNote fieldName="preferredLocations" inherited={inherited} firstProfileName={firstProfileName}/>
      {me?.workAuthorizations?.length ? <div className="profile-read-line">
        <strong>Work authorization</strong>
        <ul className="profile-list">
          {me.workAuthorizations.map((wa, i) => <li key={i}>
            <strong>{geoLabel({ country: wa.country }, ref?.countries ?? [], ref?.regions ?? [])}</strong>
            {wa.status ? <> <span className="profile-level">{labelOf(opts?.workAuthorization ?? [], wa.status)}</span></> : null}
          </li>)}
        </ul>
      </div> : null}
      {eff?.relocation ? <div className="profile-read-line"><strong>Willing to relocate</strong>{labelOf(opts?.relocation ?? [], eff.relocation)}</div> : null}
      {eff?.timeZones?.length ? <div className="profile-read-line"><strong>Desired timezones</strong><div className="profile-tags">{eff.timeZones.map((tz, i) => <span key={i}>{ref?.timeZoneBands.find((b) => b.code === tz)?.label ?? tz}</span>)}</div></div> : null}
    </div>}
  </SectionShell>
}

function AvailabilitySection({ data }: { data: ProfilePageData }) {
  const { me, ref } = data
  const opts = ref?.options

  const [noticeValue, setNoticeValue] = useState('')
  const [noticeUnit, setNoticeUnit] = useState('')
  const [startDate, setStartDate] = useState('')

  function beginEdit() {
    const a = me?.availability
    setNoticeValue(a?.noticeValue != null ? String(a.noticeValue) : '')
    setNoticeUnit(a?.noticeUnit ?? '')
    setStartDate(a?.startDate ?? '')
  }

  async function save() {
    const nv = noticeValue !== '' ? Number(noticeValue) : null
    const patch: MePatchReq = {
      availability: (nv != null || noticeUnit || startDate) ? {
        noticeValue: nv, noticeUnit: noticeUnit || undefined, startDate: startDate || undefined,
      } : null,
    }
    await data.saveMe(patch)
  }

  const editor = useSectionEditor(beginEdit, save)

  const a = me?.availability

  return <SectionShell title="Availability"
    description="Notice period and earliest start date, stored in My data."
    {...editor}>
    {editor.editing ? <div className="profile-fields">
      <div className="profile-fields-grid">
        <Field label="Notice">
          <input type="number" min={0} value={noticeValue} placeholder="e.g. 2" onChange={(e) => setNoticeValue(e.target.value)}/>
        </Field>
        <Field label="Unit">
          <select value={noticeUnit} onChange={(e) => setNoticeUnit(e.target.value)}>
            <option value="">Not set</option>
            {opts?.noticeUnits.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <DateInput label="Available from" value={startDate} onChange={setStartDate}/>
    </div> : <div className="profile-read">
      {a ? <>
        {a.noticeValue != null ? <div className="profile-read-line">
          <strong>Notice</strong>{a.noticeValue} {a.noticeUnit ? labelOf(opts?.noticeUnits ?? [], a.noticeUnit) : ''}
        </div> : null}
        {a.startDate ? <div className="profile-read-line"><strong>Available from</strong>{a.startDate}</div> : null}
        {a.noticeValue == null && !a.startDate ? <NotSet/> : null}
      </> : <NotSet/>}
    </div>}
  </SectionShell>
}

function OtherRequirementsSection({ data }: { data: ProfilePageData }) {
  const { profile } = data
  const [text, setText] = useState('')

  function beginEdit() {
    setText(profile?.effective.otherRequirements ?? '')
  }

  async function save() {
    await data.saveProfile({ otherRequirements: text.trim() || null } as ProfilePatchReq)
  }

  const editor = useSectionEditor(beginEdit, save)

  return <SectionShell title="Other requirements"
    description="Plain text with Markdown. Used by the Shortlist check and preparation; Fits you does not interpret this text."
    {...editor}>
    {editor.editing
      ? <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter any other requirements…"/>
      : profile?.effective.otherRequirements
        ? <p className="profile-rich-view" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{profile.effective.otherRequirements}</p>
        : <NotSet/>}
  </SectionShell>
}

export function ProfileTab(data: ProfilePageData) {
  return <div className="profile-cols-profile">
    <div className="profile-col-left">
      <p className="profile-col-heading">Search setup</p>
      <WhatSection data={data}/>
      <CompensationSection data={data}/>
      <EngagementSection data={data}/>
      <GeoSection data={data}/>
      <AvailabilitySection data={data}/>
      <OtherRequirementsSection data={data}/>
    </div>
    <div className="profile-col-right" id="profile-personal">
      <DetailsColumn data={data}/>
    </div>
  </div>
}
