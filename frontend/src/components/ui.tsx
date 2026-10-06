import { motion } from 'motion/react'
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link, type LinkProps } from 'react-router'
import { Icon, type IconName } from './Icon'

type Variant = 'primary' | 'secondary' | 'cream' | 'ghost' | 'danger' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-forest text-card hover:bg-forest-soft border border-forest',
  secondary: 'bg-card text-forest border border-forest hover:bg-sage-soft',
  cream: 'bg-card text-forest border border-card hover:bg-white shadow-[0_6px_20px_-8px_rgb(0_0_0/0.45)]',
  ghost: 'bg-transparent text-forest border border-transparent hover:bg-sage-soft',
  danger: 'bg-danger text-white border border-danger hover:bg-[#9b1f18]',
  quiet: 'bg-transparent text-muted border border-transparent hover:text-forest hover:bg-sage-soft',
}
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm gap-1.5 rounded-[0.6rem]',
  md: 'min-h-11 px-4.5 text-[0.95rem] gap-2 rounded-[0.7rem]',
  lg: 'min-h-14 px-7 text-[1.05rem] gap-3 rounded-full',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center font-medium select-none transition-[background,color,box-shadow,transform] duration-200 ease-[var(--ease-petal)] active:translate-y-px disabled:opacity-55 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${extra}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconRight?: IconName
  busy?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, busy, children, className = '', disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <Spinner size={16} /> : icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
    </button>
  )
})

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  className = '',
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: IconName; iconRight?: IconName }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'lg' ? 22 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={16} />}
    </Link>
  )
}

export function TextLink({ children, className = '', ...rest }: LinkProps) {
  return (
    <Link
      className={`inline-flex items-center gap-1.5 text-sm text-forest underline-offset-4 hover:underline ${className}`}
      {...rest}
    >
      {children}
    </Link>
  )
}

/** Label + control + hint + error, wired with ids for assistive tech. */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className = '',
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  optional?: boolean
  children: ReactElement<Record<string, unknown>>
  className?: string
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
      })
    : children
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[0.92rem] font-medium text-ink">
        {label}
        {optional && <span className="ml-1.5 font-normal text-muted">(optional)</span>}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="flex items-start gap-1.5 text-sm text-danger">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

type BadgeTone = 'warn' | 'ok' | 'info' | 'neutral' | 'blush' | 'danger'
const badgeTones: Record<BadgeTone, string> = {
  warn: 'bg-warn-bg text-warn',
  ok: 'bg-ok-bg text-ok',
  info: 'bg-info-bg text-forest',
  neutral: 'bg-sage-soft text-ink',
  blush: 'bg-blush-soft text-blush-ink',
  danger: 'bg-danger-bg text-danger',
}

export function Badge({ tone = 'neutral', icon, children, className = '' }: {
  tone?: BadgeTone
  icon?: IconName
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.85rem] font-medium leading-tight ${badgeTones[tone]} ${className}`}
    >
      {icon && <Icon name={icon} size={15} strokeWidth={1.8} />}
      {children}
    </span>
  )
}

export function ExampleBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-blush-ink/30 bg-blush-soft px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-blush-ink ${className}`}
      title="Example content, not your own records"
    >
      Example
    </span>
  )
}

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

export function EmptyState({
  icon = 'sprout',
  title,
  children,
  action,
  className = '',
}: {
  icon?: IconName
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`}>
      <span className="mb-4 grid size-14 place-items-center rounded-full bg-sage-soft text-forest">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="title-md">{title}</h3>
      {children && <div className="mt-2 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry, className = '' }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={`flex flex-col items-start gap-3 rounded-[var(--radius-soft)] bg-danger-bg p-4 text-danger ${className}`}>
      <p className="flex items-start gap-2">
        <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <motion.h1
          className="title-lg"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {title}
        </motion.h1>
        {subtitle && <p className="mt-2 text-[1.05rem] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  )
}

/** Staggered entrance for lists of cards. */
export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } },
  item: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } },
  },
}
