import { Band, CheckView, SkillAnswer } from '../api/client.ts'
import { BandTiles, FitScore } from './BandTiles.tsx'
import { Skills, skillsToAnswer } from './Requirements.tsx'

interface Props {
  band: Band
  check?: CheckView | null
  onDecision: (answer: SkillAnswer) => Promise<void>
}

function requirementsLine(band: Band): string {
  if (band.requirementsText) return band.requirementsText
  const open = skillsToAnswer(band)
  if (open === null) return ''
  return open > 0 ? `${open} skill${open === 1 ? '' : 's'} to answer` : 'All skills answered'
}

export function FitBand({ band, check, onDecision }: Props) {
  const never = band.tiles.filter((tile) => tile.bucket === 'never')
  const line = requirementsLine(band)
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
      <section className="fit-band" aria-label="Fit">
        <div className="band-score">
          <span className="band-score-label">Fit</span>
          <FitScore score={band.score} bucket={band.bucket} />
          {band.score === null && <span className="band-score-reason">{band.text}</span>}
          {line && line !== band.text && <span className="band-score-reason band-req">{line}</span>}
        </div>
        <BandTiles tiles={band.tiles}>
          <Skills band={band} check={check} onDecision={onDecision} />
        </BandTiles>
      </section>
    </div>
  )
}
