/** Decorative botanical line art (original). Purely presentational: aria-hidden. */

const LEAF = 'M0 0C9-7 27-8 40 0 27 8 9 7 0 0Z'
const LEAF_VEIN = 'M2 0H37'

interface LeafSpec {
  x: number
  y: number
  r: number
  s: number
  tone: 0 | 1 | 2
}

const TONES = ['#7E9871', '#A5B39A', '#5E7D4E']

function Leaf({ x, y, r, s, tone }: LeafSpec) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d={LEAF} fill={TONES[tone]} fillOpacity={tone === 1 ? 0.75 : 0.62} />
      <path d={LEAF_VEIN} stroke="#3F5A35" strokeOpacity=".45" strokeWidth=".7" fill="none" />
    </g>
  )
}

function Flower({ x, y, s = 1, open = true }: { x: number; y: number; s?: number; open?: boolean }) {
  if (!open) {
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M0 0C-5-3-5-11 0-16 5-11 5-3 0 0Z" fill="#E7B3A8" />
        <path d="M0 0C-2-4-2-11 0-16 5-11 5-3 0 0Z" fill="#D9998C" fillOpacity=".8" />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path
          key={a}
          transform={`rotate(${a})`}
          d="M0 0C-6-4-7-14 0-19 7-14 6-4 0 0Z"
          fill="#EBC0B6"
          stroke="#D49A8E"
          strokeWidth=".6"
          fillOpacity=".92"
        />
      ))}
      <circle r="3.2" fill="#C98275" />
      <circle r="1.3" fill="#8F5A3C" />
    </g>
  )
}

/** A flowering branch for the introduction, after the reference composition. */
export function BotanicalBranch({ className = '' }: { className?: string }) {
  const leaves: LeafSpec[] = [
    { x: 236, y: 168, r: -150, s: 1.25, tone: 2 },
    { x: 214, y: 140, r: -40, s: 1.1, tone: 0 },
    { x: 190, y: 122, r: -165, s: 1.35, tone: 1 },
    { x: 166, y: 100, r: -30, s: 1.2, tone: 2 },
    { x: 140, y: 86, r: -175, s: 1.05, tone: 0 },
    { x: 118, y: 70, r: -55, s: 1.1, tone: 1 },
    { x: 96, y: 60, r: -190, s: 0.95, tone: 2 },
    { x: 74, y: 46, r: -70, s: 0.8, tone: 0 },
    { x: 200, y: 82, r: -95, s: 0.9, tone: 1 },
    { x: 214, y: 60, r: -60, s: 0.7, tone: 0 },
  ]
  return (
    <svg viewBox="0 0 300 200" className={className} aria-hidden="true" focusable="false">
      <path
        d="M290 198C262 176 236 156 206 132S140 88 104 64 60 36 44 30"
        fill="none"
        stroke="#6E8A60"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M190 122C196 104 200 86 212 56" fill="none" stroke="#6E8A60" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M150 92C140 112 132 128 120 140" fill="none" stroke="#6E8A60" strokeWidth="1" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <Leaf key={i} {...l} />
      ))}
      <Flower x={120} y={142} s={1.05} />
      <Flower x={212} y={52} s={0.8} open={false} />
      <Flower x={44} y={30} s={0.7} open={false} />
    </svg>
  )
}

/** A slender sprig for page edges and section accents. */
export function Sprig({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 60 220"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M30 218C28 160 32 100 30 6" fill="none" stroke="#9AAB8E" strokeWidth="1.2" strokeLinecap="round" />
      {[30, 54, 78, 102, 126, 150, 174].map((y, i) => (
        <g key={y}>
          <path
            transform={`translate(30 ${y}) rotate(${i % 2 ? -60 : -120}) scale(${0.62 - i * 0.02})`}
            d={LEAF}
            fill="#A5B39A"
            fillOpacity=".55"
          />
          <path
            transform={`translate(30 ${y + 10}) rotate(${i % 2 ? -120 : -60}) scale(${0.58 - i * 0.02})`}
            d={LEAF}
            fill="#A5B39A"
            fillOpacity=".45"
          />
        </g>
      ))}
    </svg>
  )
}

/** Small herb illustration used as an icon in the care strip. */
export function HerbMark({ size = 44 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="none" stroke="#173D29" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 44V12" />
        <path d="M24 20c-5 0-9-3-10-8 5 0 9 3 10 8Zm0 0c5 0 9-3 10-8-5 0-9 3-10 8Z" />
        <path d="M24 30c-6 0-10-3-12-8 6 0 10 3 12 8Zm0 0c6 0 10-3 12-8-6 0-10 3-12 8Z" />
        <path d="M24 12c-1.5-2.5-1.5-5 0-8 1.5 3 1.5 5.5 0 8Z" />
      </g>
    </svg>
  )
}
