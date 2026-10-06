import { useState } from 'react'
import type { Outcome, ReminderKind, SpeciesKey } from '../lib/types'
import { Icon, type IconName } from './Icon'
import { Badge } from './ui'

export const SPECIES: { value: SpeciesKey; label: string; supported: boolean }[] = [
  { value: 'tomato', label: 'Tomato', supported: true },
  { value: 'potato', label: 'Potato', supported: true },
  { value: 'pepper_bell', label: 'Bell pepper', supported: true },
  { value: 'basil', label: 'Basil', supported: false },
  { value: 'monstera', label: 'Monstera', supported: false },
  { value: 'other', label: 'Something else', supported: false },
]
export const speciesLabel = (k: SpeciesKey) => SPECIES.find((s) => s.value === k)?.label ?? 'Plant'

export const REMINDER_KINDS: { value: ReminderKind; label: string }[] = [
  { value: 'water', label: 'Water' },
  { value: 'wipe_leaves', label: 'Wipe leaves' },
  { value: 'rotate_light', label: 'Rotate for light' },
  { value: 'check_light', label: 'Check the light' },
  { value: 'mist', label: 'Mist' },
  { value: 'feed', label: 'Feed' },
  { value: 'custom', label: 'Something else' },
]

const OUTCOME: Record<Outcome, { label: string; tone: 'warn' | 'ok' | 'info' | 'neutral'; icon: IconName }> = {
  possible_issue: { label: 'Possible leaf issue', tone: 'warn', icon: 'alert' },
  no_known_issue: { label: 'No known issue found', tone: 'ok', icon: 'check' },
  inconclusive: { label: 'Inconclusive', tone: 'info', icon: 'question' },
  unsupported_image: { label: 'Inconclusive image', tone: 'info', icon: 'question' },
  unsupported_species: { label: 'Not supported yet', tone: 'neutral', icon: 'info' },
  model_unavailable: { label: 'Analysis unavailable', tone: 'neutral', icon: 'clock' },
}

export function OutcomeBadge({ outcome, className }: { outcome: Outcome; className?: string }) {
  const o = OUTCOME[outcome]
  return (
    <Badge tone={o.tone} icon={o.icon} className={className}>
      {o.label}
    </Badge>
  )
}

export const STRENGTH_LABEL = {
  closer: 'Closest match',
  partial: 'Partial match',
  weak: 'Weak match',
} as const

/** Lazy-loaded photo with a calm placeholder and an honest failure state. */
export function PlantPhoto({
  src,
  alt,
  className = '',
  eager = false,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  if (!src || failed) {
    return (
      <div
        className={`grid place-items-center bg-sage-soft text-forest/60 ${className}`}
        role="img"
        aria-label={src ? `${alt} (photo couldn't load)` : 'No photo yet'}
      >
        <Icon name="image" size={28} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={() => setLoaded(true)}
      className={`bg-sage-soft object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  )
}

export const CONTEXT_LABELS: Record<string, Record<string, string>> = {
  symptoms_started: {
    today: 'Today',
    this_week: 'This week',
    few_weeks: 'A few weeks ago',
    longer: 'Longer ago',
    not_sure: 'Not sure',
  },
  watering: {
    daily: 'Every day',
    every_few_days: 'Every few days',
    weekly: 'About once a week',
    less_often: 'Less often',
    not_sure: 'Not sure',
  },
  light: {
    full_sun: 'Full sun',
    partial_sun: 'Part sun',
    bright_indirect: 'Bright, indirect light',
    low_light: 'Low light',
    not_sure: 'Not sure',
  },
}
