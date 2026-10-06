import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { OutcomeBadge, PlantPhoto } from '../components/domain'
import { Icon } from '../components/Icon'
import { Button, ButtonLink, EmptyState, ErrorState, PageHeader, Skeleton, stagger } from '../components/ui'
import { useI18n } from '../i18n'
import { errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { useAnalyses } from '../lib/queries'

const PAGE = 12

export default function AnalysesPage() {
  const [offset, setOffset] = useState(0)
  const { data, isPending, error, refetch, isPlaceholderData } = useAnalyses({ limit: PAGE, offset })
  const { locale } = useI18n()

  return (
    <>
      <PageHeader
        title="Plant analyses"
        subtitle="Every leaf photo you’ve asked about, newest first."
        actions={
          <ButtonLink to="/analyze" icon="upload">
            New analysis
          </ButtonLink>
        }
      />
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <div className="card">
          <EmptyState icon="scan" title="No analyses yet" action={<ButtonLink to="/analyze">Upload a leaf photo</ButtonLink>}>
            Analyses work for tomato, potato and bell pepper leaves.
          </EmptyState>
        </div>
      ) : (
        <>
          <motion.ul
            className={`grid gap-4 md:grid-cols-2 ${isPlaceholderData ? 'opacity-60' : ''}`}
            variants={stagger.container}
            initial="hidden"
            animate="show"
            key={offset}
          >
            {data.items.map((a) => (
              <motion.li key={a.id} variants={stagger.item}>
                <Link to={`/analyses/${a.id}`} className="card group flex gap-4 p-3.5 transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <PlantPhoto src={a.photo.thumb_url} alt={`Leaf photo of ${a.plant_name}`} className="size-24 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-[1.2rem] leading-tight">{a.plant_name}</p>
                      <Icon name="chevronRight" size={18} className="text-forest" />
                    </div>
                    <p className="text-sm text-muted">{formatDate(a.created_at, locale)}</p>
                    <OutcomeBadge outcome={a.outcome} className="mt-2" />
                    <p className="mt-1.5 truncate text-sm text-ink/80">{a.result.headline}</p>
                  </div>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
          {data.total > PAGE && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                Previous
              </Button>
              <span className="text-sm text-muted">
                {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}
              </span>
              <Button variant="secondary" size="sm" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  )
}
