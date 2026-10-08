/**
 * Demo mode: an in-browser stand-in for the FastAPI backend.
 *
 * When demo mode is on, `api()` and `uploadWithProgress()` route here instead of the
 * network. Data lives in localStorage, so a visitor can explore every screen (add plants,
 * write journal entries, run sample analyses, tick reminders) with no server at all.
 * Analyses in demo mode are canned samples and say so in their limitations.
 */
import type {
  Analysis,
  AnalysisContext,
  AnalysisResult,
  ContextNote,
  GuideArticle,
  Hypothesis,
  JournalEntry,
  ModelStatus,
  Outcome,
  Photo,
  PhotoBrief,
  Plant,
  Reminder,
  ReminderKind,
  SpeciesKey,
  User,
} from '../lib/types'
import guide from './guide.json'

const FLAG_KEY = 'tmp.demo'
const DB_KEY = 'tmp.demo.db'

const photoAssets = import.meta.glob<string>('./photos/*.jpg', { eager: true, import: 'default', query: '?url' })
const ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(photoAssets).map(([path, url]) => [path.replace('./photos/', '').replace('.jpg', ''), url]),
)

export class DemoError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// ---- Mode flag -----------------------------------------------------------------

export function isDemo(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

/** Turn demo mode on with a fresh garden. */
export function startDemo() {
  try {
    localStorage.setItem(FLAG_KEY, '1')
    localStorage.removeItem(DB_KEY)
  } catch {
    /* storage unavailable: the demo still works for this page load */
  }
  memory = seed()
  save()
}

export function stopDemo() {
  try {
    localStorage.removeItem(FLAG_KEY)
    localStorage.removeItem(DB_KEY)
  } catch {
    /* ignore */
  }
  memory = null
}

// ---- Storage -------------------------------------------------------------------

interface PlantRow extends Omit<Plant, 'cover' | 'analysis_supported' | 'entry_count' | 'last_entry_on'> {
  cover_photo_id: number | null
}
interface PhotoRow extends Omit<Photo, 'url' | 'thumb_url'> {
  src: string // "asset:<name>" for bundled photos, otherwise a data: URL
}
interface EntryRow {
  id: number
  plant_id: number
  kind: JournalEntry['kind']
  entry_date: string
  title: string
  body: string
  photo_id: number | null
  analysis_id: number | null
  care_kind: ReminderKind | null
  is_example: boolean
  created_at: string
  updated_at: string
}
interface AnalysisRow {
  id: number
  plant_id: number
  photo_id: number
  outcome: Outcome
  model_version: string | null
  result: AnalysisResult
  context: AnalysisContext
  user_correction: string
  user_notes: string
  created_at: string
}
type ReminderRow = Omit<Reminder, 'plant_name'>

interface Db {
  next: number
  user: User
  plants: PlantRow[]
  photos: PhotoRow[]
  entries: EntryRow[]
  analyses: AnalysisRow[]
  reminders: ReminderRow[]
}

let memory: Db | null = null

function db(): Db {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) memory = JSON.parse(raw) as Db
  } catch {
    memory = null
  }
  if (!memory) {
    memory = seed()
    save()
  }
  return memory
}

function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(memory))
  } catch {
    // Quota exceeded (usually from many uploaded photos). Keep working in memory.
  }
}

const id = () => db().next++

// ---- Dates ---------------------------------------------------------------------

function isoDay(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const nowIso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString()
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

// ---- Model & content -----------------------------------------------------------

const SUPPORTED: SpeciesKey[] = ['tomato', 'potato', 'pepper_bell']
const CROP_NAME: Record<string, string> = { tomato: 'tomato', potato: 'potato', pepper_bell: 'bell pepper' }

const MODEL: ModelStatus = {
  available: true,
  version: 'demo-sample',
  unavailable_reason: null,
  controlled_test_macro_f1: 0.9928,
  real_world_macro_f1: 0.5474,
  supported_species: SUPPORTED,
  classes: [],
  evaluation: {
    controlled_test: {
      description:
        'PlantVillage leaf-grouped test split. Lab-style photos of single leaves on plain backgrounds; NOT representative of photos taken in a garden or home.',
      images: 3434,
      accuracy: 0.993,
      macro_f1: 0.9928,
      abstention: { accepted_fraction: 0.8631, accuracy_on_accepted: 1.0, flagged_unfamiliar_fraction: 0.0079 },
    },
    near_ood: {
      description:
        'Leaves of 11 other PlantVillage crops (apple, grape, corn, ...). The model should not present findings for these.',
      images: 660,
      flagged_unfamiliar_fraction: 0.5606,
      would_show_finding_fraction: 0.0818,
    },
    real_world: {
      description:
        'Held-out PlantDoc photos (30% of PlantDoc, near-duplicates grouped, never used for training, calibration or model selection). Different source, backgrounds and lighting.',
      images: 310,
      accuracy: 0.5452,
      macro_f1: 0.5474,
      abstention: { accepted_fraction: 0.2161, accuracy_on_accepted: 0.791, flagged_unfamiliar_fraction: 0.2226 },
      source: 'PlantDoc held-out split, CC BY 4.0',
    },
  },
}

const LIMITATIONS = [
  'Demo mode: this is a sample result to show how the app works. No model looked at your photo.',
  'The model learned from lab-style photos of single leaves (PlantVillage). Photos taken in a garden or at home are harder for it, and it is less reliable on them.',
  'It only knows a few conditions of tomato, potato and bell pepper leaves. Anything else, such as nutrient problems, pests other than spider mites, sunscald or watering stress, cannot be detected.',
  'A photo alone cannot confirm a cause. For a serious or spreading problem, contact a local extension service or plant clinic.',
]

interface LabelInfo {
  label: string
  condition: string
  healthy: boolean
  guide_slug: string
  summary: string
}
const LABELS: Record<string, LabelInfo[]> = {
  tomato: [
    { label: 'Tomato___Septoria_leaf_spot', condition: 'Septoria leaf spot', healthy: false, guide_slug: 'septoria-leaf-spot', summary: 'many small round spots with darker edges and lighter centres' },
    { label: 'Tomato___Early_blight', condition: 'Early blight', healthy: false, guide_slug: 'early-blight', summary: 'brown spots with target-like rings, usually on older, lower leaves first' },
    { label: 'Tomato___Target_Spot', condition: 'Target spot', healthy: false, guide_slug: 'target-spot', summary: 'brown spots with light centres and faint rings' },
    { label: 'Tomato___healthy', condition: 'No known issue', healthy: true, guide_slug: 'tomato-care', summary: 'leaves resembling the healthy tomato leaves the model learned from' },
  ],
  potato: [
    { label: 'Potato___Early_blight', condition: 'Early blight', healthy: false, guide_slug: 'early-blight', summary: 'brown spots with concentric rings, often starting on older, lower leaves' },
    { label: 'Potato___Late_blight', condition: 'Late blight', healthy: false, guide_slug: 'late-blight', summary: 'large dark, greasy-looking patches that can spread quickly in cool, wet weather' },
    { label: 'Potato___healthy', condition: 'No known issue', healthy: true, guide_slug: 'potato-care', summary: 'leaves resembling the healthy potato leaves the model learned from' },
  ],
  pepper_bell: [
    { label: 'Pepper,_bell___Bacterial_spot', condition: 'Bacterial spot', healthy: false, guide_slug: 'bacterial-spot', summary: 'small water-soaked spots that turn brown, sometimes with yellowing around them' },
    { label: 'Pepper,_bell___healthy', condition: 'No known issue', healthy: true, guide_slug: 'bell-pepper-care', summary: 'leaves resembling the healthy pepper leaves the model learned from' },
  ],
}

function hyp(species: string, info: LabelInfo, score: number): Hypothesis {
  return {
    label: info.label,
    crop: species,
    condition: info.condition,
    healthy: info.healthy,
    guide_slug: info.guide_slug,
    summary: info.summary,
    strength: score >= 0.97 ? 'closer' : score >= 0.35 ? 'partial' : 'weak',
    calibrated_score: score,
  }
}

const modelInfo = () => ({
  available: MODEL.available,
  version: MODEL.version,
  unavailable_reason: MODEL.unavailable_reason,
  controlled_test_macro_f1: MODEL.controlled_test_macro_f1,
  real_world_macro_f1: MODEL.real_world_macro_f1,
})

/** A canned, deterministic sample result that mirrors the backend's wording. */
function sampleResult(plant: PlantRow, seedNum: number): AnalysisResult {
  const model = modelInfo()
  if (!SUPPORTED.includes(plant.species_key)) {
    return {
      schema_version: 1,
      outcome: 'unsupported_species',
      headline: 'This plant is not supported yet',
      explanation: `The image model currently knows only tomato, potato, bell pepper leaves, so it did not look at this photo of ${plant.nickname}. The photo and your notes can still go in the journal, where you can compare it with later photos.`,
      primary: null,
      alternatives: [],
      reasons: ['species_not_supported'],
      limitations: [],
      quality: null,
      model,
    }
  }
  const labels = LABELS[plant.species_key]
  const crop = CROP_NAME[plant.species_key]
  const quality = { brightness: 0.48, sharpness: 182.4, plant_fraction: 0.71, issues: [] }
  const pick = seedNum % 3
  if (pick === 2) {
    const a = hyp(plant.species_key, labels[0], 0.62)
    const b = hyp(plant.species_key, labels[1], 0.24)
    return {
      schema_version: 1,
      outcome: 'inconclusive',
      headline: 'This image is inconclusive',
      explanation: `The model's closest matches were ${a.condition.toLowerCase()} or ${b.condition.toLowerCase()}, but none was strong enough for us to suggest it. Compare the photo with the care guide, or try another photo of the most affected leaf.`,
      primary: null,
      alternatives: [a, b],
      reasons: ['low_confidence'],
      limitations: LIMITATIONS,
      quality,
      model,
    }
  }
  if (pick === 1) {
    const healthy = labels.find((l) => l.healthy)!
    return {
      schema_version: 1,
      outcome: 'no_known_issue',
      headline: 'No known issue found',
      explanation: `The model suggests this looks like a healthy ${crop} leaf. It only checks for the few conditions it learned, so keep watching anything that worries you and add a follow-up photo in a week or two.`,
      primary: hyp(plant.species_key, healthy, 0.988),
      alternatives: [],
      reasons: [],
      limitations: LIMITATIONS,
      quality,
      model,
    }
  }
  const info = labels[0]
  return {
    schema_version: 1,
    outcome: 'possible_issue',
    headline: `Possible ${info.condition.toLowerCase()}`,
    explanation: `The model suggests this leaf resembles ${info.condition.toLowerCase()}: ${info.summary}. Other things can cause similar marks, so treat this as a starting point, compare with the care guide, and watch how it develops.`,
    primary: hyp(plant.species_key, info, 0.981),
    alternatives: labels.length > 2 ? [hyp(plant.species_key, labels[1], 0.12)] : [],
    reasons: [],
    limitations: LIMITATIONS,
    quality,
    model,
  }
}

const OUTDOOR_VEG = ['tomato', 'potato', 'pepper_bell']
function contextNotes(species: string, c: AnalysisContext): ContextNote[] {
  const notes: ContextNote[] = []
  const add = (text: string, guide_slug: string | null) => notes.push({ text, guide_slug, source: 'care_guide' })
  if (c.watering === 'daily' && [...OUTDOOR_VEG, 'basil'].includes(species))
    add(
      'You water often. Many leaf-spot diseases spread on wet leaves, so water at the base of the plant, ideally in the morning, rather than over the foliage.',
      ({ tomato: 'tomato-care', potato: 'potato-care', pepper_bell: 'bell-pepper-care' } as Record<string, string>)[species] ??
        'basil-care',
    )
  if (c.watering === 'daily' && species === 'monstera')
    add('Monstera prefers the top quarter to third of its soil to dry before the next watering.', 'monstera-care')
  if (c.light === 'low_light' && OUTDOOR_VEG.includes(species))
    add(
      'Tomatoes, potatoes and peppers need plenty of light; low light leads to weak, spindly growth.',
      species === 'tomato' ? 'tomato-care' : null,
    )
  if (c.light === 'low_light' && species === 'basil')
    add('Basil grows best with at least about six hours of direct sun a day.', 'basil-care')
  if (c.light === 'full_sun' && species === 'monstera')
    add('Monstera likes bright light but can scorch in harsh direct sun.', 'monstera-care')
  if (c.symptoms_started === 'today' || c.symptoms_started === 'this_week')
    add(
      'These changes are recent. A follow-up photo from the same angle in about a week will help you see whether marks are spreading.',
      null,
    )
  if (c.recent_changes.trim())
    add(
      'You mentioned recent changes. Moving, repotting or sudden temperature changes can stress a plant, and stress can change how leaves look without any disease involved.',
      null,
    )
  return notes
}

// ---- Seed ----------------------------------------------------------------------

interface SeedPlant {
  plant: Pick<PlantRow, 'nickname' | 'species' | 'species_key' | 'location' | 'notes'> & { acquired_days: number }
  cover: [string, number, string]
  entries: [string | null, number, string, string, string, JournalEntry['kind']?][]
}

const SEED: SeedPlant[] = [
  {
    plant: {
      nickname: 'Rosa the Tomato',
      species: 'Tomato (Solanum lycopersicum)',
      species_key: 'tomato',
      location: 'Sunny balcony',
      notes: 'Grown from seed in March. Loves the afternoon sun and gets thirsty on hot days.',
      acquired_days: 190,
    },
    cover: ['example-tomato-cover', 14, 'Ripening tomatoes with raindrops'],
    entries: [
      [null, 21, 'First ripe tomato!', 'Picked the first red one this morning. Sweet, a little sharp. Worth every watering can.', ''],
      ['example-tomato-leaf-1', 7, 'Spots on lower leaves', 'Small round spots with pale centres on a few lower leaves. Removed the worst ones.', 'Tomato leaflets with many small, pale-centred spots', 'photo'],
      ['example-tomato-leaf-2', 0, 'Checked again', 'Some new spots appeared. Watering at the soil now instead of over the leaves.', 'Close-up of a tomato leaf with brown spots and yellowing', 'photo'],
    ],
  },
  {
    plant: {
      nickname: 'Basil Brush',
      species: 'Sweet basil (Ocimum basilicum)',
      species_key: 'basil',
      location: 'Kitchen window',
      notes: 'Pinch the tops often. Smells like summer.',
      acquired_days: 60,
    },
    cover: ['example-basil-cover', 12, 'A bed of bright green basil'],
    entries: [
      ['example-basil-1', 9, 'Pinched the flower buds', 'Plenty of new leaves this week.', 'Basil stems with broad glossy leaves', 'photo'],
      [null, 5, 'Pesto night', 'Harvested a big handful for pesto. It bounced right back.', ''],
      ['example-basil-2', 2, 'Looking full', 'New leaves look healthy and vibrant.', 'Basil plant with large green leaves', 'photo'],
    ],
  },
  {
    plant: {
      nickname: 'Monty',
      species: 'Monstera deliciosa',
      species_key: 'monstera',
      location: 'Living room',
      notes: 'A gift from Grandma. The new leaf is unfurling slowly.',
      acquired_days: 400,
    },
    cover: ['example-monstera-cover', 11, 'A Monstera leaf with its typical holes'],
    entries: [
      ['example-monstera-1', 10, 'Moved closer to the window', 'Bright, indirect light now.', 'A large split Monstera leaf', 'photo'],
      ['example-monstera-2', 1, 'Noticed less yellowing', 'Fewer yellow leaves after the move.', 'Monstera leaves growing outdoors', 'photo'],
    ],
  },
]

function seed(): Db {
  const d: Db = {
    next: 1,
    user: {
      id: 1,
      email: 'demo@tomypetal.app',
      display_name: 'Demo Gardener',
      locale: 'en',
      motion_preference: 'system',
      created_at: nowIso(-30),
    },
    plants: [],
    photos: [],
    entries: [],
    analyses: [],
    reminders: [],
  }
  memory = d
  d.next = 100
  for (const s of SEED) {
    const plantId = id()
    const cover = addPhoto(plantId, s.cover[0], s.cover[1], s.cover[2], false)
    d.plants.push({
      id: plantId,
      ...s.plant,
      acquired_on: isoDay(-s.plant.acquired_days),
      archived_at: null,
      is_example: false,
      created_at: nowIso(-s.plant.acquired_days),
      updated_at: nowIso(-1),
      cover_photo_id: cover.id,
    })
    for (const [asset, days, title, body, desc, kind] of s.entries) {
      const photo = asset ? addPhoto(plantId, asset, days, desc, false) : null
      d.entries.push({
        id: id(),
        plant_id: plantId,
        kind: kind ?? 'observation',
        entry_date: isoDay(-days),
        title,
        body,
        photo_id: photo?.id ?? null,
        analysis_id: null,
        care_kind: null,
        is_example: false,
        created_at: nowIso(-days),
        updated_at: nowIso(-days),
      })
    }
  }
  // One analysis on the tomato's latest leaf photo, saved to the journal.
  const tomato = d.plants[0]
  const leaf = d.photos.find((p) => p.src === 'asset:example-tomato-leaf-2')!
  const context: AnalysisContext = { symptoms_started: 'this_week', watering: 'daily', light: 'full_sun', recent_changes: '' }
  const result = sampleResult(tomato, 0)
  const analysis: AnalysisRow = {
    id: id(),
    plant_id: tomato.id,
    photo_id: leaf.id,
    outcome: result.outcome,
    model_version: MODEL.version,
    result,
    context,
    user_correction: '',
    user_notes: '',
    created_at: nowIso(),
  }
  d.analyses.push(analysis)
  d.entries.push({
    id: id(),
    plant_id: tomato.id,
    kind: 'analysis',
    entry_date: leaf.taken_on,
    title: result.headline,
    body: 'Going to watch the lower leaves and take another photo next week.',
    photo_id: leaf.id,
    analysis_id: analysis.id,
    care_kind: null,
    is_example: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  })

  const [t, b, m] = d.plants
  const reminders: Omit<ReminderRow, 'id' | 'active' | 'last_completed_on' | 'notes'>[] = [
    { plant_id: t.id, kind: 'water', title: 'Water Rosa at the base', due_on: isoDay(0), repeat_days: 2 },
    { plant_id: b.id, kind: 'rotate_light', title: 'Turn the basil pot', due_on: isoDay(1), repeat_days: 7 },
    { plant_id: m.id, kind: 'wipe_leaves', title: 'Dust Monty’s leaves', due_on: isoDay(3), repeat_days: 14 },
    { plant_id: t.id, kind: 'feed', title: 'Tomato feed', due_on: isoDay(5), repeat_days: 14 },
    { plant_id: m.id, kind: 'mist', title: 'Mist the new leaf', due_on: isoDay(-1), repeat_days: null },
  ]
  for (const r of reminders) d.reminders.push({ id: id(), notes: '', active: true, last_completed_on: null, ...r })
  return d
}

function addPhoto(plantId: number, src: string, daysAgo: number, description: string, isExample: boolean): PhotoRow {
  const row: PhotoRow = {
    id: id(),
    plant_id: plantId,
    taken_on: isoDay(-daysAgo),
    description,
    width: 1200,
    height: 900,
    is_example: isExample,
    created_at: nowIso(-daysAgo),
    src: src.startsWith('data:') ? src : `asset:${src}`,
  }
  db().photos.push(row)
  return row
}

// ---- Serialisers ---------------------------------------------------------------

const srcUrl = (src: string) => (src.startsWith('asset:') ? (ASSETS[src.slice(6)] ?? '') : src)

function photoBrief(p: PhotoRow | undefined | null): PhotoBrief | null {
  if (!p) return null
  const url = srcUrl(p.src)
  return { id: p.id, taken_on: p.taken_on, url, thumb_url: url, description: p.description }
}
function photoOut(p: PhotoRow): Photo {
  const { src, ...rest } = p
  const url = srcUrl(src)
  return { ...rest, url, thumb_url: url }
}

function stats(plantId: number) {
  const es = db().entries.filter((e) => e.plant_id === plantId)
  const last = es.reduce<string | null>((m, e) => (!m || e.entry_date > m ? e.entry_date : m), null)
  return { entry_count: es.length, last_entry_on: last }
}

function plantOut(p: PlantRow): Plant {
  const { cover_photo_id, ...rest } = p
  return {
    ...rest,
    cover: photoBrief(db().photos.find((ph) => ph.id === cover_photo_id)),
    analysis_supported: SUPPORTED.includes(p.species_key),
    ...stats(p.id),
  }
}

function entryOut(e: EntryRow): JournalEntry {
  const a = e.analysis_id ? db().analyses.find((x) => x.id === e.analysis_id) : undefined
  return {
    id: e.id,
    plant_id: e.plant_id,
    plant_name: getPlant(e.plant_id).nickname,
    kind: e.kind,
    entry_date: e.entry_date,
    title: e.title,
    body: e.body,
    photo: photoBrief(db().photos.find((p) => p.id === e.photo_id)),
    analysis: a
      ? { id: a.id, outcome: a.outcome, headline: a.result.headline, condition: a.result.primary?.condition ?? null }
      : null,
    care_kind: e.care_kind,
    is_example: e.is_example,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }
}

function analysisOut(a: AnalysisRow): Analysis {
  const plant = getPlant(a.plant_id)
  return {
    id: a.id,
    plant_id: a.plant_id,
    plant_name: plant.nickname,
    species_key: plant.species_key,
    photo: photoBrief(db().photos.find((p) => p.id === a.photo_id))!,
    outcome: a.outcome,
    model_version: a.model_version,
    result: a.result,
    context: a.context,
    context_notes: contextNotes(plant.species_key, a.context),
    user_correction: a.user_correction,
    user_notes: a.user_notes,
    journal_entry_id: db().entries.find((e) => e.analysis_id === a.id)?.id ?? null,
    created_at: a.created_at,
  }
}

function reminderOut(r: ReminderRow): Reminder {
  return { ...r, plant_name: r.plant_id ? (db().plants.find((p) => p.id === r.plant_id)?.nickname ?? null) : null }
}

// ---- Lookups -------------------------------------------------------------------

function find<T extends { id: number }>(rows: T[], rowId: number, what: string): T {
  const row = rows.find((r) => r.id === rowId)
  if (!row) throw new DemoError(404, `We couldn't find that ${what}.`)
  return row
}
const getPlant = (pid: number) => find(db().plants, pid, 'plant')
function writable(p: PlantRow) {
  if (p.is_example)
    throw new DemoError(
      409,
      'Example plants are read-only so they stay separate from your own records. Add your own plant to keep a journal.',
    )
}
const byDateDesc = <T extends { id: number }>(date: (x: T) => string) => (a: T, b: T) =>
  date(b).localeCompare(date(a)) || b.id - a.id
function page<T>(items: T[], params: URLSearchParams) {
  const limit = Number(params.get('limit') ?? 20)
  const offset = Number(params.get('offset') ?? 0)
  return { items: items.slice(offset, offset + limit), total: items.length, limit, offset }
}
function notFuture(date: string | undefined | null, msg = "The date can't be in the future.") {
  if (date && date > isoDay()) throw new DemoError(422, msg)
}

// ---- Router --------------------------------------------------------------------

type Body = Record<string, unknown>
const CARE_TITLES: Record<string, string> = {
  water: 'Watered',
  wipe_leaves: 'Wiped leaves',
  rotate_light: 'Rotated for light',
  check_light: 'Checked the light',
  mist: 'Misted',
  feed: 'Fed',
  custom: 'Care',
}

/** Handle one API call. Returns the JSON body (undefined for 204). */
export async function demoRequest(method: string, rawPath: string, body?: Body): Promise<unknown> {
  // A short, slightly varied pause keeps loading states and animations honest.
  await new Promise((r) => setTimeout(r, 120 + Math.random() * 180))
  const url = new URL(rawPath, 'http://demo.local')
  const parts = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean)
  const q = url.searchParams
  const result = route(method.toUpperCase(), parts, q, body ?? {})
  save()
  // Hand back copies so callers can never mutate the store.
  return result === undefined ? undefined : structuredClone(result)
}

function route(method: string, [res, sub, action]: string[], q: URLSearchParams, b: Body): unknown {
  const d = db()
  const num = Number(sub)

  switch (res) {
    case 'auth':
      if (sub === 'me') return d.user
      if (sub === 'logout') {
        stopDemo()
        return undefined
      }
      throw new DemoError(400, 'You are exploring the demo. Sign out first to use a real account.')

    case 'dashboard': {
      const active = d.plants.filter((p) => !p.archived_at)
      const sorted = [...active].sort(
        (a, b2) =>
          Number(a.is_example) - Number(b2.is_example) ||
          (stats(b2.id).last_entry_on ?? '').localeCompare(stats(a.id).last_entry_on ?? '') ||
          b2.updated_at.localeCompare(a.updated_at),
      )
      const latest = [...d.analyses].sort(byDateDesc((a) => a.created_at))[0]
      return {
        latest_analysis: latest ? analysisOut(latest) : null,
        stories: sorted.slice(0, 3).map((p) => {
          const entries = d.entries.filter((e) => e.plant_id === p.id).sort(byDateDesc((e) => e.entry_date))
          const photos = d.photos
            .filter((ph) => ph.plant_id === p.id && ph.id !== p.cover_photo_id)
            .sort(byDateDesc((ph) => ph.taken_on))
            .slice(0, 2)
            .reverse()
          return {
            plant: plantOut(p),
            entry_count: entries.length,
            latest_entry: entries[0] ? entryOut(entries[0]) : null,
            recent_photos: photos.map((ph) => photoBrief(ph)!),
          }
        }),
        reminders: d.reminders
          .filter((r) => r.active)
          .sort((a, b2) => a.due_on.localeCompare(b2.due_on) || a.id - b2.id)
          .slice(0, 6)
          .map(reminderOut),
        plant_count: active.filter((p) => !p.is_example).length,
        has_examples: active.some((p) => p.is_example),
        model: MODEL,
      }
    }

    case 'plants': {
      if (!sub) {
        if (method === 'POST') {
          if (!String(b.nickname ?? '').trim()) throw new DemoError(422, 'Nickname: Field required')
          notFuture(b.acquired_on as string | null)
          const p: PlantRow = {
            id: id(),
            nickname: String(b.nickname).trim(),
            species: String(b.species ?? '').trim(),
            species_key: (b.species_key as SpeciesKey) ?? 'other',
            location: String(b.location ?? '').trim(),
            acquired_on: (b.acquired_on as string) || null,
            notes: String(b.notes ?? ''),
            archived_at: null,
            is_example: false,
            created_at: nowIso(),
            updated_at: nowIso(),
            cover_photo_id: null,
          }
          d.plants.push(p)
          return plantOut(p)
        }
        const state = q.get('state') ?? 'active'
        const term = (q.get('q') ?? '').trim().toLowerCase()
        return d.plants
          .filter((p) => (state === 'active' ? !p.archived_at : state === 'archived' ? !!p.archived_at : true))
          .filter((p) => !q.get('species_key') || p.species_key === q.get('species_key'))
          .filter((p) => !term || [p.nickname, p.species, p.location].some((s) => s.toLowerCase().includes(term)))
          .sort((a, b2) => Number(a.is_example) - Number(b2.is_example) || a.nickname.localeCompare(b2.nickname))
          .map(plantOut)
      }
      const p = getPlant(num)
      if (method === 'GET') return plantOut(p)
      if (method === 'DELETE') {
        d.plants = d.plants.filter((x) => x.id !== p.id)
        d.photos = d.photos.filter((x) => x.plant_id !== p.id)
        d.entries = d.entries.filter((x) => x.plant_id !== p.id)
        d.analyses = d.analyses.filter((x) => x.plant_id !== p.id)
        d.reminders = d.reminders.filter((x) => x.plant_id !== p.id)
        return undefined
      }
      writable(p)
      if ('cover_photo_id' in b && b.cover_photo_id != null) {
        const ph = find(d.photos, Number(b.cover_photo_id), 'photo')
        if (ph.plant_id !== p.id) throw new DemoError(422, 'That photo belongs to a different plant.')
      }
      notFuture(b.acquired_on as string | null)
      for (const k of ['nickname', 'species', 'species_key', 'location', 'acquired_on', 'notes', 'cover_photo_id'] as const) {
        if (!(k in b)) continue
        const v = b[k]
        if ((k === 'nickname' || k === 'species_key') && v == null) continue
        ;(p as unknown as Body)[k] = v ?? (k === 'acquired_on' || k === 'cover_photo_id' ? null : '')
      }
      if (typeof b.archived === 'boolean') p.archived_at = b.archived ? nowIso() : null
      p.updated_at = nowIso()
      return plantOut(p)
    }

    case 'photos': {
      if (!sub) {
        if (method === 'POST') {
          const p = getPlant(Number(b.plant_id))
          writable(p)
          notFuture(b.taken_on as string)
          const row = addPhoto(p.id, String(b.src), 0, String(b.description ?? ''), false)
          if (b.taken_on) row.taken_on = String(b.taken_on)
          row.width = Number(b.width) || 1200
          row.height = Number(b.height) || 900
          return photoOut(row)
        }
        getPlant(Number(q.get('plant_id')))
        return d.photos
          .filter((ph) => ph.plant_id === Number(q.get('plant_id')))
          .sort(byDateDesc((ph) => ph.taken_on))
          .map(photoOut)
      }
      const ph = find(d.photos, num, 'photo')
      if (method === 'GET') return photoOut(ph)
      if (ph.is_example) throw new DemoError(409, 'Example photos are read-only.')
      if (method === 'DELETE') {
        if (d.analyses.some((a) => a.photo_id === ph.id))
          throw new DemoError(409, 'An analysis still uses this photo. Delete the analysis first.')
        d.photos = d.photos.filter((x) => x.id !== ph.id)
        d.entries.forEach((e) => e.photo_id === ph.id && (e.photo_id = null))
        d.plants.forEach((p) => p.cover_photo_id === ph.id && (p.cover_photo_id = null))
        return undefined
      }
      notFuture(b.taken_on as string)
      if (b.taken_on) ph.taken_on = String(b.taken_on)
      if (typeof b.description === 'string') ph.description = b.description
      return photoOut(ph)
    }

    case 'journal': {
      if (!sub) {
        if (method === 'POST') {
          const p = getPlant(Number(b.plant_id))
          writable(p)
          const kind = (b.kind as EntryRow['kind']) ?? 'observation'
          const photoId = b.photo_id != null ? Number(b.photo_id) : null
          if (photoId != null && find(d.photos, photoId, 'photo').plant_id !== p.id)
            throw new DemoError(422, 'That photo belongs to a different plant.')
          if (photoId == null && kind === 'photo') throw new DemoError(422, 'Please add a photo to this entry.')
          const title = String(b.title ?? '').trim()
          const text = String(b.body ?? '').trim()
          if (kind === 'observation' && !text && !title && !photoId)
            throw new DemoError(422, 'Please write a note or add a photo.')
          notFuture(b.entry_date as string, "Journal entries can't be dated in the future.")
          const e: EntryRow = {
            id: id(),
            plant_id: p.id,
            kind,
            entry_date: String(b.entry_date ?? isoDay()),
            title,
            body: text,
            photo_id: photoId,
            analysis_id: null,
            care_kind: (b.care_kind as ReminderKind) ?? null,
            is_example: false,
            created_at: nowIso(),
            updated_at: nowIso(),
          }
          d.entries.push(e)
          return entryOut(e)
        }
        const items = d.entries
          .filter((e) => !q.get('plant_id') || e.plant_id === Number(q.get('plant_id')))
          .filter((e) => !q.get('kind') || e.kind === q.get('kind'))
          .filter((e) => !q.get('date_from') || e.entry_date >= q.get('date_from')!)
          .filter((e) => !q.get('date_to') || e.entry_date <= q.get('date_to')!)
          .filter((e) => q.get('with_photo') !== 'true' || e.photo_id != null)
          .sort(byDateDesc((e) => e.entry_date))
          .map(entryOut)
        return page(items, q)
      }
      const e = find(d.entries, num, 'journal entry')
      if (method === 'GET') return entryOut(e)
      if (e.is_example) throw new DemoError(409, 'Example entries are read-only.')
      if (method === 'DELETE') {
        d.entries = d.entries.filter((x) => x.id !== e.id)
        if (q.get('delete_photo') === 'true' && e.photo_id && !d.analyses.some((a) => a.photo_id === e.photo_id)) {
          d.photos = d.photos.filter((x) => x.id !== e.photo_id)
          d.plants.forEach((p) => p.cover_photo_id === e.photo_id && (p.cover_photo_id = null))
        }
        return undefined
      }
      notFuture(b.entry_date as string, "Journal entries can't be dated in the future.")
      if (b.entry_date) e.entry_date = String(b.entry_date)
      if (typeof b.title === 'string') e.title = b.title.trim()
      if (typeof b.body === 'string') e.body = b.body.trim()
      e.updated_at = nowIso()
      return entryOut(e)
    }

    case 'analyses': {
      if (!sub) {
        if (method === 'POST') {
          const ph = find(d.photos, Number(b.photo_id), 'photo')
          if (ph.plant_id == null) throw new DemoError(422, 'Please choose a plant for this photo first.')
          const p = getPlant(ph.plant_id)
          writable(p)
          const result = sampleResult(p, d.analyses.length)
          const a: AnalysisRow = {
            id: id(),
            plant_id: p.id,
            photo_id: ph.id,
            outcome: result.outcome,
            model_version: result.model.version,
            result,
            context: {
              symptoms_started: (b.symptoms_started as string) ?? null,
              watering: (b.watering as string) ?? null,
              light: (b.light as string) ?? null,
              recent_changes: String(b.recent_changes ?? '').trim(),
            },
            user_correction: '',
            user_notes: '',
            created_at: nowIso(),
          }
          d.analyses.push(a)
          return analysisOut(a)
        }
        const items = d.analyses
          .filter((a) => !q.get('plant_id') || a.plant_id === Number(q.get('plant_id')))
          .sort(byDateDesc((a) => a.created_at))
          .map(analysisOut)
        return page(items, q)
      }
      const a = find(d.analyses, num, 'analysis')
      if (method === 'GET') return analysisOut(a)
      const plant = getPlant(a.plant_id)
      writable(plant)
      if (method === 'DELETE') {
        d.analyses = d.analyses.filter((x) => x.id !== a.id)
        d.entries.forEach((e) => e.analysis_id === a.id && (e.analysis_id = null))
        return undefined
      }
      if (action === 'rerun') {
        a.result = sampleResult(plant, a.id)
        a.outcome = a.result.outcome
        return analysisOut(a)
      }
      if (action === 'journal') {
        const note = String(b.note ?? '').trim()
        let e = d.entries.find((x) => x.analysis_id === a.id)
        if (!e) {
          e = {
            id: id(),
            plant_id: a.plant_id,
            kind: 'analysis',
            entry_date: find(d.photos, a.photo_id, 'photo').taken_on,
            title: a.result.headline.slice(0, 120),
            body: note,
            photo_id: a.photo_id,
            analysis_id: a.id,
            care_kind: null,
            is_example: false,
            created_at: nowIso(),
            updated_at: nowIso(),
          }
          d.entries.push(e)
        } else if (note) e.body = note
        return entryOut(e)
      }
      if (typeof b.user_correction === 'string') a.user_correction = b.user_correction.trim()
      if (typeof b.user_notes === 'string') a.user_notes = b.user_notes.trim()
      return analysisOut(a)
    }

    case 'reminders': {
      if (!sub) {
        if (method === 'POST') {
          if (b.plant_id != null) writable(getPlant(Number(b.plant_id)))
          const r: ReminderRow = {
            id: id(),
            plant_id: b.plant_id != null ? Number(b.plant_id) : null,
            kind: b.kind as ReminderKind,
            title: String(b.title ?? '').trim(),
            notes: String(b.notes ?? ''),
            due_on: String(b.due_on),
            repeat_days: (b.repeat_days as number) ?? null,
            last_completed_on: null,
            active: true,
          }
          if (!r.title) throw new DemoError(422, 'Title: Field required')
          d.reminders.push(r)
          return reminderOut(r)
        }
        return d.reminders
          .filter((r) => q.get('state') === 'all' || r.active)
          .filter((r) => !q.get('plant_id') || r.plant_id === Number(q.get('plant_id')))
          .sort((a, b2) => a.due_on.localeCompare(b2.due_on) || a.id - b2.id)
          .map(reminderOut)
      }
      const r = find(d.reminders, num, 'reminder')
      if (method === 'DELETE') {
        d.reminders = d.reminders.filter((x) => x.id !== r.id)
        return undefined
      }
      if (action === 'complete') {
        if (!r.active) throw new DemoError(409, 'This reminder is already done.')
        const doneOn = (b.completed_on as string) || isoDay()
        notFuture(doneOn, "Completion date can't be in the future.")
        r.last_completed_on = doneOn
        if (r.repeat_days) r.due_on = addDays(doneOn, r.repeat_days)
        else r.active = false
        const p = r.plant_id ? d.plants.find((x) => x.id === r.plant_id) : undefined
        if (b.log_to_journal !== false && p && !p.is_example)
          d.entries.push({
            id: id(),
            plant_id: p.id,
            kind: 'care',
            entry_date: doneOn,
            title: r.kind === 'custom' ? r.title : (CARE_TITLES[r.kind] ?? 'Care'),
            body: String(b.note ?? '').trim(),
            photo_id: null,
            analysis_id: null,
            care_kind: r.kind,
            is_example: false,
            created_at: nowIso(),
            updated_at: nowIso(),
          })
        return reminderOut(r)
      }
      if ('plant_id' in b) {
        if (b.plant_id != null) writable(getPlant(Number(b.plant_id)))
        r.plant_id = (b.plant_id as number | null) ?? null
      }
      for (const k of ['kind', 'title', 'notes', 'due_on', 'active'] as const)
        if (b[k] != null) (r as unknown as Body)[k] = typeof b[k] === 'string' ? (b[k] as string).trim() : b[k]
      if (b.clear_repeat) r.repeat_days = null
      else if (b.repeat_days != null) r.repeat_days = Number(b.repeat_days)
      return reminderOut(r)
    }

    case 'guide': {
      const articles = guide.articles as GuideArticle[]
      if (sub) {
        const a = articles.find((x) => x.slug === sub)
        if (!a) throw new DemoError(404, "We couldn't find that guide.")
        return a
      }
      const term = (q.get('q') ?? '').trim().toLowerCase()
      return {
        treatment_note: guide.treatment_note,
        articles: articles.filter((a) => {
          if (q.get('plant') && !a.plants.includes(q.get('plant') as SpeciesKey)) return false
          if (q.get('kind') && a.kind !== q.get('kind')) return false
          if (!term) return true
          const hay = [a.title, a.summary, ...a.looks_like, ...a.care, ...a.often_confused_with, ...a.tags]
            .join(' ')
            .toLowerCase()
          return term.split(/\s+/).every((w) => hay.includes(w))
        }),
      }
    }

    case 'system':
      return MODEL

    case 'account': {
      if (sub === 'password') return undefined
      if (sub === 'examples') {
        if (method === 'DELETE') {
          const ids = new Set(d.plants.filter((p) => p.is_example).map((p) => p.id))
          d.plants = d.plants.filter((p) => !ids.has(p.id))
          d.photos = d.photos.filter((p) => !ids.has(p.plant_id ?? -1))
          d.entries = d.entries.filter((e) => !ids.has(e.plant_id))
          return undefined
        }
        if (d.plants.some((p) => p.is_example)) return { created_plants: 0 }
        for (const s of SEED) {
          const pid = id()
          const cover = addPhoto(pid, s.cover[0], s.cover[1], s.cover[2], true)
          d.plants.push({
            id: pid,
            nickname: s.plant.nickname.split(' ').pop()!,
            species: s.plant.species,
            species_key: s.plant.species_key,
            location: s.plant.location,
            notes: 'An example plant to show how a journal grows.',
            acquired_on: null,
            archived_at: null,
            is_example: true,
            created_at: nowIso(),
            updated_at: nowIso(),
            cover_photo_id: cover.id,
          })
          for (const [asset, days, title, text, desc] of s.entries) {
            if (!asset) continue
            const ph = addPhoto(pid, asset, days, desc, true)
            d.entries.push({
              id: id(),
              plant_id: pid,
              kind: 'photo',
              entry_date: ph.taken_on,
              title,
              body: text,
              photo_id: ph.id,
              analysis_id: null,
              care_kind: null,
              is_example: true,
              created_at: nowIso(),
              updated_at: nowIso(),
            })
          }
        }
        return { created_plants: SEED.length }
      }
      if (method === 'DELETE') {
        stopDemo()
        return undefined
      }
      if (method === 'PATCH') {
        if (typeof b.display_name === 'string' && b.display_name.trim()) d.user.display_name = b.display_name.trim()
        if (b.locale === 'en' || b.locale === 'sq') d.user.locale = b.locale
        if (b.motion_preference === 'system' || b.motion_preference === 'reduce' || b.motion_preference === 'full')
          d.user.motion_preference = b.motion_preference
        return d.user
      }
      break
    }
  }
  throw new DemoError(404, "This isn't available in the demo.")
}

/** Shrink an uploaded image to a data URL small enough for localStorage. */
export async function demoImage(file: File): Promise<{ src: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new DemoError(415, 'Please choose a JPEG, PNG or WebP image.')
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new DemoError(415, "We couldn't read that image. Please try another photo.")
  })
  if (bitmap.width < 64 || bitmap.height < 64) throw new DemoError(422, 'This image is too small. Please use a larger photo.')
  const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return { src: canvas.toDataURL('image/jpeg', 0.78), width: bitmap.width, height: bitmap.height }
}
