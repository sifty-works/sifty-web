import { useRef, useState } from 'react'
import { CELLS } from './Logo.tsx'

const CAP = 18                        
const MARK_W = CAP * 97 / 47, GAP = 10
const SIZE = CAP * 1024 / 640        
const ADV = [640, 256, 640, 512, 512] 
const SWEEP = 1.8, PAUSE = 1.4       

export function Brand({ busy }: { busy: string | null }) {
  const [flash, setFlash] = useState(false)
  const sweep = useRef<SVGAnimateTransformElement>(null)
  const play = () => {
    if (busy) return
    setFlash(true)
    requestAnimationFrame(() => sweep.current?.beginElement())
    window.setTimeout(() => setFlash(false), SWEEP * 1000)
  }
  let x = 0
  const letters = 'SIFTY'.split('').map((ch, i) => {
    const at = x
    x += ADV[i] * SIZE / 1024
    return { ch, at }
  })
  const wordW = Math.ceil(x - 128 * SIZE / 1024) + 1
  const W = Math.ceil(MARK_W + GAP + wordW), H = CAP + 1, wx = MARK_W + GAP, end = W + 70
  const dur = SWEEP + PAUSE

  const cells = (white: boolean) => (
    <g transform={`scale(${CAP / 47})`}>
      {CELLS.map(([cx, cy, w, c]) => (
        <rect key={`${cx}-${cy}`} x={cx} y={cy} width={w} height={7} rx={0.6} fill={white ? '#fff' : c} />
      ))}
    </g>
  )
  const word = (
    <g transform={`translate(${wx},0)`}>
      {letters.map((l) => (
        <text key={l.ch} x={0} y={CAP} fontFamily="Tiny5" fontSize={SIZE} fill="#fff" transform={`translate(${l.at},0)`}>
          {l.ch}
        </text>
      ))}
    </g>
  )

  return (
    <div
      className={`brand${busy ? ' working' : ''}`}
      role="img"
      aria-label={busy ? `Sifty, ${busy}` : 'Sifty'}
      title={busy ?? undefined}
      onClick={play}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="brand-word" gradientUnits="userSpaceOnUse" x1={wx} x2={wx + wordW} y1="0" y2="0">
            <stop offset="0" stopColor="#b2b04f" />
            <stop offset=".3" stopColor="#3db328" />
            <stop offset=".55" stopColor="#22aa6e" />
            <stop offset=".78" stopColor="#258f99" />
            <stop offset="1" stopColor="#3a95d0" />
          </linearGradient>
          <linearGradient id="brand-sheen" gradientUnits="userSpaceOnUse" x1="-70" x2="0" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset=".5" stopColor="#fff" stopOpacity=".8" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
            {busy && (
              <animateTransform
                attributeName="gradientTransform"
                type="translate"
                values={`0 0;${end} 0;${end} 0`}
                keyTimes={`0;${(SWEEP / dur).toFixed(3)};1`}
                dur={`${dur}s`}
                repeatCount="indefinite"
              />
            )}
            {flash && !busy && (
              <animateTransform
                ref={sweep}
                attributeName="gradientTransform"
                type="translate"
                values={`0 0;${end} 0`}
                dur={`${SWEEP}s`}
                begin="indefinite"
              />
            )}
          </linearGradient>
          <mask id="brand-letters" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            {word}
          </mask>
          <mask id="brand-all" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            {cells(true)}
            {word}
          </mask>
        </defs>
        {cells(false)}
        <rect x={wx} y="0" width={wordW} height={H} fill="url(#brand-word)" mask="url(#brand-letters)" />
        {(busy || flash) && (
          <rect className="brand-sheen" x="0" y="0" width={W} height={H} fill="url(#brand-sheen)" mask="url(#brand-all)" />
        )}
      </svg>
    </div>
  )
}
