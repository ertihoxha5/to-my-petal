export type SpeciesKey = 'tomato' | 'potato' | 'pepper_bell' | 'basil' | 'monstera' | 'other'
export type ReminderKind = 'water' | 'wipe_leaves' | 'rotate_light' | 'check_light' | 'mist' | 'feed' | 'custom'
export type JournalKind = 'observation' | 'photo' | 'analysis' | 'care'
export type Outcome =
  | 'possible_issue'
  | 'no_known_issue'
  | 'inconclusive'
  | 'unsupported_species'
  | 'unsupported_image'
  | 'model_unavailable'

export interface User {
  id: number
  email: string
  display_name: string
  locale: 'en' | 'sq'
  motion_preference: 'system' | 'reduce' | 'full'
  created_at: string
}

export interface PhotoBrief {
  id: number
  taken_on: string
  url: string
  thumb_url: string
  description: string
}

export interface Photo extends PhotoBrief {
  plant_id: number | null
  width: number
  height: number
  is_example: boolean
  created_at: string
}

export interface Plant {
  id: number
  nickname: string
  species: string
  species_key: SpeciesKey
  location: string
  acquired_on: string | null
  notes: string
  archived_at: string | null
  is_example: boolean
  created_at: string
  updated_at: string
  cover: PhotoBrief | null
  analysis_supported: boolean
  entry_count: number
  last_entry_on: string | null
}

export interface Hypothesis {
  label: string
  crop: string
  condition: string
  healthy: boolean
  guide_slug: string
  summary: string
  strength: 'closer' | 'partial' | 'weak'
  calibrated_score: number
}

export interface ModelInfo {
  available: boolean
  version: string | null
  unavailable_reason: string | null
  controlled_test_macro_f1: number | null
  real_world_macro_f1: number | null
}

export interface AnalysisResult {
  schema_version: 1
  outcome: Outcome
  headline: string
  explanation: string
  primary: Hypothesis | null
  alternatives: Hypothesis[]
  reasons: string[]
  limitations: string[]
  quality: { brightness: number; sharpness: number; plant_fraction?: number | null; issues: string[] } | null
  model: ModelInfo
}

export interface ContextNote {
  text: string
  guide_slug: string | null
  source: 'care_guide'
}

export interface AnalysisContext {
  symptoms_started: string | null
  watering: string | null
  light: string | null
  recent_changes: string
}

export interface Analysis {
  id: number
  plant_id: number
  plant_name: string
  species_key: SpeciesKey
  photo: PhotoBrief
  outcome: Outcome
  model_version: string | null
  result: AnalysisResult
  context: AnalysisContext
  context_notes: ContextNote[]
  user_correction: string
  user_notes: string
  journal_entry_id: number | null
  created_at: string
}

export interface JournalEntry {
  id: number
  plant_id: number
  plant_name: string
  kind: JournalKind
  entry_date: string
  title: string
  body: string
  photo: PhotoBrief | null
  analysis: { id: number; outcome: Outcome; headline: string; condition: string | null } | null
  care_kind: ReminderKind | null
  is_example: boolean
  created_at: string
  updated_at: string
}

export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface Reminder {
  id: number
  plant_id: number | null
  plant_name: string | null
  kind: ReminderKind
  title: string
  notes: string
  due_on: string
  repeat_days: number | null
  last_completed_on: string | null
  active: boolean
}

export interface EvaluationBlock {
  description?: string
  images?: number
  accuracy?: number
  macro_f1?: number
  source?: string
  flagged_unfamiliar_fraction?: number
  would_show_finding_fraction?: number
  abstention?: { accepted_fraction: number; accuracy_on_accepted: number | null; flagged_unfamiliar_fraction: number }
}

export interface ModelStatus extends ModelInfo {
  supported_species: SpeciesKey[]
  classes: string[]
  evaluation: Partial<Record<'controlled_test' | 'near_ood' | 'real_world', EvaluationBlock>>
}

export interface PlantStory {
  plant: Plant
  entry_count: number
  latest_entry: JournalEntry | null
  recent_photos: PhotoBrief[]
}

export interface Dashboard {
  latest_analysis: Analysis | null
  stories: PlantStory[]
  reminders: Reminder[]
  plant_count: number
  has_examples: boolean
  model: ModelStatus
}

export interface GuideSource {
  title: string
  publisher: string
  url: string
  source_date: string
}

export interface GuideArticle {
  slug: string
  kind: 'plant' | 'condition'
  title: string
  plants: SpeciesKey[]
  summary: string
  looks_like: string[]
  care: string[]
  often_confused_with: string[]
  get_help_when: string
  sources: GuideSource[]
  classifier_label: boolean
  reviewed_on: string
  reviewed_by: string
  treatment_note: string
  tags: string[]
}
