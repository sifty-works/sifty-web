import { Band } from '../api/client.ts'

function verdictMod(verdict: string): string {
  if (verdict === '✓') return 'ok'
  if (verdict === '✕') return 'mismatch'
  return ''
}

function bucketToken(bucket: string): string {
  return bucket.toLowerCase().replace(/\s+/g, '-')
}

interface Props {
  band: Band
}

export function FitBand({ band }: Props) {
  const hasScore = band.score !== null
  return (
    <section className="fits-you-band" aria-label="Fits you">
      <div className="band-score">
        <span className="band-score-label">Fits you</span>
        <div className="band-score-number">
          <span>{hasScore ? band.score : '–'}</span>
          <small>/100</small>
        </div>
        {hasScore ? (
          band.bucket && band.bucket !== 'Not scored' && (
            <span className={`qm-bucket ${bucketToken(band.bucket)}`}>{band.bucket}</span>
          )
        ) : (
          <span className="band-score-reason">{band.text}</span>
        )}
      </div>
      <div className="band-tiles">
        {band.tiles.map((tile) => {
          const mod = verdictMod(tile.verdict)
          const cls = mod ? `band-tile ${mod}` : 'band-tile'
          return (
            <div key={tile.name} className={cls} aria-label={tile.name}>
              <div className="band-tile-head">
                <TileIcon name={tile.name} />
                {tile.verdict !== '' && (
                  <span
                    className="band-tile-vc"
                    aria-label={mod === 'ok' ? 'matches' : mod === 'mismatch' ? 'does not match' : 'unknown'}
                  >
                    {tile.verdict}
                  </span>
                )}
              </div>
              <span className="band-tile-value">{tile.value || 'Not stated'}</span>
              {tile.line && <span className="band-tile-hint">{tile.line}</span>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

interface TileIconProps {
  name: string
}

function TileIcon({ name }: TileIconProps) {
  const props = {
    width: 28,
    height: 28,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (name) {
    case 'Money':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M14.8 9.2c-.5-.8-1.5-1.3-2.7-1.3-1.5 0-2.7.8-2.7 2s1.1 1.7 2.7 2 2.7.8 2.7 2-1.2 2-2.7 2c-1.2 0-2.2-.5-2.7-1.3M12 6.3v1.6M12 16.1v1.6" />
        </svg>
      )
    case 'Location':
      return (
        <svg {...props}>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
      )
    case 'Work mode':
      return (
        <svg {...props}>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6 10v9h12v-9" />
          <path d="M10 19v-5h4v5" />
        </svg>
      )
    case 'Contract':
      return (
        <svg {...props}>
          <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
          <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M3.5 12.5h17" />
        </svg>
      )
    default:
      return null
  }
}
