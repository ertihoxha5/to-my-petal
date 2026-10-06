import { useState, type FormEvent } from 'react'
import { useObjectUrl } from '../lib/hooks'
import { api, errorMessage, uploadWithProgress } from '../lib/api'
import { todayIso } from '../lib/format'
import { useInvalidateData } from '../lib/queries'
import type { Photo, Plant, SpeciesKey } from '../lib/types'
import { Dialog } from './Dialog'
import { SPECIES } from './domain'
import { Button, Field } from './ui'

interface FormState {
  nickname: string
  species_key: SpeciesKey
  species: string
  location: string
  acquired_on: string
  notes: string
}

const empty: FormState = { nickname: '', species_key: 'tomato', species: '', location: '', acquired_on: '', notes: '' }

interface Props {
  open: boolean
  plant?: Plant | null
  onClose: () => void
  onSaved?: (plant: Plant) => void
}

/** Mounted only while open, so every opening starts from the plant's current values. */
export function PlantFormDialog(props: Props) {
  return props.open ? <PlantFormInner {...props} /> : null
}

function PlantFormInner({ open, plant, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() =>
    plant
      ? {
          nickname: plant.nickname,
          species_key: plant.species_key,
          species: plant.species,
          location: plant.location,
          acquired_on: plant.acquired_on ?? '',
          notes: plant.notes,
        }
      : empty,
  )
  const [file, setFile] = useState<File | null>(null)
  const preview = useObjectUrl(file)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | 'photo' | 'form', string>>>({})
  const [busy, setBusy] = useState(false)
  const invalidate = useInvalidateData()

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))
  const supported = SPECIES.find((s) => s.value === form.species_key)?.supported

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!form.nickname.trim()) errs.nickname = 'Please give your plant a name.'
    if (form.acquired_on && form.acquired_on > todayIso()) errs.acquired_on = "This date can't be in the future."
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const body = { ...form, acquired_on: form.acquired_on || null }
      let saved = plant
        ? await api<Plant>(`/api/plants/${plant.id}`, { method: 'PATCH', json: body })
        : await api<Plant>('/api/plants', { method: 'POST', json: body })
      if (file) {
        const fd = new FormData()
        fd.set('file', file)
        fd.set('plant_id', String(saved.id))
        try {
          const photo = await uploadWithProgress<Photo>('/api/photos', fd, () => {}).promise
          saved = await api<Plant>(`/api/plants/${saved.id}`, { method: 'PATCH', json: { cover_photo_id: photo.id } })
        } catch (err) {
          // The plant is saved; report the photo problem without losing the form.
          await invalidate()
          setErrors({ photo: `${saved.nickname} was saved, but the photo wasn't: ${errorMessage(err)}` })
          setBusy(false)
          return
        }
      }
      await invalidate()
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plant ? `Edit ${plant.nickname}` : 'Add a plant'}
      description={plant ? undefined : 'Every plant gets its own journal.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plant-form" busy={busy}>
            {plant ? 'Save changes' : 'Add plant'}
          </Button>
        </>
      }
    >
      <form id="plant-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="Nickname" error={errors.nickname} className="sm:col-span-2">
          <input className="field" value={form.nickname} onChange={(e) => set('nickname', e.target.value)} maxLength={80} />
        </Field>
        <Field
          label="Kind of plant"
          hint={
            supported
              ? 'Leaf photos of this plant can be analysed.'
              : 'You can journal this plant. The image model doesn’t cover it yet.'
          }
        >
          <select className="field" value={form.species_key} onChange={(e) => set('species_key', e.target.value as SpeciesKey)}>
            {SPECIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Species or variety" optional>
          <input
            className="field"
            value={form.species}
            onChange={(e) => set('species', e.target.value)}
            placeholder="e.g. San Marzano"
            maxLength={120}
          />
        </Field>
        <Field label="Location" optional>
          <input
            className="field"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="e.g. Kitchen window"
            maxLength={120}
          />
        </Field>
        <Field label="Date acquired" optional error={errors.acquired_on}>
          <input className="field" type="date" max={todayIso()} value={form.acquired_on} onChange={(e) => set('acquired_on', e.target.value)} />
        </Field>
        <Field label="Notes" optional className="sm:col-span-2">
          <textarea className="field" value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={4000} />
        </Field>
        <Field label={plant?.cover ? 'Replace photo' : 'Photo'} optional error={errors.photo} className="sm:col-span-2">
          <input
            className="field file:mr-3 file:rounded-md file:border-0 file:bg-sage-soft file:px-3 file:py-1.5 file:text-forest"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
        {preview && (
          <img src={preview} alt="Selected plant photo preview" className="h-40 w-full rounded-xl object-cover sm:col-span-2" />
        )}
        {errors.form && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  )
}
