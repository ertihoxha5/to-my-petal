import { motion } from 'motion/react'
import { useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import hero from '../assets/photos/hero-tomato.jpg'
import { BotanicalBranch, HerbMark } from '../components/Botanical'
import { OutcomeBadge, PlantPhoto } from '../components/domain'
import { Icon, reminderIcon } from '../components/Icon'
import { PlantFormDialog } from '../components/PlantFormDialog'
import { ReminderDialog } from '../components/Reminders'
import { useToast } from '../components/Toast'
import { Button, ButtonLink, EmptyState, ErrorState, ExampleBadge, Skeleton, stagger, TextLink } from '../components/ui'
import { useI18n } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { dueLabel, formatDate, relativeDay } from '../lib/format'
import { useDashboard, useDataMutation } from '../lib/queries'
import type { Analysis, PlantStory, Reminder } from '../lib/types'

function UploadCard() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [dragging, setDragging] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) navigate('/analyze', { state: { file } })
  }

  return (
    <section
      aria-labelledby="upload-title"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`on-dark relative isolate flex min-h-[22rem] overflow-hidden rounded-[var(--radius-card)] bg-forest shadow-[var(--shadow-card)] transition-shadow sm:min-h-[24rem] ${
        dragging ? 'ring-4 ring-blush' : ''
      }`}
    >
      <img
        src={hero}
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover object-[62%_45%]"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(10_26_16/0.88)_0%,rgb(10_26_16/0.66)_42%,rgb(10_26_16/0.12)_78%)]" />
      <div className="flex max-w-md flex-col justify-center p-7 text-card sm:p-10">
        <p className="eyebrow text-card/85">{t('home.uploadEyebrow')}</p>
        <h2 id="upload-title" className="mt-4 font-serif text-[clamp(2.1rem,1.4rem+2.4vw,3.2rem)] leading-[1.04] text-card">
          {t('home.uploadTitle')}
        </h2>
        <p className="mt-4 text-[1.08rem] text-card/90">{t('home.uploadText')}</p>
        <div className="mt-8">
          <ButtonLink to="/analyze" variant="cream" size="lg" icon="upload">
            {t('home.uploadCta')}
          </ButtonLink>
        </div>
        <p className="mt-5 text-sm text-card/75">Works for tomato, potato and bell pepper leaves. Drop a photo here, too.</p>
      </div>
    </section>
  )
}

function LatestAnalysis({ analysis }: { analysis: Analysis | null }) {
  const { t, locale } = useI18n()
  return (
    <section aria-labelledby="recent-title" className="card flex flex-col p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="font-serif text-[1.35rem]">
          {t('home.recent')}
        </h2>
        <TextLink to="/analyses">
          {t('home.viewAll')} <Icon name="arrowRight" size={15} />
        </TextLink>
      </div>
      {analysis ? (
        <>
          <div className="mt-5 flex gap-4">
            <PlantPhoto
              src={analysis.photo.thumb_url}
              alt={`Leaf photo of ${analysis.plant_name}`}
              className="size-28 shrink-0 rounded-xl sm:size-32"
            />
            <div className="min-w-0">
              <h3 className="font-serif text-[1.3rem] leading-tight">Your {analysis.plant_name.toLowerCase()} plant</h3>
              <p className="mt-1 text-sm text-muted">{formatDate(analysis.created_at, locale)}</p>
              <OutcomeBadge outcome={analysis.outcome} className="mt-3" />
            </div>
          </div>
          <p className="mt-4 line-clamp-4 text-[0.95rem] text-ink/90">{analysis.result.explanation}</p>
          <div className="mt-auto grid gap-2.5 pt-5">
            <ButtonLink to={`/analyses/${analysis.id}`} iconRight="arrowRight">
              {t('home.review')}
            </ButtonLink>
            <ButtonLink to={`/analyze?plant=${analysis.plant_id}`} variant="secondary" icon="calendar">
              {t('home.followUp')}
            </ButtonLink>
          </div>
        </>
      ) : (
        <EmptyState icon="scan" title={t('home.noAnalysisTitle')} className="my-auto">
          {t('home.noAnalysisText')}
        </EmptyState>
      )}
    </section>
  )
}

function StoryCard({ story }: { story: PlantStory }) {
  const { t, locale } = useI18n()
  const { plant, latest_entry: latest, recent_photos: photos } = story
  return (
    <motion.article variants={stagger.item} className="h-full">
      <Link
        to={`/journal?plant=${plant.id}`}
        className="card group flex h-full gap-4 p-3.5 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
      >
        <PlantPhoto
          src={plant.cover?.thumb_url}
          alt={plant.cover?.description || `Photo of ${plant.nickname}`}
          className="w-[42%] shrink-0 self-stretch rounded-xl"
        />
        <div className="flex min-w-0 flex-1 flex-col py-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex flex-wrap items-center gap-2 font-serif text-[1.3rem] leading-tight">
                {plant.nickname}
                {plant.is_example && <ExampleBadge />}
              </h3>
              <p className="text-sm text-muted">
                {story.entry_count === 1 ? t('home.entry') : story.entry_count ? t('home.entries', { n: story.entry_count }) : t('home.noEntries')}
              </p>
            </div>
            <Icon name="chevronRight" size={18} className="mt-1 shrink-0 text-forest transition-transform group-hover:translate-x-0.5" />
          </div>
          {latest && <p className="mt-2 text-sm text-muted">{formatDate(latest.entry_date, locale)}</p>}
          {photos.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {photos.map((p) => (
                <figure key={p.id}>
                  <PlantPhoto src={p.thumb_url} alt={p.description || `${plant.nickname} on ${p.taken_on}`} className="aspect-square w-full rounded-lg" />
                  <figcaption className="mt-1 text-center text-[0.72rem] text-muted">{relativeDay(p.taken_on, locale)}</figcaption>
                </figure>
              ))}
            </div>
          )}
          {latest?.body && <p className="mt-2 line-clamp-2 text-[0.82rem] leading-snug text-ink/85">{latest.body}</p>}
        </div>
      </Link>
    </motion.article>
  )
}

function CareStrip({ reminders, onAdd }: { reminders: Reminder[]; onAdd: () => void }) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const complete = useDataMutation((id: number) => api(`/api/reminders/${id}/complete`, { method: 'POST', json: {} }))
  return (
    <section aria-labelledby="moment-title" className="card mt-6 flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:gap-6 lg:px-7">
      <div className="flex items-center gap-4 lg:w-[30%] lg:shrink-0">
        <HerbMark size={46} />
        <div>
          <h2 id="moment-title" className="font-serif text-[1.3rem] leading-tight">
            {t('home.moment')}
          </h2>
          <p className="text-sm text-muted">{t('home.momentSub')}</p>
        </div>
      </div>
      {reminders.length ? (
        <ul className="grid flex-1 gap-1 sm:grid-cols-3 sm:gap-0">
          {reminders.slice(0, 3).map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-line py-2 sm:border-l sm:px-5">
              <Icon name={reminderIcon[r.kind]} size={30} strokeWidth={1.2} className="shrink-0 text-forest" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-[1.05rem] leading-tight">{r.title}</p>
                <p className={`truncate text-sm ${dueLabel(r.due_on, locale).includes('overdue') ? 'text-warn' : 'text-muted'}`}>
                  {r.plant_name ? `${r.plant_name} · ` : ''}
                  {dueLabel(r.due_on, locale)}
                </p>
              </div>
              <Button
                variant="quiet"
                size="sm"
                aria-label={`Mark "${r.title}" done`}
                busy={complete.isPending && complete.variables === r.id}
                onClick={() =>
                  complete.mutate(r.id, {
                    onSuccess: () => toast('Nicely done'),
                    onError: (e) => toast(errorMessage(e), 'error'),
                  })
                }
              >
                <Icon name="check" size={18} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex-1 text-muted">{t('home.noReminders')}</p>
      )}
      <div className="flex gap-2 lg:shrink-0">
        <Button variant="secondary" size="sm" icon="plus" onClick={onAdd}>
          {t('home.addReminder')}
        </Button>
        <ButtonLink to="/reminders" variant="ghost" size="sm" aria-label={t('home.allReminders')}>
          <Icon name="chevronRight" size={18} />
        </ButtonLink>
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const { t } = useI18n()
  const { data, isPending, error, refetch } = useDashboard()
  const [plantOpen, setPlantOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)
  const toast = useToast()
  const examples = useDataMutation(() => api('/api/account/examples', { method: 'POST' }))

  return (
    <>
      <div className="relative">
        <BotanicalBranch className="pointer-events-none absolute -top-12 right-0 hidden w-[13rem] opacity-90 xl:block xl:right-[7.5rem] xl:w-[15rem]" />
        <p className="pointer-events-none absolute top-1 right-0 hidden max-w-[8rem] rotate-[-4deg] text-right font-serif text-[1.1rem] leading-snug text-muted italic xl:block">
          {t('home.aside')}
        </p>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="display relative max-w-[16ch] md:max-w-none">
          {t('home.title')}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08 }}
          className="relative mt-3 text-[clamp(1.1rem,1rem+0.5vw,1.45rem)] text-muted"
        >
          {t('home.subtitle')}
        </motion.p>
      </div>

      {error ? (
        <ErrorState className="mt-8" message={errorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <>
          <motion.div
            className="mt-8 grid gap-5 lg:grid-cols-[1.55fr_1fr]"
            variants={stagger.container}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={stagger.item}>
              <UploadCard />
            </motion.div>
            <motion.div variants={stagger.item} className="flex">
              {isPending ? <Skeleton className="h-full min-h-[22rem] w-full" /> : <LatestAnalysis analysis={data.latest_analysis} />}
            </motion.div>
          </motion.div>

          <section aria-labelledby="stories-title" className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id="stories-title" className="title-md">
                {t('home.stories')}
              </h2>
              <TextLink to="/journal">
                {t('home.viewJournal')} <Icon name="arrowRight" size={15} />
              </TextLink>
            </div>
            {isPending ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-60" />
                ))}
              </div>
            ) : data.stories.length ? (
              <motion.div
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                variants={stagger.container}
                initial="hidden"
                animate="show"
              >
                {data.stories.map((s) => (
                  <StoryCard key={s.plant.id} story={s} />
                ))}
              </motion.div>
            ) : (
              <div className="card">
                <EmptyState
                  title={t('home.emptyGardenTitle')}
                  action={
                    <>
                      <Button icon="plus" onClick={() => setPlantOpen(true)}>
                        {t('home.addPlant')}
                      </Button>
                      <Button
                        variant="secondary"
                        busy={examples.isPending}
                        onClick={() =>
                          examples.mutate(undefined, {
                            onSuccess: () => toast('Example garden added. Look for the Example badges.'),
                            onError: (e) => toast(errorMessage(e), 'error'),
                          })
                        }
                      >
                        {t('home.tryExamples')}
                      </Button>
                    </>
                  }
                >
                  {t('home.emptyGardenText')}
                </EmptyState>
              </div>
            )}
          </section>

          {!isPending && <CareStrip reminders={data.reminders} onAdd={() => setReminderOpen(true)} />}
        </>
      )}

      <PlantFormDialog open={plantOpen} onClose={() => setPlantOpen(false)} onSaved={(p) => toast(`${p.nickname} joined your garden`)} />
      <ReminderDialog open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </>
  )
}
