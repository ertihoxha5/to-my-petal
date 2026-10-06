import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en, { type Dictionary } from './en'
import sq from './sq'

export type Locale = 'en' | 'sq'
export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'sq', label: 'Shqip (draft)' },
]

type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>
}[keyof T & string]
export type TKey = Path<Dictionary>

const dictionaries = { en, sq } as const

function lookup(dict: unknown, key: string): string | undefined {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict) as
    | string
    | undefined
}

interface I18n {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TKey, vars?: Record<string, string | number>) => string
}

const Ctx = createContext<I18n | null>(null)
const STORAGE_KEY = 'tmp.locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'sq') return saved
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith('sq') ? 'sq' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo<I18n>(() => {
    const setLocale = (l: Locale) => {
      setLocaleState(l)
      try {
        localStorage.setItem(STORAGE_KEY, l)
      } catch {
        /* ignore */
      }
    }
    const t = (key: TKey, vars?: Record<string, string | number>) => {
      const raw = lookup(dictionaries[locale], key) ?? lookup(en, key) ?? key
      return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : raw
    }
    return { locale, setLocale, t }
  }, [locale])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}


export function useI18n(): I18n {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
