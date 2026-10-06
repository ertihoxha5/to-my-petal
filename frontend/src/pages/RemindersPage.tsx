import { useState } from 'react'
import { ReminderDialog, ReminderRow } from '../components/Reminders'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'
import { errorMessage } from '../lib/api'
import { daysFromToday } from '../lib/format'
import { useReminders } from '../lib/queries'
import type { Reminder } from '../lib/types'

export default function RemindersPage() {
  const { data, isPending, error, refetch } = useReminders('active')
  const [editing, setEditing] = useState<Reminder | null | undefined>(undefined)
  const groups: [string, Reminder[]][] = data
    ? [
        ['Due now', data.filter((r) => daysFromToday(r.due_on) <= 0)],
        ['This week', data.filter((r) => daysFromToday(r.due_on) > 0 && daysFromToday(r.due_on) <= 7)],
        ['Later', data.filter((r) => daysFromToday(r.due_on) > 7)],
      ]
    : []

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="A moment for your plants"
        subtitle="Small steps today, a happier tomorrow. Completing a reminder logs it in the plant’s journal."
        actions={
          <Button icon="plus" onClick={() => setEditing(null)}>
            New reminder
          </Button>
        }
      />
      {isPending ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState icon="bell" title="No reminders yet" action={<Button icon="plus" onClick={() => setEditing(null)}>Add a reminder</Button>}>
            Watering, wiping leaves, rotating for light: small rhythms you’d like to keep.
          </EmptyState>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups
            .filter(([, list]) => list.length)
            .map(([title, list]) => (
              <section key={title} className="card px-5 py-3 sm:px-6" aria-labelledby={`g-${title}`}>
                <h2 id={`g-${title}`} className="pt-2 font-serif text-[1.3rem]">
                  {title}
                </h2>
                <ul className="divide-y divide-line">
                  {list.map((r) => (
                    <ReminderRow key={r.id} reminder={r} onEdit={() => setEditing(r)} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      <ReminderDialog open={editing !== undefined} reminder={editing ?? null} onClose={() => setEditing(undefined)} />
    </div>
  )
}
