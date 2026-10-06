import { motion } from 'motion/react'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { ConfirmDialog } from '../components/Dialog'
import { PlantPhoto, SPECIES, speciesLabel } from '../components/domain'
import { Icon } from '../components/Icon'
import { PlantFormDialog } from '../components/PlantFormDialog'
import { useToast } from '../components/Toast'
import { Button, ButtonLink, EmptyState, ErrorState, ExampleBadge, PageHeader, Skeleton, stagger } from '../components/ui'
import { useI18n } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { useDataMutation, usePlants } from '../lib/queries'
import type { Plant } from '../lib/types'

function PlantCard({ plant, onEdit, onDelete }: { plant: Plant; onEdit: () => void; onDelete: () => void }) {
  const { locale } = useI18n()
  const toast = useToast()
  const archive = useDataMutation((archived: boolean) =>
    api(`/api/plants/${plant.id}`, { method: 'PATCH', json: { archived } }),
  )
  return (
    <motion.li variants={stagger.item} className="card flex flex-col overflow-hidden">
      <Link to={`/journal?plant=${plant.id}`} className="group relative block">
        <PlantPhoto src={plant.cover?.url} alt={plant.cover?.description || `Photo of ${plant.nickname}`} className="aspect-[4/3] w-full transition-transform duration-500 group-hover:scale-[1.02]" />
        {plant.is_example && <ExampleBadge className="absolute top-3 left-3" />}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-serif text-[1.35rem] leading-tight">{plant.nickname}</h2>
            <p className="truncate text-sm text-muted">
              {plant.species || speciesLabel(plant.species_key)}
              {plant.location && ` · ${plant.location}`}
            </p>
          </div>
          {plant.analysis_supported ? (
            <span className="shrink-0 rounded-full bg-ok-bg px-2 py-0.5 text-[0.72rem] font-semibold text-ok" title="Leaf photos can be analysed">
              Analysis
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-sage-soft px-2 py-0.5 text-[0.72rem] font-semibold text-muted" title="The image model doesn't cover this plant yet">
              Journal only
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          {plant.entry_count} journal {plant.entry_count === 1 ? 'entry' : 'entries'}
          {plant.last_entry_on && ` · last ${formatDate(plant.last_entry_on, locale)}`}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {!plant.is_example && !plant.archived_at && (
            <ButtonLink to={`/analyze?plant=${plant.id}`} size="sm" variant="secondary" icon="camera">
              Add photo
            </ButtonLink>
          )}
          {!plant.is_example && (
            <>
              <Button size="sm" variant="quiet" icon="edit" onClick={onEdit} aria-label={`Edit ${plant.nickname}`}>
                <span className="hidden sm:inline">Edit</span>
              </Button>
              <Button
                size="sm"
                variant="quiet"
                icon="archive"
                busy={archive.isPending}
                onClick={() =>
                  archive.mutate(!plant.archived_at, {
                    onSuccess: () => toast(plant.archived_at ? `${plant.nickname} restored` : `${plant.nickname} archived`),
                    onError: (e) => toast(errorMessage(e), 'error'),
                  })
                }
              >
                {plant.archived_at ? 'Restore' : 'Archive'}
              </Button>
            </>
          )}
          <Button size="sm" variant="quiet" icon="trash" onClick={onDelete} aria-label={`Delete ${plant.nickname}`}>
            <span className="hidden sm:inline">Delete</span>
          </Button>
        </div>
      </div>
    </motion.li>
  )
}

export default function PlantsPage() {
  const [q, setQ] = useState('')
  const deferredQ = useDeferredValue(q)
  const [species, setSpecies] = useState('')
  const [state, setState] = useState<'active' | 'archived'>('active')
  const { data: plants, isPending, error, refetch } = usePlants({ q: deferredQ, species_key: species, state })
  const [editing, setEditing] = useState<Plant | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Plant | null>(null)
  const toast = useToast()
  const remove = useDataMutation((p: Plant) => api(`/api/plants/${p.id}`, { method: 'DELETE' }))
  const removeExamples = useDataMutation(() => api('/api/account/examples', { method: 'DELETE' }))
  const hasExamples = plants?.some((p) => p.is_example)

  return (
    <>
      <PageHeader
        title="My garden"
        subtitle="Every plant you care for, each with its own journal."
        actions={
          <Button icon="plus" onClick={() => setEditing(null)}>
            Add a plant
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <label htmlFor="plant-search" className="sr-only">
            Search plants
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            id="plant-search"
            type="search"
            className="field pl-10"
            placeholder="Search by name, species or place"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by kind of plant">
          <button type="button" className="chip" aria-pressed={species === ''} onClick={() => setSpecies('')}>
            All plants
          </button>
          {SPECIES.map((s) => (
            <button key={s.value} type="button" className="chip" aria-pressed={species === s.value} onClick={() => setSpecies(species === s.value ? '' : s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-line bg-card p-1" role="group" aria-label="Show">
          {(['active', 'archived'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={state === s}
              onClick={() => setState(s)}
              className={`min-h-9 rounded-full px-4 text-sm ${state === s ? 'bg-forest text-card' : 'text-muted hover:text-forest'}`}
            >
              {s === 'active' ? 'Growing' : 'Archived'}
            </button>
          ))}
        </div>
        {hasExamples && (
          <Button
            variant="quiet"
            size="sm"
            busy={removeExamples.isPending}
            onClick={() => removeExamples.mutate(undefined, { onSuccess: () => toast('Example garden removed') })}
          >
            Remove example garden
          </Button>
        )}
      </div>

      {isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : plants.length === 0 ? (
        <div className="card">
          {q || species ? (
            <EmptyState icon="search" title="No plants match">
              Try a different search or filter.
            </EmptyState>
          ) : state === 'archived' ? (
            <EmptyState icon="archive" title="Nothing archived">
              Archived plants keep their journal but step out of your daily view.
            </EmptyState>
          ) : (
            <EmptyState title="Your garden is waiting" action={<Button icon="plus" onClick={() => setEditing(null)}>Add a plant</Button>}>
              Add your first plant to start its story.
            </EmptyState>
          )}
        </div>
      ) : (
        <motion.ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" variants={stagger.container} initial="hidden" animate="show">
          {plants.map((p) => (
            <PlantCard key={p.id} plant={p} onEdit={() => setEditing(p)} onDelete={() => setDeleting(p)} />
          ))}
        </motion.ul>
      )}

      <PlantFormDialog
        open={editing !== undefined}
        plant={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={(p) => toast(editing ? `${p.nickname} updated` : `${p.nickname} joined your garden`)}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.nickname}?`}
        busy={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting, {
            onSuccess: () => {
              toast(`${deleting.nickname} deleted`)
              setDeleting(null)
            },
          })
        }
      >
        This permanently deletes {deleting?.nickname}, its photos, analyses, journal entries and reminders.
        {!deleting?.is_example && ' If you only want it out of view, archive it instead.'}
      </ConfirmDialog>
    </>
  )
}
