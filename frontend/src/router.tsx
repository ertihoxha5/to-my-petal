import { useEffect, type ComponentType, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { LogoSymbol } from './components/Logo'
import { ErrorState } from './components/ui'
import { useI18n } from './i18n'
import { errorMessage } from './lib/api'
import { useMe } from './lib/queries'
import { useMotionPrefs } from './motion/MotionPrefs'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <LogoSymbol size={56} />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isPending, error, refetch } = useMe()
  const location = useLocation()
  const { setLocale } = useI18n()
  const { setPref } = useMotionPrefs()

  useEffect(() => {
    if (!me) return
    setLocale(me.locale)
    setPref(me.motion_preference)
    // Only on sign-in / user change, so local changes in Settings aren't fought.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  if (isPending) return <Splash />
  if (error)
    return (
      <div className="mx-auto max-w-md p-8">
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      </div>
    )
  if (!me) return <Navigate to={`/welcome?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <>{children}</>
}

/** Secondary pages load on demand to keep the first load small. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const router = createBrowserRouter([
  { path: '/welcome', element: <AuthPage /> },
  {
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'plants', lazy: page(() => import('./pages/PlantsPage')) },
      { path: 'analyze', lazy: page(() => import('./pages/AnalyzePage')) },
      { path: 'analyses', lazy: page(() => import('./pages/AnalysesPage')) },
      { path: 'analyses/:id', lazy: page(() => import('./pages/AnalysisPage')) },
      { path: 'journal', lazy: page(() => import('./pages/JournalPage')) },
      { path: 'care-guide', lazy: page(() => import('./pages/GuidePage')) },
      { path: 'care-guide/:slug', lazy: page(() => import('./pages/GuideArticlePage')) },
      { path: 'reminders', lazy: page(() => import('./pages/RemindersPage')) },
      { path: 'settings', lazy: page(() => import('./pages/SettingsPage')) },
      { path: '*', lazy: page(() => import('./pages/NotFoundPage')) },
    ],
  },
])
