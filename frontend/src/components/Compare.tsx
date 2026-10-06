import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useI18n } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { formatDate, todayIso } from '../lib/format'
import { useDataMutation, usePhotos } from '../lib/queries'
import type { Photo, Plant } from '../lib/types'
import { Dialog } from './Dialog'
import { PlantPhoto } from './domain'
import { useToast } from './Toast'
import { Button, Field, Skeleton } from './ui'

/** Before/after slider. Keyboard: arrows move 5%, Home/End jump to the ends. */
export function CompareSlider({ before, after }: { before: Photo; after: Photo }) {
  const { locale } = useI18n()
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const fromPointer = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    setPos(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)))
  }
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 5
    const map: Record<string, number> = { ArrowLeft: pos - step, ArrowDown: pos - step, ArrowRight: pos + step, ArrowUp: pos + step, Home: 0, End: 100 }
    if (e.key in map) {
      e.preventDefault()
      setPos(Math.min(100, Math.max(0, map[e.key])))
    }
  }
  const label = (p: Photo) => formatDate(p.taken_on, locale)

  return (
    <div>
      <div
        ref={ref}
        className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-xl bg-sage-soft select-none"
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
          fromPointer(e)
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <img src={after.url} alt={`Later photo, ${label(after)}`} className="absolute inset-0 size-full object-cover" draggable={false} />
        <img
          src={before.url}
          alt={`Earlier photo, ${label(before)}`}
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          draggable={false}
        />
        <span className="absolute top-3 left-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs text-card">{label(before)}</span>
        <span className="absolute top-3 right-3 rounded-full bg-ink/70 px-2.5 py-1 text-xs text-card">{label(after)}</span>
        <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-card shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" style={{ left: `${pos}%` }}>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Reveal earlier or later photo"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(pos)}% earlier photo`}
            onKeyDown={onKey}
            className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-card text-forest shadow-[var(--shadow-lift)]"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="m9 7-5 5 5 5M15 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export function SideBySide({ before, after }: { before: Photo; after: Photo }) {
  const { locale } = useI18n()
  return (
    <div className="grid grid-cols-2 gap-3">
      {[before, after].map((p, i) => (
        <figure key={p.id}>
          <PlantPhoto src={p.url} alt={`${i === 0 ? 'Earlier' : 'Later'} photo, ${formatDate(p.taken_on, locale)}`} className="aspect-[3/4] w-full rounded-xl sm:aspect-[4/5]" />
          <figcaption className="mt-1.5 text-center text-sm text-muted">
            {i === 0 ? 'Earlier' : 'Later'} · {formatDate(p.taken_on, locale)}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}

function PhotoPicker({ photos, value, onChange, label }: { photos: Photo[]; value: number | null; onChange: (id: number) => void; label: string }) {
  const { locale } = useI18n()
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={value === p.id}
            aria-label={`Photo from ${formatDate(p.taken_on, locale)}`}
            onClick={() => onChange(p.id)}
            className={`shrink-0 overflow-hidden rounded-lg border-2 ${value === p.id ? 'border-forest' : 'border-transparent'}`}
          >
            <img src={p.thumb_url} alt="" loading="lazy" className="size-16 object-cover" />
            <span className="block bg-card px-1 py-0.5 text-[0.7rem] text-muted">{formatDate(p.taken_on, locale, { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}

interface CompareProps {
  plant: Plant | null
  open: boolean
  onClose: () => void
}

/** Mounted only while open, so each opening starts with the two latest photos. */
export function CompareDialog(props: CompareProps) {
  return props.open ? <CompareDialogInner {...props} /> : null
}

function CompareDialogInner({ plant, open, onClose }: CompareProps) {
  const { data: photos, isPending } = usePhotos(plant ? plant.id : null)
  const sorted = [...(photos ?? [])].sort((a, b) => a.taken_on.localeCompare(b.taken_on) || a.id - b.id)
  // null = "use the default": the two most recent photos.
  const [pickedA, setA] = useState<number | null>(null)
  const [pickedB, setB] = useState<number | null>(null)
  const a = pickedA ?? sorted[sorted.length - 2]?.id ?? null
  const b = pickedB ?? sorted[sorted.length - 1]?.id ?? null
  const [mode, setMode] = useState<'slider' | 'side'>('slider')
  const [note, setNote] = useState('')
  const toast = useToast()

  const pa = sorted.find((p) => p.id === a)
  const pb = sorted.find((p) => p.id === b)
  const [before, after] = pa && pb ? (pa.taken_on <= pb.taken_on ? [pa, pb] : [pb, pa]) : [undefined, undefined]

  const save = useDataMutation(() =>
    api('/api/journal', {
      method: 'POST',
      json: {
        plant_id: plant!.id,
        kind: 'observation',
        entry_date: todayIso(),
        title: `Compared photos from ${before!.taken_on} and ${after!.taken_on}`,
        body: note,
      },
    }),
  )

  return (
    <Dialog open={open} onClose={onClose} size="lg" title={`Compare ${plant?.nickname ?? ''} photos`} description="A visual tool: look closely and write down what you see.">
      {isPending ? (
        <Skeleton className="aspect-[4/3]" />
      ) : sorted.length < 2 ? (
        <p className="text-muted">Add at least two photos of this plant to compare them.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoPicker photos={sorted} value={a} onChange={setA} label="First photo" />
            <PhotoPicker photos={sorted} value={b} onChange={setB} label="Second photo" />
          </div>
          <div className="flex gap-1 self-start rounded-full border border-line bg-card p-1" role="group" aria-label="View">
            {(['slider', 'side'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-9 rounded-full px-4 text-sm ${mode === m ? 'bg-forest text-card' : 'text-muted hover:text-forest'}`}
              >
                {m === 'slider' ? 'Slider' : 'Side by side'}
              </button>
            ))}
          </div>
          {before && after && before.id !== after.id ? (
            mode === 'slider' ? <CompareSlider before={before} after={after} /> : <SideBySide before={before} after={after} />
          ) : (
            <p className="text-muted">Choose two different photos.</p>
          )}
          <p className="rounded-lg bg-info-bg p-3 text-sm text-ink/85">
            Changes in light, angle or which leaf is in frame can look like progress or decline. Photos alone can’t show whether a
            plant has recovered or why. Use the slider when photos line up, and side by side when they don’t.
          </p>
          {before && after && before.id !== after.id && (
            <div className="flex flex-col gap-3">
              <Field label="What do you notice?" optional>
                <textarea className="field" maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <Button
                className="self-start"
                variant="secondary"
                icon="journal"
                disabled={!note.trim() || plant?.is_example}
                busy={save.isPending}
                onClick={() =>
                  save.mutate(undefined, {
                    onSuccess: () => {
                      toast('Saved to the journal')
                      onClose()
                    },
                    onError: (e) => toast(errorMessage(e), 'error'),
                  })
                }
              >
                Save note to journal
              </Button>
              {plant?.is_example && <p className="text-sm text-muted">Example plants are read-only.</p>}
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
