import { useEffect, useMemo, useRef, useState } from 'react'
import { DetailsColumn } from './ProfileDetails.tsx'
import {
  addExclusion, getExclusions, removeExclusion,
  type Compensation, type Exclusion, type Location, type MePatchReq,
  type ProfilePatchReq, type WorkAuthorization,
} from '../api/client.ts'
import { describe, failure, type Note } from '../state/messages.ts'
import { geoLabel, labelOf, regionLabel } from '../state/profile.ts'
import { DateInput } from './DateInputs.tsx'
import { BUCKETS, CountryTypeahead, GoalsTable, fromLists, mapLists, toLists, type GeoItem, type GoalRow, type Lists } from './GoalsTable.tsx'
import { Message } from './Messages.tsx'
import { type ProfilePageData, Field, NotSet, SectionShell, TagInput, useSectionEditor } from './ProfilePage.tsx'

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return ''
  if (!currency) return amount.toLocaleString()
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount) }
  catch { return `${currency} ${amount.toLocaleString()}` }
}

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
  const { profile, inherited } = data
  const eff = profile?.effective

  const [roles, setRoles] = useState<string[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [allOf, setAllOf] = useState<string[]>([])

  const [exclusions, setExclusions] = useState<Exclusion[]>([])
  const [exclLoading, setExclLoading] = useState(false)
  const [exclNote, setExclNote] = useState<Note | null>(null)

  useEffect(() => {
    if (!profile) return
    setExclLoading(true)
    void getExclusions(profile.id).then((r) => { setExclusions(r.exclusions.filter((e) => e.kind === 'word')); setExclLoading(false) }).catch((e) => {
      setExclNote(failure(`The excluded words could not be loaded. ${describe(e, '')}`.trim()))
      setExclLoading(false)
    })
  }, [profile])

  function beginEdit() {
    setRoles(eff?.targetRoles ?? [])
    setKeywords(eff?.keywords ?? [])
    setAllOf(eff?.allOf ?? [])
  }

  async function save() {
    const patch: ProfilePatchReq = {
      targetRoles: roles.length ? roles : null,
      keywords: keywords.length ? keywords : null,
      allOf: allOf.length ? allOf : null,
    }
    await data.saveProfile(patch)
  }

  const editor = useSectionEditor(beginEdit, save)

  async function addExcl(value: string) {
    if (!profile) return
    try {
      const r = await addExclusion('word', value, profile.id)
      setExclusions(r.exclusions.filter((e) => e.kind === 'word')); setExclNote(null)
    } catch (e) { setExclNote(failure(e, 'Could not add the word')) }
  }

  async function removeExcl(id: number) {
    if (!profile) return
    try {
      const r = await removeExclusion(id, profile.id)
      setExclusions(r.exclusions.filter((e) => e.kind === 'word')); setExclNote(null)
    } catch (e) { setExclNote(failure(e, 'Could not remove the word')) }
  }

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
          <Message note={exclNote}/>
        </div>
      </div>
    </div> : <div className="profile-read">
      {(eff?.targetRoles ?? []).length ? <div className={`profile-read-line${inheritedClass('targetRoles', inherited)}`}>
        <strong>Roles</strong><ReadTags values={eff!.targetRoles!}/>
      </div> : null}
      {(eff?.keywords ?? []).length ? <div className="profile-read-line"><strong>Words</strong><ReadTags values={eff!.keywords!}/></div> : null}
      {(eff?.allOf ?? []).length ? <div className="profile-read-line"><strong>All of these</strong><ReadTags values={eff!.allOf!}/></div> : null}
      {exclusions.length ? <div className="profile-read-line"><strong>Except</strong>
        <div className="profile-tags">{exclusions.map((e) => <span key={e.id}>{e.value}</span>)}</div>
      </div> : null}
      {!(eff?.targetRoles ?? []).length && !(eff?.keywords ?? []).length && !(eff?.allOf ?? []).length && !exclusions.length ? <NotSet/> : null}
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
    description="Amounts are compared by Fit. Currency is EUR or USD; an unset currency or period is not assumed."
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

const CRITERIA = [
  { key: 'workMode', title: 'Work mode', sub: 'How you work', options: 'workModes' },
  { key: 'engagementType', title: 'Engagement', sub: 'Kind of contract', options: 'engagement' },
  { key: 'workingTime', title: 'Hours', sub: 'Full or part of the week', options: 'workingTime' },
  { key: 'domain', title: 'Domain', sub: 'What the company does', options: 'domains' },
] as const

type Crit = (typeof CRITERIA)[number]['key'] | 'locations'

function omit<T extends object>(o: T, key: keyof T): T {
  const { [key]: _, ...rest } = o
  return rest as T
}

function placeBook(items: GeoItem[], ref: ProfilePageData['ref'], saved: Location[]) {
  const text = (l: Location) => geoLabel(l, ref?.countries ?? [], ref?.regions ?? [])
  const origin = new Map(saved.map((l) => [text(l), l]))
  const find = (t: string) => items.find((i) => i.label.toLowerCase() === t.trim().toLowerCase() || i.code.toLowerCase() === t.trim().toLowerCase())
  const loc = (t: string): Location => {
    const whole = find(t)
    const cut = t.lastIndexOf(',')
    const tail = cut > 0 ? find(t.slice(cut + 1)) : undefined
    if (whole) return { country: whole.code }
    return origin.get(t) ?? (tail ? { country: tail.code, city: t.slice(0, cut).trim() } : { country: t })
  }
  return { text, loc, known: (t: string) => items.some((i) => i.code.toLowerCase() === loc(t).country.toLowerCase()) }
}

function GoalsSection({ data }: { data: ProfilePageData }) {
  const { profile, inherited, firstProfileName, ref } = data
  const eff = profile?.effective
  const items = useGeoItems(ref)
  const book = placeBook(items, ref, eff?.locations ? BUCKETS.flatMap((b) => eff.locations?.[b] ?? []) : [])
  const [pending, setPending] = useState<Partial<Record<Crit, Lists>>>({})
  const [note, setNote] = useState<Note | null>(null)

  const saved: Record<Crit, Lists> = {
    workMode: toLists(eff?.workMode), engagementType: toLists(eff?.engagementType), workingTime: toLists(eff?.workingTime), domain: toLists(eff?.domain),
    locations: mapLists(toLists<Location>(eff?.locations), (v) => v.map(book.text)),
  }
  const cur = { ...saved, ...pending }

  const queue = useRef(Promise.resolve())
  function enqueue(patch: ProfilePatchReq, fail: string, done: () => void) {
    queue.current = queue.current
      .then(() => data.saveProfile(patch))
      .then(() => setNote(null), (e) => setNote(failure(e, fail)))
      .finally(done)
  }

  function change(key: Crit, lists: Lists) {
    setPending((p) => ({ ...p, [key]: lists })); setNote(null)
    const value = key === 'locations' ? fromLists(mapLists(lists, (v) => v.map(book.loc))) : fromLists(lists)
    enqueue({ [key]: value } as ProfilePatchReq, 'Could not save the goals', () => setPending((p) => (p[key] === lists ? omit(p, key) : p)))
  }

  function saveHours(key: string, value: string) {
    const h = { weekly: eff?.hours?.weekly ?? null, weeklyMin: eff?.hours?.weeklyMin ?? null, weeklyMax: eff?.hours?.weeklyMax ?? null, [key]: value ? Number(value) : null }
    enqueue({ hours: h }, 'Could not save the hours', () => {})
  }

  const from = (key: string) => (inherited.has(key) ? firstProfileName() : undefined)
  const rows: GoalRow[] = [
    ...CRITERIA.map((c) => ({
      key: c.key, title: c.title, sub: c.sub, lists: cur[c.key], options: ref?.options[c.options] ?? [], from: from(c.key),
      onChange: (l: Lists) => change(c.key, l),
    })),
    {
      key: 'locations', title: 'Location', sub: 'Countries, regions, cities', lists: cur.locations, from: from('locations'),
      suggest: items, known: book.known, onChange: (l: Lists) => change('locations', l),
    },
  ]
  const part = BUCKETS.some((b) => b !== 'never' && cur.workingTime[b].includes('part_time'))

  return <section className="profile-card">
    <header className="profile-card-head">
      <div><h2>Goals</h2>
        <p className="muted">What raises the fit, what is fine, what lowers it and what you never want. Drag a value to another column, or click it for a menu; every change is saved at once. A place is a country, a region or a city with its country (Berlin, Germany); one that is not in the list is marked and matches nothing.</p>
      </div>
    </header>
    <Message note={note}/>
    <div className="profile-card-body">
      <GoalsTable rows={rows}/>
      {part ? <div className={`profile-fields${inherited.has('hours') ? ' profile-inherited-value' : ''}`}>
        <p className="profile-group-heading">Part-time hours</p>
        <div className="profile-fields-grid">
          {([['weekly', 'Hours / week'], ['weeklyMin', 'Min hours'], ['weeklyMax', 'Max hours']] as const).map(([k, label]) => {
            const v = eff?.hours?.[k]
            return <Field key={`${k}${v}`} label={label}><input type="number" min={1} max={40} defaultValue={v ?? ''}
              onBlur={(e) => { if (e.target.value !== String(v ?? '')) saveHours(k, e.target.value) }}/></Field>
          })}
        </div>
        <InheritedNote fieldName="hours" inherited={inherited} firstProfileName={firstProfileName}/>
      </div> : null}
    </div>
  </section>
}

function GeoSection({ data }: { data: ProfilePageData }) {
  const { profile, me, ref } = data
  const eff = profile?.effective
  const opts = ref?.options
  const allItems = useGeoItems(ref)

  const [relocation, setRelocation] = useState('')
  const [timeZones, setTimeZones] = useState<string[]>([])
  const [curLoc, setCurLoc] = useState<Location | null>(null)
  const [authorizations, setAuthorizations] = useState<WorkAuthorization[]>([])

  function beginEdit() {
    setRelocation(eff?.relocation ?? '')
    setTimeZones(eff?.timeZones ?? [])
    setCurLoc(me?.currentLocation ?? null)
    setAuthorizations(me?.workAuthorizations ?? [])
  }

  async function save() {
    await Promise.all([
      data.saveProfile({
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
    description="Plain text with Markdown. Used by the Shortlist check and preparation; Fit does not interpret this text."
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
    <div className="profile-wide"><GoalsSection data={data}/></div>
    <div className="profile-col-left">
      <p className="profile-col-heading">Search setup</p>
      <WhatSection data={data}/>
      <CompensationSection data={data}/>
      <GeoSection data={data}/>
      <AvailabilitySection data={data}/>
      <OtherRequirementsSection data={data}/>
    </div>
    <div className="profile-col-right" id="profile-personal">
      <DetailsColumn data={data}/>
    </div>
  </div>
}
