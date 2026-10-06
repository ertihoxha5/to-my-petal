import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Button } from './ui'

/**
 * Modal built on the native <dialog> element: the browser provides focus
 * containment, Escape handling and an inert background. Focus returns to the
 * element that opened it. On phones it presents as a bottom sheet.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      const opener = document.activeElement as HTMLElement | null
      el.showModal()
      return () => {
        if (el.open) el.close()
        opener?.focus?.()
      }
    }
  }, [open])

  if (!open) return null
  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size]

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // backdrop click
      }}
      className={`m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[rgb(24_37_28/0.42)] backdrop:backdrop-blur-[2px] sm:m-auto ${width}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="card safe-bottom flex max-h-[92dvh] flex-col rounded-b-none sm:rounded-b-[var(--radius-card)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pt-5 pb-4 sm:px-7">
          <div>
            <h2 id={titleId} className="title-md">
              {title}
            </h2>
            {description && (
              <div id={descId} className="mt-1.5 text-[0.95rem] text-muted">
                {description}
              </div>
            )}
          </div>
          <Button variant="quiet" size="sm" onClick={onClose} aria-label="Close" className="-mr-2 shrink-0">
            <Icon name="close" size={20} />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-5 sm:px-7">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-line px-5 py-4 sm:px-7">{footer}</div>
        )}
      </motion.div>
    </dialog>
  )
}

/** Confirmation for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Delete',
  busy,
  error,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  children: ReactNode
  confirmLabel?: string
  busy?: boolean
  error?: string | null
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-ink">{children}</div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  )
}

/** Small helper for "open a dialog for this item" state. */
// eslint-disable-next-line react-refresh/only-export-components
export function useDialog<T = true>() {
  const [item, setItem] = useState<T | null>(null)
  return { item, open: (v: T) => setItem(v), close: () => setItem(null), isOpen: item !== null }
}
