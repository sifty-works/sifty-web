import { Band } from '../api/client.ts'
import { BandTiles, FitScore } from './BandTiles.tsx'

interface Props {
  band: Band
}

export function FitBand({ band }: Props) {
  return (
    <section className="fits-you-band" aria-label="Fits you">
      <div className="band-score">
        <span className="band-score-label">Fits you</span>
        <FitScore score={band.score} bucket={band.bucket} />
        {band.score === null && <span className="band-score-reason">{band.text}</span>}
        {band.requirementsText && <span className="band-req">{band.requirementsText}</span>}
      </div>
      <BandTiles tiles={band.tiles} />
    </section>
  )
}
