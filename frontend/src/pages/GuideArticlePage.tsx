import { Link, useParams } from 'react-router'
import { Sprig } from '../components/Botanical'
import { SPECIES } from '../components/domain'
import { Icon } from '../components/Icon'
import { ErrorState, Skeleton } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { useArticle } from '../lib/queries'

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <section className="mt-8">
      <h2 className="title-md">{title}</h2>
      <ul className="prose-guide mt-3 list-disc pl-5 text-[1.05rem] text-ink/90 marker:text-leaf">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  )
}

export default function GuideArticlePage() {
  const { slug = '' } = useParams()
  const { data: a, isPending, error, refetch } = useArticle(slug)
  const { locale } = useI18n()

  if (isPending) return <Skeleton className="h-96" />
  if (error || !a) return <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />

  return (
    <article className="relative mx-auto max-w-3xl">
      <Sprig className="pointer-events-none absolute top-0 -right-6 hidden h-48 w-12 opacity-60 sm:block" />
      <Link to="/care-guide" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-forest">
        <Icon name="arrowLeft" size={16} /> Care guide
      </Link>
      <p className="eyebrow text-muted">{a.kind === 'condition' ? 'Condition' : 'Plant care'}</p>
      <h1 className="title-lg mt-2">{a.title}</h1>
      <p className="mt-3 text-[1.15rem] text-ink/90">{a.summary}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {a.plants.map((p) => (
          <span key={p} className="rounded-full bg-sage-soft px-3 py-1 text-sm">
            {SPECIES.find((s) => s.value === p)?.label}
          </span>
        ))}
      </div>

      <List title="What it can look like" items={a.looks_like} />
      <List title={a.kind === 'condition' ? 'Gentle, practical steps' : 'Care basics'} items={a.care} />
      <List title="Easily confused with" items={a.often_confused_with} />

      {a.get_help_when && (
        <section className="mt-8 rounded-[var(--radius-card)] bg-warn-bg/70 p-5">
          <h2 className="flex items-center gap-2 font-serif text-[1.25rem] text-warn">
            <Icon name="alert" size={18} /> When to ask for help
          </h2>
          <p className="mt-1.5">{a.get_help_when} A local extension service or plant clinic can confirm what’s going on.</p>
        </section>
      )}

      <p className="mt-6 text-sm text-muted">{a.treatment_note}</p>

      <section className="mt-10 border-t border-line pt-6">
        <h2 className="font-serif text-[1.25rem]">Sources</h2>
        <ul className="mt-3 space-y-3">
          {a.sources.map((s) => (
            <li key={s.url} className="text-[0.95rem]">
              <a href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-forest underline underline-offset-4">
                {s.title} <Icon name="external" size={14} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <span className="block text-sm text-muted">
                {s.publisher} · {s.source_date}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          Summary last reviewed {formatDate(a.reviewed_on, locale)} by {a.reviewed_by}.
        </p>
      </section>
    </article>
  )
}
