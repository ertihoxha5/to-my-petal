import { motion } from 'motion/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { CompareDialog } from '../components/Compare'
import { ConfirmDialog, Dialog } from '../components/Dialog'
import { OutcomeBadge, PlantPhoto, REMINDER_KINDS } from '../components/domain'
import { Icon, reminderIcon, type IconName } from '../components/Icon'
import { useToast } from '../components/Toast'
import { Button, ButtonLink, EmptyState, ErrorState, ExampleBadge, Field, PageHeader, Skeleton } from '../components/ui'
import { useI18n } from '../i18n'
import { useMotionPrefs } from '../motion/MotionPrefs'
import { api, errorMessage, uploadWithProgress } from '../lib/api'
import { formatDate, todayIso } from '../lib/format'
import { useDataMutation, useInvalidateData, useJournal, usePlants } from '../lib/queries'
import type { JournalEntry, Photo, Plant } from '../lib/types'

const PAGE = 15

const KIND: Record<JournalEntry['kind'], { label: string; icon: IconName }> = {
  observation: { label: 'Observation', icon: 'note' },
  photo: { label: 'Photo', icon: 'camera' },
  analysis: { label: 'Analysis', icon: 'scan' },
  care: { label: 'Care', icon: 'leaf' },
}

interface EntryDialogProps {
  open: boolean
  onClose: () => void
  entry: JournalEntry | null
  plants: Plant[]
  defaultPlantId: number | null
}

/** Mounted only while open, so each opening starts from the entry's current values. */
function EntryDialog(props: EntryDialogProps) {
  return props.open ? <EntryDialogInner {...props} /> : null
}

function EntryDialogInner({ open, onClose, entry, plants, defaultPlantId }: EntryDialogProps) {
  const [plantId, setPlantId] = useState<number | null>(entry?.plant_id ?? defaultPlantId ?? plants[0]?.id ?? null)
  const [date, setDate] = useState(entry?.entry_date ?? todayIso())
  const [title, setTitle] = useState(entry?.title ?? '')
  const [body, setBody] = useState(entry?.body ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const invalidate = useInvalidateData()
  const toast = useToast()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!entry && !plantId) return setError('Please choose a plant.')
    if (!entry && !body.trim() && !title.trim() && !file) return setError('Write a note or add a photo.')
    if (date > todayIso()) return setError("Journal entries can't be dated in the future.")
    setBusy(true)
    try {
      if (entry) {
        await api(`/api/journal/${entry.id}`, { method: 'PATCH', json: { entry_date: date, title, body } })
      } else {
        let photo: Photo | null = null
        if (file) {
          const fd = new FormData()
          fd.set('file', file)
          fd.set('plant_id', String(plantId))
          fd.set('taken_on', date)
          photo = await uploadWithProgress<Photo>('/api/photos', fd, setProgress).promise
        }
        await api('/api/journal', {
          method: 'POST',
          json: { plant_id: plantId, kind: photo ? 'photo' : 'observation', entry_date: date, title, body, photo_id: photo?.id ?? null },
        })
      }
      await invalidate()
      toast(entry ? 'Entry updated' : 'Added to the journal')
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={entry ? 'Edit entry' : 'New journal entry'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="entry-form" busy={busy}>
            {entry ? 'Save' : 'Add entry'}
          </Button>
        </>
      }
    >
      <form id="entry-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {!entry && (
          <Field label="Plant">
            <select className="field" value={plantId ?? ''} onChange={(e) => setPlantId(Number(e.target.value))}>
              {plants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Date">
          <input className="field" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Title" optional className="sm:col-span-2">
          <input className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. New leaf unfurling" />
        </Field>
        <Field label="Note" optional className="sm:col-span-2">
          <textarea className="field" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {!entry && (
          <Field label="Photo" optional className="sm:col-span-2" hint="Follow-up photos from a similar angle are easiest to compare.">
            <input
              className="field file:mr-3 file:rounded-md file:border-0 file:bg-sage-soft file:px-3 file:py-1.5 file:text-forest"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
        )}
        {progress !== null && (
          <p className="text-sm text-muted sm:col-span-2" role="status">
            Uploading… {Math.round(progress * 100)}%
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

function EntryCard({ entry, showPlant, onEdit, onDelete }: { entry: JournalEntry; showPlant: boolean; onEdit: () => void; onDelete: () => void }) {
  const { locale } = useI18n()
  const kind = KIND[entry.kind]
  const icon: IconName = entry.kind === 'care' && entry.care_kind ? reminderIcon[entry.care_kind] : kind.icon
  const { reduced } = useMotionPrefs()
  return (
    <motion.li
      // With reduced motion, entries render immediately instead of waiting to scroll into view.
      initial={reduced ? false : { opacity: 0, x: -10 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-12 sm:pl-16"
    >
      {/* Node on the botanical timeline */}
      <span className="absolute top-5 left-[0.55rem] grid size-7 place-items-center rounded-full border border-line bg-card text-forest sm:left-[1.05rem]">
        <Icon name={icon} size={15} />
      </span>
      <article className="card p-4 sm:p-5">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <time dateTime={entry.entry_date} className="font-serif text-[1.1rem]">
            {formatDate(entry.entry_date, locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </time>
          <span className="text-sm text-muted">
            {entry.kind === 'care' && entry.care_kind ? REMINDER_KINDS.find((k) => k.value === entry.care_kind)?.label ?? kind.label : kind.label}
            {showPlant && ` · ${entry.plant_name}`}
          </span>
          {entry.is_example && <ExampleBadge />}
          {!entry.is_example && (
            <span className="ml-auto flex gap-0.5">
              <Button variant="quiet" size="sm" onClick={onEdit} aria-label="Edit entry">
                <Icon name="edit" size={17} />
              </Button>
              <Button variant="quiet" size="sm" onClick={onDelete} aria-label="Delete entry">
                <Icon name="trash" size={17} />
              </Button>
            </span>
          )}
        </header>
        <div className={`mt-3 flex flex-col gap-4 ${entry.photo ? 'sm:flex-row' : ''}`}>
          {entry.photo && (
            <a href={entry.photo.url} target="_blank" rel="noreferrer" className="shrink-0 sm:w-56">
              <PlantPhoto
                src={entry.photo.thumb_url}
                alt={entry.photo.description || `Photo of ${entry.plant_name} on ${entry.entry_date}`}
                className="aspect-[4/3] w-full rounded-xl"
              />
              <span className="sr-only">Open full-size photo in a new tab</span>
            </a>
          )}
          <div className="min-w-0">
            {entry.title && <h3 className="font-serif text-[1.25rem] leading-snug">{entry.title}</h3>}
            {entry.analysis && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <OutcomeBadge outcome={entry.analysis.outcome} />
                <Link to={`/analyses/${entry.analysis.id}`} className="text-sm text-forest underline underline-offset-4">
                  Review analysis
                </Link>
              </div>
            )}
            {entry.body && <p className="mt-2 whitespace-pre-line text-ink/90">{entry.body}</p>}
          </div>
        </div>
      </article>
    </motion.li>
  )
}

export default function JournalPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const plantId = params.get('plant') ? Number(params.get('plant')) : undefined
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [kind, setKind] = useState('')
  // Page size resets whenever the filters change.
  const filterKey = [params.get('plant'), dateFrom, dateTo, kind].join('|')
  const [paging, setPaging] = useState({ key: filterKey, limit: PAGE })
  const limit = paging.key === filterKey ? paging.limit : PAGE
  const { data: plants = [] } = usePlants({ state: 'all' })
  const { data, isPending, error, refetch, isFetching } = useJournal({
    plant_id: plantId,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    kind: kind || undefined,
    limit,
  })
  const [editing, setEditing] = useState<JournalEntry | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<JournalEntry | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const toast = useToast()
  const remove = useDataMutation((e: JournalEntry) => api(`/api/journal/${e.id}`, { method: 'DELETE' }))

  const plant = plants.find((p) => p.id === plantId) ?? null
  const writable = useMemo(() => plants.filter((p) => !p.is_example && !p.archived_at), [plants])
  useEffect(() => {
    if ((location.state as { saved?: boolean } | null)?.saved) toast('Photo saved to the journal')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectPlant = (id?: number) => {
    const next = new URLSearchParams(params)
    if (id) next.set('plant', String(id))
    else next.delete('plant')
    setParams(next, { replace: true })
  }
  const filtered = !!(dateFrom || dateTo || kind)

  return (
    <>
      <PageHeader
        title={plant ? `${plant.nickname}’s journal` : 'Your plant journal'}
        subtitle="Real plants. Real progress."
        actions={
          <>
            {plant && (
              <Button variant="secondary" icon="compare" onClick={() => setCompareOpen(true)}>
                Compare photos
              </Button>
            )}
            {writable.length > 0 && (
              <Button icon="plus" onClick={() => setEditing(null)}>
                New entry
              </Button>
            )}
          </>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2 pb-1" role="group" aria-label="Filter by plant">
          <button type="button" className="chip" aria-pressed={!plantId} onClick={() => selectPlant(undefined)}>
            All plants
          </button>
          {plants.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={plantId === p.id} onClick={() => selectPlant(p.id)}>
              {p.nickname}
              {p.is_example && <span className="text-[0.7rem] opacity-80">(example)</span>}
            </button>
          ))}
        </div>
      </div>
      <details className="mb-6" open={filtered}>
        <summary className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-forest">
          <Icon name="calendar" size={16} /> Filter by date and type
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-4 sm:items-end">
          <Field label="From">
            <input className="field" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input className="field" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Everything</option>
              {Object.entries(KIND).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          {filtered && (
            <Button variant="quiet" onClick={() => (setDateFrom(''), setDateTo(''), setKind(''))}>
              Clear filters
            </Button>
          )}
        </div>
      </details>

      {isPending ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <div className="card">
          {filtered ? (
            <EmptyState icon="calendar" title="Nothing in this range">
              Try widening the dates or clearing the filters.
            </EmptyState>
          ) : (
            <EmptyState
              icon="journal"
              title={plant ? `No entries for ${plant.nickname} yet` : 'Your journal is empty'}
              action={
                <>
                  <ButtonLink to={plant ? `/analyze?plant=${plant.id}` : '/analyze'} icon="camera">
                    Add a photo
                  </ButtonLink>
                  {writable.length > 0 && (
                    <Button variant="secondary" icon="note" onClick={() => setEditing(null)}>
                      Write a note
                    </Button>
                  )}
                </>
              }
            >
              Photos, notes, analyses and care you log will gather here in order.
            </EmptyState>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            {/* Thin botanical timeline */}
            <svg className="absolute top-0 left-[1.4rem] h-full w-6 -translate-x-1/2 sm:left-[1.9rem]" preserveAspectRatio="none" viewBox="0 0 24 100" aria-hidden="true">
              <path d="M12 0V100" stroke="#A5B39A" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
            </svg>
            <ol className="flex flex-col gap-5" aria-label="Journal entries, newest first">
              {data.items.map((e) => (
                <EntryCard key={e.id} entry={e} showPlant={!plantId} onEdit={() => setEditing(e)} onDelete={() => setDeleting(e)} />
              ))}
            </ol>
          </div>
          <div className="mt-6 flex flex-col items-center gap-2">
            <p className="text-sm text-muted">
              Showing {data.items.length} of {data.total}
            </p>
            {data.items.length < data.total && (
              <Button variant="secondary" busy={isFetching} onClick={() => setPaging({ key: filterKey, limit: limit + PAGE })}>
                Show older entries
              </Button>
            )}
          </div>
        </>
      )}

      <EntryDialog open={editing !== undefined} onClose={() => setEditing(undefined)} entry={editing ?? null} plants={writable} defaultPlantId={plant && !plant.is_example ? plant.id : null} />
      <CompareDialog plant={plant} open={compareOpen} onClose={() => setCompareOpen(false)} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this entry?"
        busy={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              setDeleting(null)
              toast('Entry deleted')
            },
          })
        }
      >
        {deleting?.photo ? 'The note will be removed. The photo stays in the plant’s photo collection.' : 'The note will be removed.'}
      </ConfirmDialog>
    </>
  )
}
