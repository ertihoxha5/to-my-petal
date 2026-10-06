import { useEffect, type ReactNode } from 'react'
import { createBrowserRouter, Navigate, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { LogoSymbol } from './components/Logo'
import { ErrorState } from './components/ui'
import { useI18n } from './i18n'
import { errorMessage } from './lib/api'
import { useMe } from './lib/queries'
import { useMotionPrefs } from './motion/MotionPrefs'
import AnalysesPage from './pages/AnalysesPage'
import AnalysisPage from './pages/AnalysisPage'
import AnalyzePage from './pages/AnalyzePage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import GuideArticlePage from './pages/GuideArticlePage'
import GuidePage from './pages/GuidePage'
import JournalPage from './pages/JournalPage'
import NotFoundPage from './pages/NotFoundPage'
import PlantsPage from './pages/PlantsPage'
import RemindersPage from './pages/RemindersPage'
import SettingsPage from './pages/SettingsPage'

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
      { path: 'plants', element: <PlantsPage /> },
      { path: 'analyze', element: <AnalyzePage /> },
      { path: 'analyses', element: <AnalysesPage /> },
      { path: 'analyses/:id', element: <AnalysisPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'care-guide', element: <GuidePage /> },
      { path: 'care-guide/:slug', element: <GuideArticlePage /> },
      { path: 'reminders', element: <RemindersPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
