import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useI18n } from '../i18n'
import { isDemo, startDemo } from '../demo/server'
import { api } from '../lib/api'
import { useMe } from '../lib/queries'
import { Sprig } from './Botanical'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'

function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
  )
}

function UserMenu() {
  const { data: me } = useMe()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const signOut = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    qc.clear()
    navigate('/')
  }
  const initials = (me?.display_name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('nav.account')}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 items-center gap-1.5 rounded-full py-1 pr-2 pl-1 text-forest hover:bg-sage-soft"
      >
        <span className="grid size-9 place-items-center rounded-full bg-blush-soft font-serif text-[0.95rem] text-blush-ink ring-1 ring-blush/50">
          {initials}
        </span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card absolute right-0 z-40 mt-2 w-60 p-1.5"
        >
          <div className="px-3 py-2.5">
            <p className="font-medium">{me?.display_name}</p>
            <p className="truncate text-sm text-muted">{me?.email}</p>
          </div>
          <hr className="my-1 border-line" />
          {(
            [
              ['/reminders', 'bell', t('nav.reminders')],
              ['/analyses', 'scan', 'Analyses'],
              ['/settings', 'settings', t('nav.settings')],
            ] as [string, IconName, string][]
          ).map(([to, icon, label]) => (
            <Link key={to} role="menuitem" to={to} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 hover:bg-sage-soft">
              <Icon name={icon} size={18} /> {label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-sage-soft"
          >
            <Icon name="arrowRight" size={18} /> {t('nav.signOut')}
          </button>
        </motion.div>
      )}
    </div>
  )
}

/** Shown while exploring the in-browser demo, with a way to reset or leave. */
function DemoBanner() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  if (!isDemo()) return null
  const reset = () => {
    startDemo()
    qc.clear()
    navigate('/')
  }
  const leave = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    qc.clear()
    navigate('/')
  }
  return (
    <motion.div
      role="status"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="overflow-hidden border-b border-[#eadc9c] bg-[#fff6cf] text-[0.92rem] text-ink"
    >
      <div className="mx-auto flex max-w-[76rem] flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
        <span className="font-hand text-[1.25rem] leading-none text-forest">You're exploring the demo garden.</span>
        <span className="text-muted">Changes stay in this browser. Analyses are samples.</span>
        <span className="flex gap-3">
          <button type="button" onClick={reset} className="font-medium text-forest underline underline-offset-4">
            Start over
          </button>
          <button type="button" onClick={leave} className="font-medium text-forest underline underline-offset-4">
            Leave demo
          </button>
        </span>
      </div>
    </motion.div>
  )
}

function DesktopNav() {
  const { t } = useI18n()
  const location = useLocation()
  const items: [string, string, boolean][] = [
    ['/', t('nav.garden'), location.pathname === '/' || location.pathname.startsWith('/plants')],
    ['/journal', t('nav.journal'), location.pathname.startsWith('/journal')],
    ['/care-guide', t('nav.guide'), location.pathname.startsWith('/care-guide')],
  ]
  return (
    <nav aria-label={t('nav.main')} className="hidden md:block">
      <ul className="flex items-center gap-9">
        {items.map(([to, label, active]) => (
          <li key={to}>
            <NavLink
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`relative inline-flex min-h-11 items-center text-[0.95rem] transition-colors ${
                active ? 'text-ink' : 'text-muted hover:text-forest'
              }`}
            >
              {label}
              {active && (
                <motion.span layoutId="nav-underline" className="absolute inset-x-0 bottom-2 h-[1.5px] rounded bg-forest" />
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function BottomNav() {
  const { t } = useI18n()
  const location = useLocation()
  const items: [string, IconName, string, boolean][] = [
    ['/', 'home', t('nav.home'), location.pathname === '/'],
    ['/journal', 'journal', t('nav.journalShort'), location.pathname.startsWith('/journal')],
    ['/analyze', 'plus', t('nav.add'), location.pathname.startsWith('/analyze')],
    ['/care-guide', 'leaf', t('nav.care'), location.pathname.startsWith('/care-guide')],
    ['/plants', 'sprout', t('nav.plants'), location.pathname.startsWith('/plants')],
  ]
  return (
    <nav
      aria-label={t('nav.main')}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur-sm md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
        {items.map(([to, icon, label, active]) =>
          to === '/analyze' ? (
            <li key={to} className="flex justify-center">
              <Link
                to={to}
                aria-label="Add a photo"
                aria-current={active ? 'page' : undefined}
                className="-mt-6 grid size-14 place-items-center rounded-full bg-forest text-card shadow-[var(--shadow-lift)] ring-4 ring-ivory"
              >
                <Icon name="plus" size={26} strokeWidth={1.8} />
              </Link>
            </li>
          ) : (
            <li key={to}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[0.72rem] ${
                  active ? 'font-semibold text-forest' : 'text-muted'
                }`}
              >
                <Icon name={icon} size={22} strokeWidth={active ? 1.9 : 1.5} />
                {label}
              </Link>
            </li>
          ),
        )}
      </ul>
    </nav>
  )
}

export function Layout() {
  const { t } = useI18n()
  const online = useOnline()
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <div className="relative min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-forest px-4 py-2 text-card focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('nav.skip')}
      </a>
      <Sprig className="pointer-events-none fixed top-[38vh] -left-3 hidden h-64 w-16 opacity-60 xl:block" />
      <Sprig flip className="pointer-events-none fixed top-[62vh] -right-3 hidden h-56 w-14 opacity-50 xl:block" />

      <header className="relative z-20 border-b border-line/80 bg-ivory/90 backdrop-blur-sm">
        <div className="mx-auto flex h-[4.5rem] max-w-[76rem] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="rounded-lg" aria-label="to my petal, home">
            <Logo size={38} />
          </Link>
          <DesktopNav />
          <UserMenu />
        </div>
      </header>

      <DemoBanner />
      {!online && (
        <div role="status" className="bg-warn-bg px-4 py-2 text-center text-sm text-warn">
          {t('common.offline')}
        </div>
      )}

      <main id="main" tabIndex={-1} className="pb-nav mx-auto max-w-[76rem] px-4 pt-6 outline-none sm:px-6 md:pt-10 lg:px-8">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
