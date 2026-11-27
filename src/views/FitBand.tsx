import { Band } from '../api/client.ts'
import { BandTiles, FitScore } from './BandTiles.tsx'

interface Props {
  band: Band
}

export function FitBand({ band }: Props) {
  const never = band.tiles.filter((tile) => tile.bucket === 'never')
  return (
    <div className="band-wrap">
      {never.length > 0 && (
        <div className="band-never" role="alert">
          <strong>Never</strong>
          <ul>
            {never.map((tile) => (
              <li key={tile.name}>{tile.name}: {tile.line}</li>
            ))}
          </ul>
        </div>
      )}
      <section className="fits-you-band" aria-label="Fits you">
        <div className="band-score">
          <span className="band-score-label">Fits you</span>
          <FitScore score={band.score} bucket={band.bucket} />
          {band.score === null && <span className="band-score-reason">{band.text}</span>}
        </div>
        <BandTiles tiles={band.tiles} />
      </section>
    </div>
  )
}
