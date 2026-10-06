import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { CONTEXT_LABELS, speciesLabel } from '../components/domain'
import { Icon } from '../components/Icon'
import { LogoSymbol } from '../components/Logo'
import { PlantFormDialog } from '../components/PlantFormDialog'
import { Button, ErrorState, Field, PageHeader, Skeleton } from '../components/ui'
import { useMotionPrefs } from '../motion/MotionPrefs'
import { api, ApiError, errorMessage, uploadWithProgress, type UploadHandle } from '../lib/api'
import { todayIso } from '../lib/format'
import { useObjectUrl } from '../lib/hooks'
import { useInvalidateData, usePlants } from '../lib/queries'
import type { Analysis, Photo } from '../lib/types'

const MAX_MB = 12
const MIN_SIDE = 128
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

/** Quick checks in the browser; the server re-validates everything. */
async function checkFile(file: File): Promise<string | null> {
  if (!ACCEPT.includes(file.type)) {
    if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name))
      return "HEIC photos aren't supported yet. Please share the photo as JPEG (on iPhone: Settings → Camera → Formats → Most Compatible)."
    return 'Please choose a JPEG, PNG or WebP photo.'
  }
  if (file.size > MAX_MB * 1024 * 1024) return `This photo is ${(file.size / 1048576).toFixed(1)} MB. The limit is ${MAX_MB} MB.`
  try {
    const bmp = await createImageBitmap(file)
    const { width, height } = bmp
    bmp.close()
    if (Math.min(width, height) < MIN_SIDE)
      return `This photo is only ${width}×${height} pixels. Please use one at least ${MIN_SIDE} pixels on each side.`
  } catch {
    return "We couldn't read this file as a photo."
  }
  return null
}

type Phase = 'idle' | 'uploading' | 'analyzing'
type ChoiceKey = 'symptoms_started' | 'watering' | 'light'

function ChoiceGroup({ name, legend, value, onChange }: { name: ChoiceKey; legend: string; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.92rem] font-medium">
        {legend} <span className="font-normal text-muted">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(CONTEXT_LABELS[name]).map(([v, label]) => (
          <button key={v} type="button" className="chip" aria-pressed={value === v} onClick={() => onChange(value === v ? '' : v)}>
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Processing({ phase, progress, onCancel }: { phase: Phase; progress: number | null; onCancel: () => void }) {
  const { reduced } = useMotionPrefs()
  return (
    <div role="status" aria-live="polite" className="card flex flex-col items-center px-6 py-14 text-center">
      <motion.div
        animate={reduced ? undefined : { scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <LogoSymbol size={84} />
      </motion.div>
      {phase === 'uploading' ? (
        <>
          <p className="mt-6 font-serif text-[1.4rem]">Uploading your photo…</p>
          {progress !== null ? (
            <>
              <div
                className="mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-sage-soft"
                role="progressbar"
                aria-label="Upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div className="h-full rounded-full bg-forest transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">{Math.round(progress * 100)}% sent</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Sending…</p>
          )}
          <Button variant="quiet" size="sm" className="mt-4" onClick={onCancel}>
            Cancel upload
          </Button>
        </>
      ) : (
        <>
          <p className="mt-6 font-serif text-[1.4rem]">Looking closely at the leaf…</p>
          <p className="mt-2 max-w-sm text-sm text-muted">This usually takes a few seconds. We don’t show a percentage here because we can’t measure it.</p>
        </>
      )}
    </div>
  )
}

export default function AnalyzePage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const invalidate = useInvalidateData()
  const { data: plants, isPending: plantsLoading, error: plantsError, refetch } = usePlants({ state: 'active' })
  const own = useMemo(() => (plants ?? []).filter((p) => !p.is_example), [plants])

  const [pickedPlantId, setPlantId] = useState<number | null>(params.get('plant') ? Number(params.get('plant')) : null)
  const [file, setFile] = useState<File | null>((location.state as { file?: File } | null)?.file ?? null)
  const preview = useObjectUrl(file)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [takenOn, setTakenOn] = useState(todayIso())
  const [ctx, setCtx] = useState({ symptoms_started: '', watering: '', light: '', recent_changes: '' })
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<Photo | null>(null)
  const [newPlantOpen, setNewPlantOpen] = useState(false)
  const uploadRef = useRef<UploadHandle<Photo> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // With a single plant there's nothing to choose.
  const plantId = pickedPlantId ?? (own.length === 1 ? own[0].id : null)
  const plant = own.find((p) => p.id === plantId) ?? null

  useEffect(() => {
    // A file dropped on the dashboard arrives through router state; validate it too.
    if (file) checkFile(file).then((err) => err && (setFileError(err), setFile(null)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = async (f: File | undefined | null) => {
    if (!f) return
    setError(null)
    setUploaded(null)
    const err = await checkFile(f)
    setFileError(err)
    setFile(err ? null : f)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files?.[0])
  }

  const uploadPhoto = async (): Promise<Photo> => {
    if (uploaded) return uploaded
    const fd = new FormData()
    fd.set('file', file!)
    fd.set('plant_id', String(plantId))
    fd.set('taken_on', takenOn)
    setPhase('uploading')
    setProgress(0)
    uploadRef.current = uploadWithProgress<Photo>('/api/photos', fd, setProgress)
    const photo = await uploadRef.current.promise
    setUploaded(photo)
    return photo
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!plant || !file) return
    setError(null)
    try {
      const photo = await uploadPhoto()
      if (!plant.analysis_supported) {
        await api('/api/journal', {
          method: 'POST',
          json: { plant_id: plant.id, kind: 'photo', photo_id: photo.id, entry_date: photo.taken_on, body: ctx.recent_changes },
        })
        await invalidate()
        navigate(`/journal?plant=${plant.id}`, { state: { saved: true } })
        return
      }
      setPhase('analyzing')
      const analysis = await api<Analysis>('/api/analyses', {
        method: 'POST',
        json: {
          photo_id: photo.id,
          symptoms_started: ctx.symptoms_started || null,
          watering: ctx.watering || null,
          light: ctx.light || null,
          recent_changes: ctx.recent_changes,
        },
      })
      await invalidate()
      navigate(`/analyses/${analysis.id}`)
    } catch (err) {
      setPhase('idle')
      if (err instanceof ApiError && err.status === -1) return // cancelled
      if (err instanceof ApiError && err.code) {
        // Server-side image validation: the photo itself needs replacing.
        setFileError(err.message)
        setFile(null)
      } else {
        setError(errorMessage(err))
      }
    }
  }

  if (phase !== 'idle')
    return (
      <div className="mx-auto max-w-2xl">
        <Processing phase={phase} progress={progress} onCancel={() => uploadRef.current?.abort()} />
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="How is your plant feeling?" subtitle="Add a clear photo of one leaf. You can also share what you’ve noticed." />

      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {/* Step 1: plant */}
        <section className="card p-5 sm:p-6" aria-labelledby="step-plant">
          <h2 id="step-plant" className="font-serif text-[1.3rem]">
            1. Which plant?
          </h2>
          {plantsLoading ? (
            <Skeleton className="mt-4 h-11" />
          ) : plantsError ? (
            <ErrorState className="mt-4" message={errorMessage(plantsError)} onRetry={() => refetch()} />
          ) : own.length ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Plant" className="flex-1">
                <select className="field" value={plantId ?? ''} onChange={(e) => setPlantId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Choose a plant…</option>
                  {own.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nickname} ({speciesLabel(p.species_key)})
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="secondary" icon="plus" onClick={() => setNewPlantOpen(true)}>
                New plant
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-start gap-3">
              <p className="text-muted">Add the plant first so the photo has a home in its journal.</p>
              <Button icon="plus" onClick={() => setNewPlantOpen(true)}>
                Add a plant
              </Button>
            </div>
          )}
          {plant && !plant.analysis_supported && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-info-bg p-3 text-[0.95rem]">
              <Icon name="info" size={18} className="mt-0.5 shrink-0 text-forest" />
              <span>
                <strong className="font-semibold">This plant is not supported yet.</strong> The image model only knows tomato, potato
                and bell pepper leaves, so we’ll save the photo to {plant.nickname}’s journal instead of analysing it.
              </span>
            </p>
          )}
        </section>

        {/* Step 2: photo */}
        <section className="card p-5 sm:p-6" aria-labelledby="step-photo">
          <h2 id="step-photo" className="font-serif text-[1.3rem]">
            2. Leaf photo
          </h2>
          <AnimatePresence mode="wait" initial={false}>
            {preview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="mt-4 flex flex-col gap-4 sm:flex-row"
              >
                <img src={preview} alt="Selected leaf photo" className="max-h-80 w-full rounded-xl object-contain sm:w-1/2 bg-sage-soft" />
                <div className="flex flex-col gap-3 sm:flex-1">
                  <p className="text-sm break-all text-muted">{file?.name}</p>
                  <Field label="Photo taken on">
                    <input className="field" type="date" max={todayIso()} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" icon="refresh" onClick={() => inputRef.current?.click()}>
                      Replace photo
                    </Button>
                    <Button variant="quiet" size="sm" icon="close" onClick={() => (setFile(null), setUploaded(null))}>
                      Remove
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <label
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`mt-4 flex cursor-pointer flex-col items-center rounded-xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-forest ${
                    dragging ? 'border-forest bg-sage-soft' : 'border-line-strong bg-ivory hover:bg-sage-soft/60'
                  }`}
                >
                  <Icon name="camera" size={34} className="text-forest" />
                  <span className="mt-3 font-serif text-[1.2rem]">Drop a photo here, or choose one</span>
                  <span className="mt-1 text-sm text-muted">JPEG, PNG or WebP, up to {MAX_MB} MB</span>
                  <span className="sr-only">Choose a leaf photo</span>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT.join(',')}
                    className="sr-only"
                    onChange={(e) => {
                      choose(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
              </motion.div>
            )}
          </AnimatePresence>
          {preview && (
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(',')}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                choose(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          )}
          {fileError && (
            <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-danger-bg p-3 text-sm text-danger">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
              {fileError}
            </p>
          )}
          <details className="mt-4 text-sm text-muted">
            <summary className="cursor-pointer text-forest">Tips for a useful photo</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>One leaf filling most of the frame, top side up.</li>
              <li>Soft daylight; avoid harsh sun, flash and deep shade.</li>
              <li>A plain background helps; the model learned from photos like that.</li>
              <li>Take follow-ups from a similar angle so they’re easy to compare.</li>
            </ul>
          </details>
        </section>

        {/* Step 3: context */}
        <section className="card flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="step-context">
          <div>
            <h2 id="step-context" className="font-serif text-[1.3rem]">
              3. What have you noticed?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Your answers are shown next to the result and used for care notes. The image model itself only sees the photo.
            </p>
          </div>
          <ChoiceGroup name="symptoms_started" legend="When did the changes start?" value={ctx.symptoms_started} onChange={(v) => setCtx({ ...ctx, symptoms_started: v })} />
          <ChoiceGroup name="watering" legend="How often do you water?" value={ctx.watering} onChange={(v) => setCtx({ ...ctx, watering: v })} />
          <ChoiceGroup name="light" legend="How much light does it get?" value={ctx.light} onChange={(v) => setCtx({ ...ctx, light: v })} />
          <Field label="Any recent changes?" optional hint="A move, repotting, a cold night, new fertiliser…">
            <textarea
              className="field"
              maxLength={1000}
              value={ctx.recent_changes}
              onChange={(e) => setCtx({ ...ctx, recent_changes: e.target.value })}
            />
          </Field>
        </section>

        {error && (
          <ErrorState
            message={uploaded ? `Your photo was saved, but the analysis didn’t finish: ${error}` : error}
            onRetry={() => submit(new Event('submit') as unknown as FormEvent)}
          />
        )}

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="text-center text-sm text-muted underline-offset-4 hover:underline">
            Cancel
          </Link>
          <Button type="submit" size="lg" icon={plant?.analysis_supported === false ? 'journal' : 'scan'} disabled={!plant || !file}>
            {plant?.analysis_supported === false ? 'Save to journal' : 'Analyse photo'}
          </Button>
        </div>
        {(!plant || !file) && (
          <p className="-mt-3 text-right text-sm text-muted">{!plant ? 'Choose a plant to continue.' : 'Add a photo to continue.'}</p>
        )}
      </form>

      <PlantFormDialog
        open={newPlantOpen}
        onClose={() => setNewPlantOpen(false)}
        onSaved={(p) => {
          setPlantId(p.id)
          refetch()
        }}
      />
      {plant && (
        <p className="sr-only" aria-live="polite">
          Selected {plant.nickname}
        </p>
      )}
    </div>
  )
}
