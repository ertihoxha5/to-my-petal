import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n'
import { api, errorMessage } from '../lib/api'
import { daysFromToday, dueLabel, todayIso } from '../lib/format'
import { useDataMutation, usePlants } from '../lib/queries'
import type { Reminder, ReminderKind } from '../lib/types'
import { ConfirmDialog, Dialog } from './Dialog'
import { REMINDER_KINDS } from './domain'
import { Icon, reminderIcon } from './Icon'
import { useToast } from './Toast'
import { Button, Field } from './ui'

interface Form {
  kind: ReminderKind
  title: string
  plant_id: string
  due_on: string
  repeat_days: string
  notes: string
}

const kindTitle = (k: ReminderKind) => REMINDER_KINDS.find((x) => x.value === k)?.label ?? 'Care'

interface DialogProps {
  open: boolean
  reminder?: Reminder | null
  onClose: () => void
}

/** Mounted only while open, so each opening starts from the reminder's current values. */
export function ReminderDialog(props: DialogProps) {
  return props.open ? <ReminderDialogInner {...props} /> : null
}

function ReminderDialogInner({ open, reminder, onClose }: DialogProps) {
  const { data: plants = [] } = usePlants({ state: 'active' })
  const ownPlants = plants.filter((p) => !p.is_example)
  const [form, setForm] = useState<Form>(() =>
    reminder
      ? {
          kind: reminder.kind,
          title: reminder.title,
          plant_id: reminder.plant_id ? String(reminder.plant_id) : '',
          due_on: reminder.due_on,
          repeat_days: reminder.repeat_days ? String(reminder.repeat_days) : '',
          notes: reminder.notes,
        }
      : { kind: 'water', title: 'Water', plant_id: '', due_on: todayIso(), repeat_days: '7', notes: '' },
  )
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const save = useDataMutation(async (f: Form) => {
    const body = {
      kind: f.kind,
      title: f.title.trim() || kindTitle(f.kind),
      plant_id: f.plant_id ? Number(f.plant_id) : null,
      due_on: f.due_on,
      notes: f.notes,
      ...(f.repeat_days ? { repeat_days: Number(f.repeat_days) } : reminder ? { clear_repeat: true } : {}),
    }
    return reminder
      ? api(`/api/reminders/${reminder.id}`, { method: 'PATCH', json: body })
      : api('/api/reminders', { method: 'POST', json: body })
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = Number(form.repeat_days)
    if (form.repeat_days && (!Number.isInteger(n) || n < 1 || n > 365)) {
      setError('Repeat every 1 to 365 days, or leave it empty for a one-off reminder.')
      return
    }
    if (!form.due_on) {
      setError('Please choose a date.')
      return
    }
    save.mutate(form, {
      onSuccess: () => {
        toast(reminder ? 'Reminder updated' : 'Reminder added')
        onClose()
      },
      onError: (err) => setError(errorMessage(err)),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={reminder ? 'Edit reminder' : 'New care reminder'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reminder-form" busy={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="reminder-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <Field label="What">
          <select
            className="field"
            value={form.kind}
            onChange={(e) => {
              const kind = e.target.value as ReminderKind
              setForm((f) => ({ ...f, kind, title: f.title === kindTitle(f.kind) ? kindTitle(kind) : f.title }))
            }}
          >
            {REMINDER_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input className="field" value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Plant" optional hint={plants.some((p) => p.is_example) ? 'Example plants can’t have reminders.' : undefined}>
          <select className="field" value={form.plant_id} onChange={(e) => setForm({ ...form, plant_id: e.target.value })}>
            <option value="">Any plant</option>
            {ownPlants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due on">
          <input className="field" type="date" value={form.due_on} onChange={(e) => setForm({ ...form, due_on: e.target.value })} />
        </Field>
        <Field label="Repeat every (days)" optional hint="Leave empty for a one-off reminder.">
          <input
            className="field"
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            value={form.repeat_days}
            onChange={(e) => setForm({ ...form, repeat_days: e.target.value })}
          />
        </Field>
        <Field label="Notes" optional className="sm:col-span-2">
          <textarea className="field" value={form.notes} maxLength={1000} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

export function ReminderRow({ reminder, onEdit, compact = false }: { reminder: Reminder; onEdit: () => void; compact?: boolean }) {
  const { locale } = useI18n()
  const toast = useToast()
  const [confirm, setConfirm] = useState(false)
  const overdue = daysFromToday(reminder.due_on) < 0
  const complete = useDataMutation(() => api(`/api/reminders/${reminder.id}/complete`, { method: 'POST', json: {} }))
  const snooze = useDataMutation((days: number) =>
    api(`/api/reminders/${reminder.id}`, { method: 'PATCH', json: { due_on: todayIso(days) } }),
  )
  const remove = useDataMutation(() => api(`/api/reminders/${reminder.id}`, { method: 'DELETE' }))

  return (
    <motion.li layout className="flex items-center gap-3.5 py-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sage-soft text-forest">
        <Icon name={reminderIcon[reminder.kind]} size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-serif text-[1.08rem] leading-snug">{reminder.title}</p>
        <p className={`text-sm ${overdue ? 'text-warn' : 'text-muted'}`}>
          {reminder.plant_name ? `${reminder.plant_name} · ` : ''}
          {dueLabel(reminder.due_on, locale)}
          {reminder.repeat_days ? ` · every ${reminder.repeat_days} d` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="secondary"
          size="sm"
          icon="check"
          busy={complete.isPending}
          aria-label={`Mark "${reminder.title}" done`}
          onClick={() =>
            complete.mutate(undefined, {
              onSuccess: () => toast(reminder.plant_name ? `Logged in ${reminder.plant_name}'s journal` : 'Done'),
              onError: (e) => toast(errorMessage(e), 'error'),
            })
          }
        >
          {compact ? <span className="sr-only sm:not-sr-only">Done</span> : 'Done'}
        </Button>
        {!compact && (
          <>
            <Button variant="quiet" size="sm" onClick={() => snooze.mutate(1)} busy={snooze.isPending} aria-label={`Move "${reminder.title}" to tomorrow`}>
              <Icon name="clock" size={18} />
              <span className="hidden sm:inline">Tomorrow</span>
            </Button>
            <Button variant="quiet" size="sm" onClick={onEdit} aria-label={`Edit "${reminder.title}"`}>
              <Icon name="edit" size={18} />
            </Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirm(true)} aria-label={`Delete "${reminder.title}"`}>
              <Icon name="trash" size={18} />
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this reminder?"
        busy={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirm(false) })}
      >
        “{reminder.title}” will be removed. Past care entries in the journal stay.
      </ConfirmDialog>
    </motion.li>
  )
}
