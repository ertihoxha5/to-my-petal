import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import basil from '../assets/photos/auth-basil.jpg'
import { BotanicalBranch } from '../components/Botanical'
import { Logo } from '../components/Logo'
import { Button, Field } from '../components/ui'
import { useI18n } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { keys, useMe } from '../lib/queries'
import type { User } from '../lib/types'

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: me } = useMe()
  const { t } = useI18n()
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/'

  if (me) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const user =
        mode === 'signin'
          ? await api<User>('/api/auth/login', { method: 'POST', json: { email, password } })
          : await api<User>('/api/auth/register', { method: 'POST', json: { email, password, display_name: name } })
      qc.setQueryData(keys.me, user)
      navigate(next, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={basil} alt="Sunlit basil leaves" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(12_28_18/0.82)] via-[rgb(12_28_18/0.25)] to-transparent" />
        <div className="on-dark absolute right-10 bottom-12 left-10 text-card">
          <p className="font-serif text-[2.6rem] leading-tight">Care begins with understanding.</p>
          <p className="mt-3 max-w-md text-card/85">
            Keep a visual journal for every plant, and get careful, honest suggestions about leaf photos.
          </p>
        </div>
      </div>

      <div className="relative flex flex-col justify-center px-5 py-10 sm:px-12">
        <BotanicalBranch className="pointer-events-none absolute -top-2 right-0 w-56 opacity-80 sm:w-72" />
        <div className="relative mx-auto w-full max-w-md">
          <Logo size={46} />
          <p className="mt-2 text-muted">{t('brand.tagline')}</p>

          <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
            <h1 className="title-lg">{mode === 'signin' ? 'Welcome back' : 'Start your plant journal'}</h1>
            <p className="mt-2 text-muted">
              {mode === 'signin'
                ? 'Sign in to see how your plants are doing.'
                : 'Create an account to keep photos, notes and reminders for your plants.'}
            </p>

            <form onSubmit={submit} className="mt-7 flex flex-col gap-4" noValidate>
              {mode === 'register' && (
                <Field label="Your name">
                  <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                </Field>
              )}
              <Field label="Email">
                <input
                  className="field"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </Field>
              <Field label="Password" hint={mode === 'register' ? 'At least 10 characters.' : undefined}>
                <input
                  className="field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  minLength={mode === 'register' ? 10 : undefined}
                  required
                />
              </Field>
              {error && (
                <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" busy={busy} className="mt-2 w-full">
                {mode === 'signin' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          </motion.div>

          <p className="mt-6 text-center text-[0.95rem] text-muted">
            {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="font-medium text-forest underline underline-offset-4"
              onClick={() => {
                setMode(mode === 'signin' ? 'register' : 'signin')
                setError(null)
              }}
            >
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
