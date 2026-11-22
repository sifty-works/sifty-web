import { useCallback, useEffect, useState } from 'react'
import { getReference, type ReferenceResp } from '../api/client.ts'
import { silent } from './messages.ts'

export const PROFILE_COLORS = ['#3db328', '#258f99', '#2675a9', '#b2b04f']

export function colorFor(index: number): string {
  return PROFILE_COLORS[index % PROFILE_COLORS.length]
}

export function useReference(): ReferenceResp | null {
  const [ref, setRef] = useState<ReferenceResp | null>(null)
  const load = useCallback(() => {
    void getReference().then(setRef).catch(silent('reference data is optional: forms fall back to raw values'))
  }, [])
  useEffect(() => { load() }, [load])
  return ref
}

export function labelOf(items: { value: string; label: string }[], value: string): string {
  return items.find((i) => i.value === value)?.label ?? value
}

export function countryName(countries: { code: string; name: string }[], code: string): string {
  return countries.find((c) => c.code === code)?.name ?? code
}

export function regionLabel(r: { name: string; aliases: string[]; size: number }): string {
  if (r.size <= 1) return r.name
  const long = r.aliases[0] ?? null
  return long ? `${r.name} — ${long} (${r.size})` : `${r.name} (${r.size})`
}

export function geoLabel(
  loc: { country: string; city?: string },
  countries: { code: string; name: string }[],
  regions: { name: string; aliases: string[]; size: number }[],
): string {
  const r = regions.find((x) => x.name.toUpperCase() === loc.country.toUpperCase())
  const name = r ? regionLabel(r) : (countryName(countries, loc.country) || loc.country)
  return loc.city ? `${loc.city}, ${name}` : name
}
