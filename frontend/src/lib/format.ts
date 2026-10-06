/** Date helpers. API dates are calendar dates ("2026-10-06"), parsed as local dates. */

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayIso(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return toIso(d)
}

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const LOCALE_TAG = { en: 'en-US', sq: 'sq-AL' } as const

export function formatDate(iso: string, locale: 'en' | 'sq' = 'en', opts?: Intl.DateTimeFormatOptions): string {
  const date = iso.length > 10 ? new Date(iso) : parseDate(iso)
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], opts ?? { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function daysFromToday(iso: string): number {
  const ms = parseDate(iso).getTime() - parseDate(todayIso()).getTime()
  return Math.round(ms / 86_400_000)
}

/** "Today", "Yesterday", "3 days ago", "Last week" or a date. */
export function relativeDay(iso: string, locale: 'en' | 'sq' = 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE_TAG[locale], { numeric: 'auto' })
  const diff = daysFromToday(iso)
  if (Math.abs(diff) < 7) return capitalise(rtf.format(diff, 'day'))
  if (Math.abs(diff) < 14) return capitalise(rtf.format(Math.sign(diff), 'week'))
  return formatDate(iso, locale)
}

export function dueLabel(iso: string, locale: 'en' | 'sq' = 'en'): string {
  const diff = daysFromToday(iso)
  if (diff < 0) return locale === 'sq' ? `Vonuar ${-diff} ditë` : `${-diff} day${diff === -1 ? '' : 's'} overdue`
  return relativeDay(iso, locale)
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
