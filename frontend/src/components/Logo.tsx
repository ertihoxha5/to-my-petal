import { motion } from 'motion/react'
import { useState } from 'react'
import { useMotionPrefs } from '../motion/MotionPrefs'

const KEY = 'tmp.bloomed'

/** Bloom once per browser session; afterwards (and with reduced motion) render static. */
function useFirstBloom(): boolean {
  const { reduced } = useMotionPrefs()
  const [animate] = useState(() => {
    if (reduced) return false
    try {
      if (sessionStorage.getItem(KEY)) return false
      sessionStorage.setItem(KEY, '1')
      return true
    } catch {
      return false
    }
  })
  return animate
}

/** The to my petal symbol. Source artwork: src/assets/brand/symbol.svg. */
export function LogoSymbol({ size = 40, bloom = false }: { size?: number; bloom?: boolean }) {
  const ease = [0.22, 1, 0.36, 1] as const
  const grow = (delay: number) =>
    bloom
      ? { initial: { scale: 0, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { delay, duration: 0.7, ease } }
      : {}
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" style={{ overflow: 'visible' }}>
      <g fill="none" stroke="#173D29" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28.5 33.5H12.5a3 3 0 0 0-3 3V57a3 3 0 0 0 3 3h39a3 3 0 0 0 3-3V36.5a3 3 0 0 0-3-3H37.5" />
        <path d="M11 35.5 30.2 48.6a3.2 3.2 0 0 0 3.6 0L53 35.5" />
      </g>
      <motion.path
        d="M32 48.2C31.2 40 30.9 31.5 32.6 22.5 33.3 19 34 16.8 34.6 15"
        fill="none"
        stroke="#173D29"
        strokeWidth="2"
        strokeLinecap="round"
        {...(bloom
          ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.9, ease } }
          : {})}
      />
      <motion.g style={{ transformOrigin: '31.6px 31.5px', transformBox: 'view-box' }} {...grow(0.55)}>
        <path d="M31.6 31.5C26.4 31.8 18.6 29.4 15.2 21.2 22.4 19.9 29.4 23.6 31.6 31.5Z" fill="#5E7D4E" />
        <path d="M31.2 30.8C26.8 27.4 22.4 24.9 17.6 22.6" fill="none" stroke="#3C5A33" strokeWidth=".8" strokeLinecap="round" />
      </motion.g>
      <motion.g style={{ transformOrigin: '32.2px 40.5px', transformBox: 'view-box' }} {...grow(0.4)}>
        <path d="M32.2 40.5C34 33.2 40.8 28.5 49.6 28.8 46.6 36.8 39.6 40.6 32.2 40.5Z" fill="#24503A" />
        <path d="M33 39.6C37.6 36.2 42.6 33.2 47.6 30" fill="none" stroke="#5E7D4E" strokeWidth=".8" strokeLinecap="round" />
      </motion.g>
      <motion.g style={{ transformOrigin: '34.6px 16.4px', transformBox: 'view-box' }} {...grow(0.85)}>
        <path d="M34.6 16.4C29.4 14.6 28.6 7.6 33.6 2.6 39.6 6 40.6 13.6 34.6 16.4Z" fill="#E2A99D" />
        <path d="M34.6 16.4C32.4 12.6 32.4 7.4 33.6 2.6 39.6 6 40.6 13.6 34.6 16.4Z" fill="#C47C6E" />
        <path d="M34.2 15.2C31.4 13.4 30.8 9.4 32.6 5.8" fill="none" stroke="#F4D3CB" strokeWidth="1" strokeLinecap="round" />
      </motion.g>
    </svg>
  )
}

export function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  const bloom = useFirstBloom()
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoSymbol size={size} bloom={bloom} />
      <span className="font-serif text-[1.55rem] leading-none tracking-[-0.01em] text-forest" style={{ fontWeight: 460 }}>
        to my petal
      </span>
    </span>
  )
}
