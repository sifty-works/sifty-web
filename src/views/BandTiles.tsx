import { ReactNode } from 'react'
import { Tile } from '../api/client.ts'

type Mod = 'ok' | 'mismatch' | 'unknown'

const MARKS: Record<Mod, string> = { ok: '✓', mismatch: '✕', unknown: '?' }

function verdictMod(verdict: string): Mod {
  if (verdict === '✓') return 'ok'
  if (verdict === '✕') return 'mismatch'
  return 'unknown'
}

function isStated(tile: Tile): boolean {
  return tile.value.trim() !== '' && tile.value !== 'Not stated'
}

function Mark({ mod }: { mod: Mod }) {
  return (
    <span className={`band-mark ${mod}`} aria-hidden="true">
      {MARKS[mod]}
    </span>
  )
}

function Card({ tile }: { tile: Tile }) {
  const stated = isStated(tile)
  const mod = stated ? verdictMod(tile.verdict) : 'unknown'
  return (
    <div className={`band-card ${mod}`} aria-label={`${tile.name}: ${stated ? tile.value : 'Not stated'}`}>
      <div className="band-card-head">
        <span className="band-card-name">
          <TileIcon name={tile.name} size={22} />
          {tile.name}
        </span>
        <Mark mod={mod} />
      </div>
      <span className={stated ? 'band-card-value' : 'band-card-value blank'} title={tile.full}>
        {stated ? tile.value : 'Not stated'}
      </span>
      {tile.converted && <span className="band-card-approx">{tile.converted}</span>}
      <span className="band-card-hint">{tile.line || (stated ? '' : 'Not stated in the vacancy')}</span>
    </div>
  )
}

export function BandTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="band-body">
      <div className="band-grid">
        {tiles.map((tile) => (
          <Card key={tile.name} tile={tile} />
        ))}
      </div>
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
}

function TileIcon({ name, size }: { name: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
