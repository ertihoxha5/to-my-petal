import { ButtonLink, EmptyState } from '../components/ui'

export default function NotFoundPage() {
  return (
    <div className="card mx-auto max-w-xl">
      <EmptyState icon="leaf" title="This page has wandered off" action={<ButtonLink to="/">Back to my garden</ButtonLink>}>
        The link may be old, or the item was deleted.
      </EmptyState>
    </div>
  )
}
