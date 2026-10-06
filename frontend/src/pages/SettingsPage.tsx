import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Dialog } from '../components/Dialog'
import { useToast } from '../components/Toast'
import { Button, Field, PageHeader, Skeleton } from '../components/ui'
import { LOCALES, useI18n, type Locale } from '../i18n'
import { useMotionPrefs, type MotionPref } from '../motion/MotionPrefs'
import { api, errorMessage } from '../lib/api'
import { keys, useDataMutation, useMe, useModelStatus, usePlants } from '../lib/queries'
import type { User } from '../lib/types'

function Panel({ title, children, tone }: { title: string; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={`card p-5 sm:p-6 ${tone === 'danger' ? 'border-danger/30' : ''}`}>
      <h2 className={`font-serif text-[1.35rem] ${tone === 'danger' ? 'text-danger' : ''}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function pct(v?: number | null) {
  return v === undefined || v === null ? 'n/a' : v.toFixed(2)
}

function ModelPanel() {
  const { data: m, isPending } = useModelStatus()
  if (isPending) return <Skeleton className="h-24" />
  if (!m) return null
  const ev = m.evaluation
  return (
    <div className="space-y-3 text-[0.95rem]">
      <p>
        Status:{' '}
        <strong className={m.available ? 'text-ok' : 'text-warn'}>{m.available ? `loaded (${m.version})` : 'unavailable'}</strong>
        {!m.available && m.unavailable_reason && <span className="text-muted"> · {m.unavailable_reason}</span>}
      </p>
      <p className="text-muted">
        It classifies single leaf photos of tomato, potato and bell pepper into {m.classes.length || 15} labels from the PlantVillage
        dataset. It can say “inconclusive” and refuses photos that look unlike its training data.
      </p>
      {ev.controlled_test && (
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-ivory p-3">
            <dt className="text-sm text-muted">Lab-style test photos (PlantVillage)</dt>
            <dd>
              Macro F1 {pct(ev.controlled_test.macro_f1)} on {ev.controlled_test.images} images
            </dd>
          </div>
          <div className="rounded-lg bg-ivory p-3">
            <dt className="text-sm text-muted">Real-world photos {ev.real_world?.source ? `(${ev.real_world.source})` : ''}</dt>
            <dd>{ev.real_world ? `Macro F1 ${pct(ev.real_world.macro_f1)} on ${ev.real_world.images} images` : 'Not measured yet'}</dd>
          </div>
        </dl>
      )}
      <p className="text-sm text-muted">The large gap between lab and real-world numbers is expected, and is why results are worded cautiously.</p>
    </div>
  )
}

function NameForm({ initial, onSave }: { initial: string; onSave: (name: string) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(initial)
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSave(name.trim())
      }}
    >
      <Field label={t('settings.displayName')} className="flex-1">
        <input className="field" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary">
        {t('common.save')}
      </Button>
    </form>
  )
}

export default function SettingsPage() {
  const { data: me } = useMe()
  const { t, locale, setLocale } = useI18n()
  const { pref, setPref } = useMotionPrefs()
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwError, setPwError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { data: plants } = usePlants({ state: 'all' })
  const hasExamples = plants?.some((p) => p.is_example)

  const saveProfile = async (patch: Partial<Pick<User, 'display_name' | 'locale' | 'motion_preference'>>) => {
    try {
      const user = await api<User>('/api/account', { method: 'PATCH', json: patch })
      qc.setQueryData(keys.me, user)
      toast(t('settings.saved'))
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  const changePassword = useDataMutation(() =>
    api('/api/account/password', { method: 'POST', json: { current_password: pw.current, new_password: pw.next } }),
  )
  const examples = useDataMutation((add: boolean) => api('/api/account/examples', { method: add ? 'POST' : 'DELETE' }))

  const onPassword = (e: FormEvent) => {
    e.preventDefault()
    setPwError(null)
    if (pw.next.length < 10) return setPwError('Use at least 10 characters.')
    changePassword.mutate(undefined, {
      onSuccess: () => {
        setPw({ current: '', next: '' })
        toast('Password changed. Other devices were signed out.')
      },
      onError: (err) => setPwError(errorMessage(err)),
    })
  }
  const deleteAccount = async () => {
    setDeleteError(null)
    try {
      await api('/api/account', { method: 'DELETE', json: { password: deletePw } })
      qc.clear()
      navigate('/welcome', { replace: true })
    } catch (e) {
      setDeleteError(errorMessage(e))
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('settings.title')} />
      <div className="flex flex-col gap-5">
        <Panel title={t('settings.profile')}>
          {me && <NameForm key={me.id} initial={me.display_name} onSave={(display_name) => saveProfile({ display_name })} />}
          <p className="mt-3 text-sm text-muted">
            {t('settings.email')}: {me?.email}
          </p>
        </Panel>

        <Panel title={`${t('settings.language')} & ${t('settings.motion').toLowerCase()}`}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('settings.language')} hint="Albanian is a draft translation; untranslated text appears in English.">
              <select
                className="field"
                value={locale}
                onChange={(e) => {
                  const l = e.target.value as Locale
                  setLocale(l)
                  saveProfile({ locale: l })
                }}
              >
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-[0.92rem] font-medium">{t('settings.motion')}</legend>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    ['system', t('settings.motionSystem')],
                    ['reduce', t('settings.motionReduce')],
                    ['full', t('settings.motionFull')],
                  ] as [MotionPref, string][]
                ).map(([v, label]) => (
                  <label key={v} className="flex min-h-10 cursor-pointer items-center gap-2.5">
                    <input
                      type="radio"
                      name="motion"
                      value={v}
                      checked={pref === v}
                      onChange={() => {
                        setPref(v)
                        saveProfile({ motion_preference: v })
                      }}
                      className="size-4 accent-forest"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>

        <Panel title={t('settings.password')}>
          <form onSubmit={onPassword} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Field label={t('settings.currentPassword')}>
              <input className="field" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label={t('settings.newPassword')} hint="At least 10 characters." error={pwError}>
              <input className="field" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Button type="submit" variant="secondary" busy={changePassword.isPending} className="justify-self-start">
              {t('settings.changePassword')}
            </Button>
          </form>
        </Panel>

        <Panel title={t('settings.data')}>
          <p className="text-muted">{t('settings.exportText')}</p>
          <a href="/api/account/export" download className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-[0.7rem] border border-forest px-4.5 text-forest hover:bg-sage-soft">
            {t('settings.export')}
          </a>
          <hr className="my-5 border-line" />
          <h3 className="font-serif text-[1.15rem]">{t('settings.examples')}</h3>
          <p className="mt-1 text-muted">{t('settings.examplesText')}</p>
          <Button
            variant="secondary"
            className="mt-3"
            busy={examples.isPending}
            onClick={() =>
              examples.mutate(!hasExamples, {
                onSuccess: () => toast(hasExamples ? 'Example garden removed' : 'Example garden added'),
                onError: (e) => toast(errorMessage(e), 'error'),
              })
            }
          >
            {hasExamples ? t('settings.removeExamples') : t('settings.addExamples')}
          </Button>
        </Panel>

        <Panel title={t('settings.model')}>
          <ModelPanel />
        </Panel>

        <Panel title={t('settings.danger')} tone="danger">
          <p className="text-muted">{t('settings.dangerText')}</p>
          <Button variant="danger" className="mt-3" onClick={() => setDeleteOpen(true)}>
            {t('settings.deleteAccount')}
          </Button>
        </Panel>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Delete your account?"
        description="Everything will be removed for good, including photos. Download your data first if you’d like to keep it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deleteAccount} disabled={!deletePw}>
              Delete everything
            </Button>
          </>
        }
      >
        <Field label="Confirm with your password" error={deleteError}>
          <input className="field" type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  )
}
