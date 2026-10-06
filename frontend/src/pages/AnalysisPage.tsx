import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmDialog } from '../components/Dialog'
import { CONTEXT_LABELS, OutcomeBadge, PlantPhoto, STRENGTH_LABEL } from '../components/domain'
import { Icon, type IconName } from '../components/Icon'
import { useToast } from '../components/Toast'
import { Button, ButtonLink, ErrorState, Field, Skeleton } from '../components/ui'
import { useI18n } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { useAnalysis, useDataMutation, useModelStatus } from '../lib/queries'
import type { Analysis, Hypothesis, ModelStatus } from '../lib/types'

function Section({ icon, kicker, title, children }: { icon: IconName; kicker: string; title: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <p className="eyebrow flex items-center gap-2 text-muted">
        <Icon name={icon} size={16} /> {kicker}
      </p>
      <h2 className="mt-2 font-serif text-[1.35rem]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function HypothesisCard({ h, primary }: { h: Hypothesis; primary?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${primary ? 'border-forest/40 bg-sage-soft/50' : 'border-line bg-ivory'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-serif text-[1.2rem]">{h.condition}</p>
        <span className="text-sm text-muted">{STRENGTH_LABEL[h.strength]}</span>
      </div>
      <p className="mt-1 text-[0.95rem] text-ink/85">Often looks like {h.summary}.</p>
      <Link to={`/care-guide/${h.guide_slug}`} className="mt-2 inline-flex items-center gap-1 text-sm text-forest underline-offset-4 hover:underline">
        Read about {h.healthy ? 'caring for this plant' : h.condition.toLowerCase()} <Icon name="arrowRight" size={14} />
      </Link>
    </div>
  )
}

function ModelDetails({ analysis, status }: { analysis: Analysis; status?: ModelStatus }) {
  const r = analysis.result
  const hyps = [r.primary, ...r.alternatives].filter(Boolean) as Hypothesis[]
  const ev = status?.evaluation
  return (
    <details className="mt-4 rounded-xl border border-line bg-ivory p-4 text-sm">
      <summary className="cursor-pointer font-medium text-forest">How to read this result</summary>
      <div className="mt-3 space-y-3 text-ink/85">
        {hyps.length > 0 && (
          <>
            <p>
              Scores below are the model’s calibrated match scores across the conditions it knows. They were calibrated on lab-style
              photos, so they are <strong>not</strong> the chance that a diagnosis is right for your plant.
            </p>
            <ul className="space-y-1">
              {hyps.map((h) => (
                <li key={h.label} className="flex justify-between gap-4 border-b border-line/70 py-1">
                  <span>{h.condition}</span>
                  <span className="tabular-nums text-muted">{h.calibrated_score.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p>
          The model only classifies the whole photo. It does not locate spots on the leaf, so no overlay is shown.
        </p>
        {r.model.version && <p className="text-muted">Model version: {r.model.version}</p>}
        {ev?.controlled_test && (
          <p>
            On held-out lab photos (PlantVillage test split, {ev.controlled_test.images} images), macro F1 was{' '}
            {ev.controlled_test.macro_f1?.toFixed(2)}.{' '}
            {ev.real_world
              ? `On ${ev.real_world.images} independently collected real-world photos (${ev.real_world.source || 'PlantDoc'}), macro F1 was ${ev.real_world.macro_f1?.toFixed(2)}, which is why we stay cautious.`
              : 'Real-world performance has not been measured for this model, which is why we stay cautious.'}
          </p>
        )}
        {r.quality && (
          <p className="text-muted">
            Photo checks: brightness {r.quality.brightness.toFixed(2)}, sharpness {Math.round(r.quality.sharpness)} (simple heuristics).
          </p>
        )}
      </div>
    </details>
  )
}

function CorrectionsForm({ analysis, onDelete }: { analysis: Analysis; onDelete: () => void }) {
  const [correction, setCorrection] = useState(analysis.user_correction)
  const [userNotes, setUserNotes] = useState(analysis.user_notes)
  const toast = useToast()
  const update = useDataMutation(() =>
    api(`/api/analyses/${analysis.id}`, { method: 'PATCH', json: { user_correction: correction, user_notes: userNotes } }),
  )
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-serif text-[1.35rem]">Corrections and notes</h2>
      <p className="mt-1 text-sm text-muted">
        If you learn more, for example from a plant clinic, note it here. It stays next to the model’s output; it doesn’t change it.
      </p>
      <div className="mt-4 grid gap-4">
        <Field label="Correction" optional>
          <input
            className="field"
            maxLength={200}
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="e.g. Confirmed as early blight by a plant clinic"
          />
        </Field>
        <Field label="Notes" optional>
          <textarea className="field" maxLength={4000} value={userNotes} onChange={(e) => setUserNotes(e.target.value)} />
        </Field>
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            variant="secondary"
            busy={update.isPending}
            onClick={() => update.mutate(undefined, { onSuccess: () => toast('Notes saved'), onError: (e) => toast(errorMessage(e), 'error') })}
          >
            Save notes
          </Button>
          <Button variant="quiet" icon="trash" onClick={onDelete}>
            Delete analysis
          </Button>
        </div>
      </div>
    </section>
  )
}

export default function AnalysisPage() {
  const id = Number(useParams().id)
  const { data: a, isPending, error, refetch } = useAnalysis(id)
  const { data: status } = useModelStatus()
  const { locale } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const [note, setNote] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = useDataMutation(() => api(`/api/analyses/${id}/journal`, { method: 'POST', json: { note } }))
  const rerun = useDataMutation(() => api(`/api/analyses/${id}/rerun`, { method: 'POST' }))
  const remove = useDataMutation(() => api(`/api/analyses/${id}`, { method: 'DELETE' }))

  if (isPending)
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Skeleton className="aspect-square" />
        <Skeleton className="h-96" />
      </div>
    )
  if (error || !a) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />

  const r = a.result
  const ctxEntries = (['symptoms_started', 'watering', 'light'] as const).filter((k) => a.context[k])
  const guideSlug = r.primary?.guide_slug ?? { tomato: 'tomato-care', potato: 'potato-care', pepper_bell: 'bell-pepper-care', basil: 'basil-care', monstera: 'monstera-care' }[a.species_key as string]

  return (
    <div>
      <Link to="/analyses" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest">
        <Icon name="arrowLeft" size={16} /> All analyses
      </Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
        <motion.figure initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="lg:sticky lg:top-6">
          <PlantPhoto src={a.photo.url} alt={`Uploaded leaf photo of ${a.plant_name}`} eager className="aspect-[4/5] w-full rounded-[var(--radius-card)] sm:aspect-square" />
          <figcaption className="mt-2 text-sm text-muted">
            {a.plant_name} · photo from {formatDate(a.photo.taken_on, locale)} · analysed {formatDate(a.created_at, locale)}
          </figcaption>
        </motion.figure>

        <div className="flex flex-col gap-5">
          <div>
            <OutcomeBadge outcome={a.outcome} />
            <h1 className="title-lg mt-3">{r.headline}</h1>
            <p className="mt-3 text-[1.08rem] text-ink/90">{r.explanation}</p>
            {a.outcome === 'model_unavailable' && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {r.model.unavailable_reason && <p className="text-sm text-muted">Reason: {r.model.unavailable_reason}</p>}
                <Button
                  variant="secondary"
                  size="sm"
                  icon="refresh"
                  busy={rerun.isPending}
                  onClick={() => rerun.mutate(undefined, { onError: (e) => toast(errorMessage(e), 'error') })}
                >
                  Try the analysis again
                </Button>
              </div>
            )}
          </div>

          {(r.primary || r.alternatives.length > 0) && (
            <Section icon="scan" kicker="Model prediction" title={r.primary ? 'What the model suggests' : 'Closest matches (not strong enough to suggest)'}>
              <div className="flex flex-col gap-3">
                {r.primary && <HypothesisCard h={r.primary} primary />}
                {r.alternatives.length > 0 && (
                  <>
                    {r.primary && <p className="mt-1 text-sm font-medium text-muted">Other possibilities the model considered</p>}
                    {r.alternatives.map((h) => (
                      <HypothesisCard key={h.label} h={h} />
                    ))}
                  </>
                )}
              </div>
              <ModelDetails analysis={a} status={status} />
            </Section>
          )}
          {!r.primary && r.alternatives.length === 0 && r.model.available && a.outcome !== 'unsupported_species' && (
            <ModelDetails analysis={a} status={status} />
          )}

          <Section icon="user" kicker="What you told us" title="Your notes on the plant">
            {ctxEntries.length || a.context.recent_changes ? (
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {ctxEntries.map((k) => (
                  <div key={k}>
                    <dt className="text-sm text-muted">
                      {{ symptoms_started: 'Changes started', watering: 'Watering', light: 'Light' }[k]}
                    </dt>
                    <dd>{CONTEXT_LABELS[k][a.context[k] as string]}</dd>
                  </div>
                ))}
                {a.context.recent_changes && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted">Recent changes</dt>
                    <dd className="whitespace-pre-line">{a.context.recent_changes}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-muted">You didn’t add any context for this photo.</p>
            )}
          </Section>

          <Section icon="book" kicker="Curated care guide" title="Gentle next steps">
            <ul className="space-y-2.5">
              {a.context_notes.map((n, i) => (
                <li key={i} className="flex gap-2.5">
                  <Icon name="leaf" size={18} className="mt-1 shrink-0 text-leaf" />
                  <span>
                    {n.text}{' '}
                    {n.guide_slug && (
                      <Link to={`/care-guide/${n.guide_slug}`} className="text-forest underline underline-offset-4">
                        More
                      </Link>
                    )}
                  </span>
                </li>
              ))}
              <li className="flex gap-2.5">
                <Icon name="camera" size={18} className="mt-1 shrink-0 text-leaf" />
                <span>Add a follow-up photo from the same angle in a week or two, so you can compare what changes.</span>
              </li>
              {guideSlug && (
                <li className="flex gap-2.5">
                  <Icon name="book" size={18} className="mt-1 shrink-0 text-leaf" />
                  <Link to={`/care-guide/${guideSlug}`} className="text-forest underline underline-offset-4">
                    Open the care guide for this {r.primary && !r.primary.healthy ? 'condition' : 'plant'}
                  </Link>
                </li>
              )}
            </ul>
            <p className="mt-4 text-sm text-muted">Care guide notes come from extension-service publications, not from the image model.</p>
          </Section>

          {r.limitations.length > 0 && (
            <section className="rounded-[var(--radius-card)] border border-warn/25 bg-warn-bg/60 p-5">
              <h2 className="flex items-center gap-2 font-serif text-[1.2rem] text-warn">
                <Icon name="info" size={18} /> What this can’t tell you
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.95rem] text-ink/90">
                {r.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <h2 className="font-serif text-[1.35rem]">Keep it in the journal</h2>
            {a.journal_entry_id ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-ok">
                <Icon name="check" size={18} /> Saved to {a.plant_name}’s journal.
                <Link to={`/journal?plant=${a.plant_id}`} className="text-forest underline underline-offset-4">
                  Open journal
                </Link>
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <Field label="Add a note" optional>
                  <textarea className="field" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you do or notice?" />
                </Field>
                <Button
                  icon="journal"
                  busy={save.isPending}
                  className="self-start"
                  onClick={() =>
                    save.mutate(undefined, {
                      onSuccess: () => toast(`Saved to ${a.plant_name}’s journal`),
                      onError: (e) => toast(errorMessage(e), 'error'),
                    })
                  }
                >
                  Save to journal
                </Button>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2.5">
              <ButtonLink to={`/analyze?plant=${a.plant_id}`} variant="secondary" icon="calendar">
                Add a follow-up photo
              </ButtonLink>
            </div>
          </section>

          <CorrectionsForm key={a.id} analysis={a} onDelete={() => setConfirmDelete(true)} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this analysis?"
        busy={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => navigate('/analyses') })}
      >
        The result will be removed. The photo stays with {a.plant_name}, and any journal entry keeps its note.
      </ConfirmDialog>
    </div>
  )
}
