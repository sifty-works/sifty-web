import { ReactNode } from 'react'
import { Tile } from '../api/client.ts'

type Mod = 'ok' | 'mismatch' | 'unknown' | 'none'

const MARKS: Record<Mod, string> = { ok: '✓', mismatch: '✕', unknown: '?', none: '✓' }

function verdictMod(verdict: string): Mod {
  if (verdict === '✓') return 'ok'
  if (verdict === '✕') return 'mismatch'
  if (verdict === '–') return 'none'
  return 'unknown'
}

function isStated(tile: Tile): boolean {
  return tile.value.trim() !== '' && tile.value !== 'Not stated'
}

const KEY = ['Money', 'Location', 'Work mode', 'Contract']
const FACTS = ['Experience', 'Seniority', 'Company stage', 'Domain', 'Apply by', 'Contract length', 'Citizenship or clearance', 'Relocation', 'Visa']
const ORDER: Mod[] = ['mismatch', 'unknown', 'ok', 'none']

function toneOf(tile: Tile, mod: Mod): string {
  return tile.bucket === 'never' || tile.bucket === 'unwanted' ? tile.bucket : mod
}

function Mark({ mod, tone }: { mod: Mod; tone: string }) {
  return (
    <span className={`band-mark ${tone}`} aria-hidden="true">
      {MARKS[mod]}
    </span>
  )
}

function Card({ tile }: { tile: Tile }) {
  const stated = isStated(tile)
  const mod = stated ? verdictMod(tile.verdict) : 'unknown'
  const tone = stated ? toneOf(tile, mod) : mod
  return (
    <div className={`band-card ${tone}`} aria-label={`${tile.name}: ${stated ? tile.value : 'Not stated'}`}>
      <div className="band-card-head">
        <span className="band-card-name">
          <TileIcon name={tile.name} size={22} />
          {tile.name}
        </span>
        <Mark mod={mod} tone={tone} />
      </div>
      <span className={stated ? 'band-card-value' : 'band-card-value blank'} title={tile.full}>
        {stated ? tile.value : 'Not stated'}
      </span>
      {tile.converted && <span className="band-card-approx">{tile.converted}</span>}
      <span className="band-card-hint">{tile.line || (stated ? '' : 'Not stated in the vacancy')}</span>
    </div>
  )
}

function Others({ tiles }: { tiles: Tile[] }) {
  const rows = [
    ...tiles
      .filter((tile) => !FACTS.includes(tile.name))
      .sort((a, b) => ORDER.indexOf(verdictMod(a.verdict)) - ORDER.indexOf(verdictMod(b.verdict))),
    ...tiles.filter((tile) => FACTS.includes(tile.name)),
  ]
  if (rows.length === 0) return null
  return (
    <div className="band-others">
      <h4>Key facts</h4>
      <ul className="band-sheet">
        {rows.map((tile) => {
          const mod = isStated(tile) ? verdictMod(tile.verdict) : 'unknown'
          return (
            <li key={tile.name} className={`band-sheet-row ${toneOf(tile, mod)}`} title={tile.line}>
              <span className="band-line-name">
                <TileIcon name={tile.name} size={15} />
                {tile.name}
              </span>
              <Mark mod={mod} tone={toneOf(tile, mod)} />
              <span className="band-sheet-value" title={tile.full}>
                {isStated(tile) ? tile.value : 'Not stated'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function BandTiles({ tiles, children }: { tiles: Tile[]; children?: ReactNode }) {
  return (
    <div className="band-body">
      <div className="band-grid">
        {tiles
          .filter((tile) => KEY.includes(tile.name))
          .map((tile) => (
            <Card key={tile.name} tile={tile} />
          ))}
      </div>
      <Others tiles={tiles.filter((tile) => !KEY.includes(tile.name))} />
      {children}
    </div>
  )
}

export function FitScore({ score, bucket }: { score: number | null; bucket: string }) {
  const token = score === null || bucket === 'Not scored' ? 'none' : bucket.toLowerCase().replace(/\s+/g, '-')
  return (
    <span className={`band-fit ${token}`} aria-label={score === null ? 'Not scored' : `${score} of 100, ${bucket}`} title={bucket}>
      {score ?? '–'}
    </span>
  )
}

const ICONS: Record<string, ReactNode> = {
  Money: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M14.8 9.2c-.5-.8-1.5-1.3-2.7-1.3-1.5 0-2.7.8-2.7 2s1.1 1.7 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.2-.5-2.7-1.3M12 6.3v1.6M12 16.1v1.6" />
    </>
  ),
  Location: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  'Work mode': (
    <>
      <path d="M4 11.5 12 5l8 6.5" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </>
  ),
  Contract: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
    </>
  ),
  Hours: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  Languages: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  'Time zone': (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  Experience: (
    <>
      <path d="M5 19V9M12 19V5M19 19v-7" />
      <path d="M3.5 19h17" />
    </>
  ),
  Seniority: (
    <>
      <path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
    </>
  ),
  'Company stage': (
    <>
      <path d="M4 20V10l5 3V9l5 3V6l6 3v11z" />
      <path d="M4 20h16" />
    </>
  ),
  Domain: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  'Apply by': (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  'Contract length': (
    <>
      <path d="M7 4h10M7 20h10M8 4c0 4 4 4 4 8s-4 4-4 8M16 4c0 4-4 4-4 8s4 4 4 8" />
    </>
  ),
  'Citizenship or clearance': (
    <>
      <path d="M12 3.5l7 2.8v5.4c0 4.2-2.8 7.4-7 8.8-4.2-1.4-7-4.6-7-8.8V6.3z" />
      <path d="M9 12l2.2 2.2L15.2 10" />
    </>
  ),
  Relocation: (
    <>
      <path d="M3.5 9l8.5-5 8.5 5" />
      <path d="M12 21v-8M8.5 16.5 12 13l3.5 3.5" />
    </>
  ),
  Visa: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <circle cx="12" cy="10.5" r="3" />
      <path d="M9 17h6" />
    </>
  ),
  'Work authorization': (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="11" r="2.2" />
      <path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h3.5M14.5 13.5h3.5" />
    </>
  ),
}

function TileIcon({ name, size }: { name: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
