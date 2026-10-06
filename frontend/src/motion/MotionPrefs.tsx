import { MotionConfig, useReducedMotion } from 'motion/react'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type MotionPref = 'system' | 'reduce' | 'full'
const STORAGE_KEY = 'tmp.motion'

interface Prefs {
  pref: MotionPref
  setPref: (p: MotionPref) => void
  /** True when animations should be replaced by static alternatives. */
  reduced: boolean
}

const Ctx = createContext<Prefs>({ pref: 'system', setPref: () => {}, reduced: false })

function initial(): MotionPref {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'reduce' || v === 'full' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

export function MotionPrefsProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<MotionPref>(initial)
  const osReduced = useReducedMotion() ?? false
  const reduced = pref === 'reduce' || (pref === 'system' && osReduced)

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduce' : 'full'
  }, [reduced])

  const value = useMemo<Prefs>(
    () => ({
      pref,
      reduced,
      setPref: (p) => {
        setPrefState(p)
        try {
          localStorage.setItem(STORAGE_KEY, p)
        } catch {
          /* ignore */
        }
      },
    }),
    [pref, reduced],
  )

  return (
    <Ctx.Provider value={value}>
      <MotionConfig reducedMotion={reduced ? 'always' : 'never'} transition={{ ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMotionPrefs = () => useContext(Ctx)
