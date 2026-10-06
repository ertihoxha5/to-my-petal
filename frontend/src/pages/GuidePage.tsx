import { motion } from 'motion/react'
import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router'
import { SPECIES } from '../components/domain'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, PageHeader, Skeleton, stagger } from '../components/ui'
import { errorMessage } from '../lib/api'
import { useGuide } from '../lib/queries'
import type { GuideArticle } from '../lib/types'

function ArticleCard({ a }: { a: GuideArticle }) {
  return (
    <motion.li variants={stagger.item}>
      <Link to={`/care-guide/${a.slug}`} className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-[1.35rem] leading-tight">{a.title}</h3>
          <Icon name="chevronRight" size={18} className="mt-1 text-forest transition-transform group-hover:translate-x-0.5" />
        </div>
        <p className="mt-2 line-clamp-3 text-[0.95rem] text-ink/85">{a.summary}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          {a.plants.map((p) => (
            <span key={p} className="rounded-full bg-sage-soft px-2.5 py-0.5 text-xs text-ink">
              {SPECIES.find((s) => s.value === p)?.label}
            </span>
          ))}
          {a.classifier_label && (
            <span className="rounded-full bg-blush-soft px-2.5 py-0.5 text-xs text-blush-ink" title="The image model was trained on this condition">
              In the image model
            </span>
          )}
        </div>
      </Link>
    </motion.li>
  )
}

export default function GuidePage() {
  const [q, setQ] = useState('')
  const [plant, setPlant] = useState('')
  const query = useDeferredValue(q)
  const { data, isPending, error, refetch } = useGuide({ q: query, plant })
  const plants = data?.articles.filter((a) => a.kind === 'plant') ?? []
  const conditions = data?.articles.filter((a) => a.kind === 'condition') ?? []

  return (
    <>
      <PageHeader title="Care guide" subtitle="Curated from university extension services, with sources for every page." />
      <div className="mb-7 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <label htmlFor="guide-search" className="sr-only">
            Search the care guide
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            id="guide-search"
            type="search"
            className="field pl-10"
            placeholder="Search symptoms or plants, e.g. “yellow spots”"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by plant">
          <button type="button" className="chip" aria-pressed={plant === ''} onClick={() => setPlant('')}>
            All
          </button>
          {SPECIES.filter((s) => s.value !== 'other').map((s) => (
            <button key={s.value} type="button" className="chip" aria-pressed={plant === s.value} onClick={() => setPlant(plant === s.value ? '' : s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : data.articles.length === 0 ? (
        <div className="card">
          <EmptyState icon="search" title="Nothing found">
            Try fewer words, like “spots” or “curl”.
          </EmptyState>
        </div>
      ) : (
        <>
          {conditions.length > 0 && (
            <section aria-labelledby="conditions" className="mb-10">
              <h2 id="conditions" className="title-md mb-4">
                Common symptoms and conditions
              </h2>
              <motion.ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" variants={stagger.container} initial="hidden" animate="show">
                {conditions.map((a) => (
                  <ArticleCard key={a.slug} a={a} />
                ))}
              </motion.ul>
            </section>
          )}
          {plants.length > 0 && (
            <section aria-labelledby="plants">
              <h2 id="plants" className="title-md mb-4">
                General care
              </h2>
              <motion.ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" variants={stagger.container} initial="hidden" animate="show">
                {plants.map((a) => (
                  <ArticleCard key={a.slug} a={a} />
                ))}
              </motion.ul>
            </section>
          )}
          <p className="mt-10 max-w-2xl text-sm text-muted">{data.treatment_note}</p>
        </>
      )}
    </>
  )
}
