import { useQueryClient } from '@tanstack/react-query'
import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router'
import { BotanicalBranch, HerbMark, Sprig } from '../components/Botanical'
import { Icon, type IconName } from '../components/Icon'
import { Logo, LogoSymbol } from '../components/Logo'
import { buttonClass } from '../components/ui'
import { startDemo } from '../demo/server'
import basilCover from '../demo/photos/example-basil-cover.jpg'
import basil2 from '../demo/photos/example-basil-2.jpg'
import monsteraCover from '../demo/photos/example-monstera-cover.jpg'
import monstera1 from '../demo/photos/example-monstera-1.jpg'
import tomatoCover from '../demo/photos/example-tomato-cover.jpg'
import tomatoLeaf from '../demo/photos/example-tomato-leaf-1.jpg'
import { useMe } from '../lib/queries'
import { useMotionPrefs } from '../motion/MotionPrefs'

const EASE = [0.22, 1, 0.36, 1] as const

const NOTE = {
  butter: '#fff1b8',
  blush: '#f8d9d1',
  sage: '#dfe9d3',
  sky: '#dbe8f0',
  lilac: '#ebe0f3',
  peach: '#fde2c4',
} as const
type NoteColor = keyof typeof NOTE

/** Turn demo mode on, forget any cached session, and step into the garden. */
function useStartDemo() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return () => {
    startDemo()
    qc.clear()
    navigate('/', { replace: true })
  }
}

// ---- Small animated pieces ----------------------------------------------------

/** Headline whose letters rise into place one by one. */
function LetterRise({ text, delay = 0, className = '' }: { text: string; delay?: number; className?: string }) {
  const words = text.split(' ')
  let i = 0
  return (
    <span className={className} aria-label={text}>
      {words.map((word, w) => (
        <span key={w} className="inline-block whitespace-nowrap" aria-hidden="true">
          {[...word].map((ch) => {
            const n = i++
            return (
              <motion.span
                key={n}
                className="inline-block"
                initial={{ y: '0.9em', opacity: 0, rotate: 8 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ delay: delay + n * 0.035, duration: 0.7, ease: EASE }}
              >
                {ch}
              </motion.span>
            )
          })}
          {w < words.length - 1 && ' '}
        </span>
      ))}
    </span>
  )
}

function Typewriter({ text, start, speed = 32, className = '' }: { text: string; start: boolean; speed?: number; className?: string }) {
  const { reduced } = useMotionPrefs()
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start || reduced) return
    const t = setInterval(() => setCount((c) => (c >= text.length ? c : c + 1)), speed)
    return () => clearInterval(t)
  }, [start, reduced, text, speed])
  const shown = reduced ? text.length : count
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="whitespace-pre-line">
        {text.slice(0, shown)}
        {shown < text.length && start && <span className="caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] bg-forest" />}
      </span>
    </span>
  )
}

function CountUp({ to, decimals = 1, suffix = '%' }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  const { reduced } = useMotionPrefs()
  const [value, setValue] = useState(reduced ? to : 0)
  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, to, { duration: 1.8, ease: EASE, onUpdate: setValue })
    return () => controls.stop()
  }, [inView, reduced, to])
  return (
    <span ref={ref} className="tabular-nums">
      {value.toFixed(decimals)}
      {suffix}
    </span>
  )
}

/** A squiggly underline that draws itself. */
function Scribble({ className = '', delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg viewBox="0 0 300 24" className={className} aria-hidden="true" preserveAspectRatio="none">
      <motion.path
        d="M3 16C40 6 70 20 105 12s62-8 96 2 58 4 96-6"
        fill="none"
        stroke="#dda297"
        strokeWidth="5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay, duration: 1.1, ease: EASE }}
      />
    </svg>
  )
}

const PETALS = Array.from({ length: 16 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  size: 10 + ((i * 7) % 12),
  d: `${12 + ((i * 5) % 11)}s`,
  delay: `${-((i * 2.3) % 14)}s`,
  drift: `${((i % 2 ? 1 : -1) * (40 + ((i * 17) % 90)))}px`,
  spin: `${360 + ((i * 53) % 400)}deg`,
  tone: i % 3,
}))
const PETAL_TONES = ['#ebc0b6', '#f6e3de', '#dda297']

function Petals() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {PETALS.map((p, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          width={p.size}
          height={p.size}
          className="petal"
          style={{ left: p.left, '--d': p.d, '--delay': p.delay, '--drift': p.drift, '--spin': p.spin } as CSSProperties}
        >
          <path d="M10 1C4 5 3 13 10 19 17 13 16 5 10 1Z" fill={PETAL_TONES[p.tone]} />
        </svg>
      ))}
    </div>
  )
}

interface StickyProps {
  color?: NoteColor
  rotate?: number
  children: ReactNode
  className?: string
  style?: CSSProperties
  drag?: RefObject<HTMLElement | null>
  delay?: number
  pin?: boolean
  sway?: boolean
}

/** A sticky note that pops in, lifts on hover and can be dragged around its container. */
function Sticky({ color = 'butter', rotate = -3, children, className = '', style, drag, delay = 0, pin, sway }: StickyProps) {
  return (
    <motion.div
      drag={!!drag}
      dragConstraints={drag}
      dragElastic={0.18}
      dragTransition={{ bounceStiffness: 260, bounceDamping: 18 }}
      initial={{ opacity: 0, scale: 0.6, rotate: rotate * 3, y: 30 }}
      animate={{ opacity: 1, scale: 1, rotate, y: 0 }}
      whileHover={{ scale: 1.06, rotate: 0, zIndex: 30 }}
      whileDrag={{ scale: 1.1, rotate: rotate / 2, zIndex: 40, cursor: 'grabbing' }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 16 }}
      className={`note-sticky absolute font-hand leading-tight text-ink ${pin ? 'pin' : ''} ${drag ? 'cursor-grab touch-none' : ''} ${className}`}
      style={{ background: NOTE[color], ...style }}
    >
      <div className={sway ? 'sway' : ''} style={{ '--r': `${rotate > 0 ? 1 : -1}deg` } as CSSProperties}>
        {children}
      </div>
    </motion.div>
  )
}

/** Notes that fly in as they scroll into view. */
function RevealNote({
  color,
  rotate,
  index,
  children,
  className = '',
  pin,
}: {
  color: NoteColor
  rotate: number
  index: number
  children: ReactNode
  className?: string
  pin?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotate: rotate * 4, scale: 0.85 }}
      whileInView={{ opacity: 1, y: 0, rotate, scale: 1 }}
      whileHover={{ rotate: 0, scale: 1.04, y: -6 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ type: 'spring', stiffness: 160, damping: 17, delay: (index % 4) * 0.09 }}
      className={`note-sticky relative ${pin ? 'pin' : ''} ${className}`}
      style={{ background: NOTE[color] }}
    >
      {children}
    </motion.div>
  )
}

// ---- Header -------------------------------------------------------------------

function Header({ onDemo }: { onDemo: () => void }) {
  const { scrollY, scrollYProgress } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 24 })
  const { data: me } = useMe()

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background,box-shadow,backdrop-filter] duration-300 ${
        scrolled ? 'bg-ivory/85 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md' : ''
      }`}
    >
      <motion.div className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-gradient-to-r from-forest via-leaf to-blush" style={{ scaleX: progress }} />
      <div className="mx-auto flex h-[4.25rem] max-w-[76rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/home" className="shrink-0 rounded-lg whitespace-nowrap" aria-label="to my petal, home">
          <Logo size={36} />
        </Link>
        <nav aria-label="Homepage sections" className="hidden items-center gap-8 text-[0.95rem] text-muted md:flex">
          {[
            ['#how', 'How it works'],
            ['#letters', 'Letters'],
            ['#features', 'Features'],
            ['#honest', 'Honest AI'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="group relative py-2 transition-colors hover:text-forest">
              {label}
              <span className="absolute inset-x-0 bottom-1 h-[1.5px] origin-left scale-x-0 rounded bg-forest transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {me ? (
            <Link to="/" className={buttonClass('primary', 'md')}>
              Your garden <Icon name="arrowRight" size={16} />
            </Link>
          ) : (
            <>
              <span className="hidden sm:block">
                <Link to="/welcome" className={buttonClass('ghost', 'md')}>
                  Sign in
                </Link>
              </span>
              <button type="button" onClick={onDemo} className={buttonClass('primary', 'md', 'whitespace-nowrap')}>
                Try the demo
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ---- Hero ---------------------------------------------------------------------

const HERO_LETTER = `Dear Rosa,
your lower leaves have tiny spots again. I'm watering at the soil now, I promise.
Grow well, little one.
— with love, me`

function Envelope() {
  const { reduced } = useMotionPrefs()
  const [stage, setStage] = useState(reduced ? 3 : 0)
  useEffect(() => {
    if (reduced) return
    const ts = [setTimeout(() => setStage(1), 700), setTimeout(() => setStage(2), 1500), setTimeout(() => setStage(3), 2300)]
    return () => ts.forEach(clearTimeout)
  }, [reduced])

  return (
    <motion.div
      className="float-y relative mx-auto aspect-[3/2] w-[min(88vw,25rem)]"
      style={{ perspective: 1200, '--d': '6s' } as CSSProperties}
      initial={{ opacity: 0, y: 60, rotate: -8 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 1, ease: EASE }}
    >
      {/* back */}
      <div className="absolute inset-0 rounded-lg bg-[#efd2ca] shadow-[0_30px_50px_-28px_rgb(24_37_28/0.55)]" />
      {/* letter */}
      <motion.div
        className="paper absolute inset-x-[6%] top-[8%] h-[150%] rounded-md px-5 pt-[1.85rem] shadow-[0_6px_18px_-8px_rgb(24_37_28/0.35)] sm:px-6"
        initial={{ y: '0%' }}
        animate={{ y: stage >= 2 ? '-42%' : '0%' }}
        transition={{ duration: 1, ease: EASE }}
        style={{ zIndex: 2 }}
      >
        <p className="font-hand text-[1.2rem] leading-[1.85rem] text-forest sm:text-[1.35rem]">
          <Typewriter text={HERO_LETTER} start={stage >= 3} speed={28} />
        </p>
      </motion.div>
      {/* front pocket */}
      <div
        className="absolute inset-0 rounded-lg bg-[#f4ddd6]"
        style={{ zIndex: 3, clipPath: 'polygon(0 22%, 50% 62%, 100% 22%, 100% 100%, 0 100%)' }}
      />
      <div
        className="absolute inset-0 rounded-lg bg-[#ecc9bf]"
        style={{ zIndex: 3, clipPath: 'polygon(0 100%, 50% 58%, 100% 100%)' }}
      />
      <p className="absolute bottom-[12%] left-[8%] z-[4] font-hand text-lg text-blush-ink/80">to: Rosa, sunny balcony</p>
      {/* stamp */}
      <div className="absolute right-[6%] bottom-[10%] z-[4] grid size-14 rotate-6 place-items-center rounded-sm border-2 border-dashed border-blush-ink/40 bg-card">
        <LogoSymbol size={34} />
      </div>
      {/* flap */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[62%] origin-top"
        initial={{ rotateX: 0 }}
        animate={{ rotateX: stage >= 1 ? 180 : 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ zIndex: stage >= 2 ? 1 : 5, transformStyle: 'preserve-3d' }}
      >
        <div className="absolute inset-0 bg-[#e6bdb2]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
        <motion.div
          className="absolute top-[78%] left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#b7604f] text-card shadow-md"
          animate={{ opacity: stage >= 1 ? 0 : 1, scale: stage >= 1 ? 0.6 : 1 }}
          transition={{ duration: 0.3 }}
        >
          <Icon name="leaf" size={20} />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function Hero({ onDemo }: { onDemo: () => void }) {
  const board = useRef<HTMLElement>(null)
  const { scrollY } = useScroll()
  const branchY = useTransform(scrollY, [0, 600], [0, 120])
  const sprigY = useTransform(scrollY, [0, 600], [0, -80])

  return (
    <section ref={board} className="relative overflow-hidden pt-28 pb-24 sm:pt-32 lg:min-h-[100dvh] lg:pb-32">
      <Petals />
      <motion.div style={{ y: branchY }} className="pointer-events-none absolute -top-6 -right-10 w-72 opacity-80 sm:w-[26rem]">
        <BotanicalBranch />
      </motion.div>
      <motion.div style={{ y: sprigY }} className="pointer-events-none absolute bottom-0 -left-4 hidden h-80 w-20 opacity-70 md:block">
        <Sprig />
      </motion.div>

      <div className="relative mx-auto grid max-w-[76rem] items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="relative z-10">
          <motion.p
            className="eyebrow inline-flex items-center gap-2 rounded-full bg-blush-soft px-3 py-1.5 text-blush-ink"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="size-1.5 animate-pulse rounded-full bg-blush-ink" /> A plant journal, written like letters
          </motion.p>
          <h1 className="display mt-6 text-forest">
            <LetterRise text="Write your plants" delay={0.15} />
            <br />
            <span className="relative inline-block italic text-blush-ink">
              <LetterRise text="a love letter." delay={0.75} />
              <Scribble className="absolute -bottom-2 left-0 h-4 w-full sm:-bottom-3" delay={1.5} />
            </span>
          </h1>
          <motion.p
            className="mt-7 max-w-xl text-[1.12rem] text-muted"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.7, ease: EASE }}
          >
            <strong className="font-semibold text-ink">to my petal</strong> is a visual journal for every plant you love. Photograph a
            leaf, get an honest second look, leave yourself notes, and watch your plant&rsquo;s story grow one letter at a time.
          </motion.p>
          <motion.div
            className="mt-9 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.7, ease: EASE }}
          >
            <motion.button
              type="button"
              onClick={onDemo}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className={buttonClass('primary', 'lg', 'group shadow-[var(--shadow-lift)]')}
            >
              Open the demo garden
              <Icon name="arrowRight" size={18} className="transition-transform group-hover:translate-x-1" />
            </motion.button>
            <Link to="/welcome" className={buttonClass('secondary', 'lg')}>
              Sign in
            </Link>
          </motion.div>
          <motion.p
            className="mt-4 flex items-center gap-2 text-sm text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
          >
            <Icon name="check" size={16} className="text-ok" /> No account, no server. The demo lives in your browser.
          </motion.p>
        </div>

        <div className="relative min-h-[30rem] sm:min-h-[32rem]">
          <div className="absolute inset-x-0 top-48 sm:top-44">
            <Envelope />
          </div>
        </div>
      </div>

      {/* Draggable notes scattered over the hero */}
      <Sticky drag={board} color="butter" rotate={-6} delay={1.6} sway className="top-[62%] left-[4%] z-20 w-36 p-4 text-xl sm:w-40 lg:top-[72%] lg:left-[38%]">
        water Rosa <u>at the base</u>!
      </Sticky>
      <Sticky drag={board} color="sage" rotate={5} delay={1.8} className="top-24 right-[3%] z-20 hidden w-36 p-4 text-xl sm:block lg:top-[18%] lg:right-[6%]">
        new leaf on Monty <span className="text-blush-ink">♥</span>
      </Sticky>
      <Sticky drag={board} color="blush" rotate={-4} delay={2.0} pin className="right-[4%] bottom-10 z-20 w-40 p-4 pt-7 text-xl lg:right-[2%] lg:bottom-[12%]">
        follow-up photo in 1 week, same angle
      </Sticky>
      <Sticky drag={board} color="sky" rotate={7} delay={2.2} className="bottom-[6%] left-[46%] z-20 hidden w-32 p-4 text-lg lg:block">
        pinch the basil tops
      </Sticky>
      <motion.p
        className="pointer-events-none absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 font-hand text-xl text-muted lg:flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
      >
        psst, the notes are draggable
        <svg viewBox="0 0 40 20" className="h-5 w-10" aria-hidden="true">
          <path d="M2 14c10-10 22-12 34-4m0 0-6-6m6 6-8 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </motion.p>
    </section>
  )
}

// ---- Marquee ------------------------------------------------------------------

const PHRASES = [
  'a little care',
  'a little bloom',
  'one photograph at a time',
  'dear basil',
  'water the soil, not the leaves',
  'care begins with understanding',
  'new leaf!',
  'see you next week, Rosa',
]

function Marquee() {
  const row = (reverse: boolean) => (
    <div className={`flex w-max gap-10 ${reverse ? 'marquee-slow' : 'marquee'}`} aria-hidden="true">
      {[...PHRASES, ...PHRASES].map((p, i) => (
        <span key={i} className="flex items-center gap-10 whitespace-nowrap">
          {p}
          <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true">
            <path d="M10 1C4 5 3 13 10 19 17 13 16 5 10 1Z" fill={reverse ? '#a5b39a' : '#dda297'} />
          </svg>
        </span>
      ))}
    </div>
  )
  return (
    <div className="relative -rotate-1 overflow-hidden border-y border-forest/20 bg-forest py-4 font-hand text-[1.9rem] text-card">
      {row(false)}
      <div className="mt-1 text-sage">{row(true)}</div>
    </div>
  )
}

// ---- How it works -------------------------------------------------------------

const STEPS: { n: string; title: string; text: string; icon: IconName; color: NoteColor; rotate: number }[] = [
  { n: '01', title: 'Share a leaf', text: 'Snap the leaf that worries you. One leaf, soft daylight, filling the frame.', icon: 'camera', color: 'butter', rotate: -3 },
  { n: '02', title: 'Explore the findings', text: 'See possible issues for tomato, potato and pepper, with honest confidence.', icon: 'scan', color: 'blush', rotate: 2.5 },
  { n: '03', title: 'Save an observation', text: 'Pin the photo and your thoughts to the plant’s journal, like a note to yourself.', icon: 'note', color: 'sage', rotate: -1.5 },
  { n: '04', title: 'Return with a follow-up', text: 'A week later, same angle. Compare side by side and see what changed.', icon: 'compare', color: 'sky', rotate: 3 },
]

function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[76rem]">
        <SectionTitle eyebrow="How it works" title="Four little notes on the fridge" />
        <div className="cork relative mt-14 rounded-[1.75rem] border border-line p-6 shadow-[inset_0_2px_12px_rgb(24_37_28/0.08)] sm:p-10">
          <svg className="pointer-events-none absolute inset-0 hidden size-full lg:block" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
            <motion.path
              d="M120 150C220 60 300 240 380 150S540 60 620 150 780 240 880 150"
              fill="none"
              stroke="#b7604f"
              strokeWidth="2"
              strokeDasharray="6 8"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, ease: EASE, delay: 0.4 }}
            />
          </svg>
          <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n}>
                <RevealNote color={s.color} rotate={s.rotate} index={i} pin className="min-h-56 p-6 pt-9">
                  <div className="flex items-center justify-between">
                    <span className="font-hand text-4xl text-blush-ink">{s.n}</span>
                    <span className="grid size-10 place-items-center rounded-full bg-card/70 text-forest">
                      <Icon name={s.icon} size={20} />
                    </span>
                  </div>
                  <h3 className="mt-3 text-[1.45rem] text-forest">{s.title}</h3>
                  <p className="mt-2 text-[0.98rem] text-ink/80">{s.text}</p>
                </RevealNote>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.8, ease: EASE }}
      className="max-w-2xl"
    >
      <p className="eyebrow text-leaf">{eyebrow}</p>
      <h2 className="title-lg mt-3 text-forest">{title}</h2>
      {children && <p className="mt-4 text-[1.08rem] text-muted">{children}</p>}
    </motion.div>
  )
}

// ---- Letters ------------------------------------------------------------------

interface Letter {
  id: string
  to: string
  from: string
  stamp: string
  color: string
  rotate: number
  body: string
}

const LETTERS: Letter[] = [
  {
    id: 'monty',
    to: 'Monty',
    from: 'the living room',
    stamp: '#a5b39a',
    color: '#f4ddd6',
    rotate: -4,
    body: `Dear Monty,
I moved you closer to the window on Sunday. Bright, but not too bright, just how you like it. Fewer yellow leaves this week. I noticed. I always notice.
— your person`,
  },
  {
    id: 'basil',
    to: 'Basil Brush',
    from: 'the kitchen',
    stamp: '#dda297',
    color: '#e7ebdf',
    rotate: 3,
    body: `Dear Basil,
About the pesto. I'm sorry. You were delicious. I pinched the flower buds like the guide said, and you came back fuller than ever.
— a grateful cook`,
  },
  {
    id: 'rosa',
    to: 'you',
    from: 'Rosa the Tomato',
    stamp: '#5e7d4e',
    color: '#fff1b8',
    rotate: -2,
    body: `Dear human,
Please stop watering my leaves. My roots are down there. Also: the spots on my lower leaves are back. Take a photo? The same angle as last week, please.
— Rosa (balcony)`,
  },
  {
    id: 'future',
    to: 'future me',
    from: 'today',
    stamp: '#24503a',
    color: '#dbe8f0',
    rotate: 5,
    body: `Dear future me,
If the spots spread, check the care guide before you panic. If it's serious, call the plant clinic. A photo can't confirm a cause, but it can tell a story.
— me, on a Tuesday`,
  },
]

function LetterCard({ letter, onOpen, index }: { letter: Letter; onOpen: () => void; index: number }) {
  return (
    <motion.button
      type="button"
      layoutId={`letter-${letter.id}`}
      onClick={onOpen}
      initial={{ opacity: 0, y: 80, rotate: letter.rotate * 3 }}
      whileInView={{ opacity: 1, y: 0, rotate: letter.rotate }}
      viewport={{ once: true, margin: '-10% 0px' }}
      whileHover={{ y: -14, rotate: 0, scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 170, damping: 18, delay: index * 0.08 }}
      className="group relative aspect-[3/2] w-full rounded-lg text-left shadow-[0_22px_40px_-24px_rgb(24_37_28/0.55)]"
      style={{ background: letter.color }}
      aria-label={`Open the letter to ${letter.to}`}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 origin-top bg-black/[0.04] transition-transform duration-500 group-hover:[transform:perspective(600px)_rotateX(28deg)]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
      <div className="absolute top-4 right-4 grid size-12 rotate-6 place-items-center rounded-sm border-2 border-dashed border-white/80" style={{ background: letter.stamp }}>
        <svg viewBox="0 0 20 20" className="size-6" aria-hidden="true">
          <path d="M10 1C4 5 3 13 10 19 17 13 16 5 10 1Z" fill="#fffcf5" />
        </svg>
      </div>
      <div className="absolute top-5 right-14 size-14 rounded-full border border-forest/25 opacity-60" aria-hidden="true" />
      <div className="absolute bottom-5 left-5">
        <p className="font-hand text-[1.7rem] leading-none text-forest">to: {letter.to}</p>
        <p className="mt-1 font-hand text-lg text-muted">from {letter.from}</p>
      </div>
      <span className="absolute right-5 bottom-5 flex items-center gap-1 text-sm font-medium text-forest opacity-0 transition-opacity group-hover:opacity-100">
        Open <Icon name="arrowRight" size={14} />
      </span>
    </motion.button>
  )
}

function Letters() {
  const [open, setOpen] = useState<Letter | null>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <section id="letters" className="relative scroll-mt-20 overflow-hidden bg-blush-soft/50 px-4 py-24 sm:px-6 lg:px-8">
      <Sprig flip className="pointer-events-none absolute top-10 right-2 h-72 w-16 opacity-60" />
      <div className="mx-auto max-w-[76rem]">
        <SectionTitle eyebrow="Letters from the garden" title="Every journal entry is a little letter">
          Notes to your plants, notes from your plants, notes to future you. Tap an envelope to read one.
        </SectionTitle>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {LETTERS.map((l, i) => (
            <LetterCard key={l.id} letter={l} index={i} onOpen={() => setOpen(l)} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60] grid place-items-center bg-forest/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(null)}
          >
            <motion.div
              layoutId={`letter-${open.id}`}
              role="dialog"
              aria-modal="true"
              aria-label={`Letter to ${open.to}`}
              className="paper relative w-full max-w-lg rounded-lg p-7 pt-[1.85rem] pb-10 shadow-2xl sm:px-10"
              onClick={(e) => e.stopPropagation()}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            >
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(null)}
                className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted hover:bg-sage-soft hover:text-forest"
                aria-label="Close letter"
              >
                <Icon name="close" size={20} />
              </button>
              <p className="font-hand text-[1.5rem] leading-[1.85rem] text-forest">
                <Typewriter key={open.id} text={open.body} start speed={18} />
              </p>
              <div className="absolute -bottom-4 left-8 grid size-12 place-items-center rounded-full bg-[#b7604f] text-card shadow-md">
                <Icon name="leaf" size={20} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ---- Features -----------------------------------------------------------------

const FEATURES: { icon: IconName; title: string; text: string; color: NoteColor; rotate: number; hand: string }[] = [
  { icon: 'journal', title: 'A visual journal', text: 'Photos, observations, care and analyses on one timeline for every plant.', color: 'butter', rotate: -2, hand: 'my favourite part!' },
  { icon: 'scan', title: 'Careful leaf analysis', text: 'A small image model looks at tomato, potato and bell pepper leaves, and says when it isn’t sure.', color: 'blush', rotate: 2, hand: 'honest, not scary' },
  { icon: 'bell', title: 'Gentle reminders', text: 'Water, mist, rotate, feed. Tick one off and it’s logged in the journal for you.', color: 'sage', rotate: -1, hand: 'no more crispy basil' },
  { icon: 'book', title: 'A cited care guide', text: 'Short summaries of extension-service advice, every one linked to its source.', color: 'sky', rotate: 1.5, hand: 'with real sources' },
  { icon: 'compare', title: 'Side-by-side compare', text: 'Line up last week and this week to see whether marks are spreading.', color: 'lilac', rotate: -2.5, hand: 'same angle!' },
  { icon: 'download', title: 'Installable & yours', text: 'Add it to your home screen, export everything, delete everything. Your data, your garden.', color: 'peach', rotate: 2.5, hand: 'works on phones' },
]

function Features() {
  return (
    <section id="features" className="relative scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[76rem]">
        <SectionTitle eyebrow="Features" title="Everything a plant story needs" />
        <div className="mt-14 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <RevealNote key={f.title} color={f.color} rotate={f.rotate} index={i} className="p-7 pt-9">
              <motion.span
                className="grid size-12 place-items-center rounded-2xl bg-card/80 text-forest"
                whileHover={{ rotate: [0, -12, 10, 0], transition: { duration: 0.5 } }}
              >
                <Icon name={f.icon} size={24} />
              </motion.span>
              <h3 className="mt-4 text-[1.5rem] text-forest">{f.title}</h3>
              <p className="mt-2 text-ink/80">{f.text}</p>
              <p className="mt-4 -rotate-2 font-hand text-[1.35rem] text-blush-ink">{f.hand}</p>
            </RevealNote>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---- Polaroids ----------------------------------------------------------------

const POLAROIDS = [
  { src: tomatoCover, caption: 'Rosa, first fruit', date: 'Jul 2', rotate: -6 },
  { src: tomatoLeaf, caption: 'spots? watching…', date: 'Sep 30', rotate: 4 },
  { src: basilCover, caption: 'basil jungle', date: 'Aug 14', rotate: -3 },
  { src: monsteraCover, caption: 'Monty’s new split!', date: 'Sep 2', rotate: 5 },
  { src: basil2, caption: 'after the pesto', date: 'Oct 6', rotate: -4 },
  { src: monstera1, caption: 'by the window now', date: 'Sep 28', rotate: 3 },
]

function Polaroid({ p, i, progress }: { p: (typeof POLAROIDS)[number]; i: number; progress: MotionValue<number> }) {
  const y = useTransform(progress, [0, 1], [i % 2 ? 80 : -40, i % 2 ? -80 : 60])
  return (
    <motion.figure
      style={{ y }}
      initial={{ opacity: 0, scale: 0.8, rotate: p.rotate * 2 }}
      whileInView={{ opacity: 1, scale: 1, rotate: p.rotate }}
      whileHover={{ scale: 1.08, rotate: 0, zIndex: 10 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 140, damping: 16, delay: (i % 3) * 0.08 }}
      className="relative w-52 shrink-0 bg-white p-3 pb-12 shadow-[0_20px_36px_-20px_rgb(24_37_28/0.6)] sm:w-60"
    >
      <span className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 -rotate-3 bg-white/60 shadow-sm" aria-hidden="true" />
      <img src={p.src} alt="" loading="lazy" className="aspect-square w-full object-cover" />
      <figcaption className="absolute inset-x-3 bottom-2 flex items-baseline justify-between font-hand text-xl text-forest">
        {p.caption}
        <span className="text-base text-muted">{p.date}</span>
      </figcaption>
    </motion.figure>
  )
}

function PhotoStory() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const x = useTransform(scrollYProgress, [0, 1], ['6%', '-28%'])
  return (
    <section ref={ref} className="relative overflow-hidden bg-forest py-28 text-card">
      <Petals />
      <div className="relative mx-auto max-w-[76rem] px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}>
          <p className="eyebrow text-sage">One photograph at a time</p>
          <h2 className="title-lg mt-3 max-w-2xl !text-card">Follow your plant&rsquo;s story, from seedling to “look at you now.”</h2>
        </motion.div>
      </div>
      <motion.div style={{ x }} className="relative mt-16 flex gap-10 px-8 py-16">
        {POLAROIDS.map((p, i) => (
          <Polaroid key={i} p={p} i={i} progress={scrollYProgress} />
        ))}
      </motion.div>
    </section>
  )
}

// ---- Honest model -------------------------------------------------------------

function Honest() {
  return (
    <section id="honest" className="relative scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[76rem] items-center gap-14 lg:grid-cols-[1fr_1.1fr]">
        <SectionTitle eyebrow="The image model, honestly" title="It tells you when it doesn’t know">
          Most apps hide their numbers. We pin ours to the board. The model is excellent on tidy lab photos and much less sure in a
          real garden, so it often answers &ldquo;inconclusive&rdquo; rather than guessing.
        </SectionTitle>
        <div className="relative grid gap-6 sm:grid-cols-2">
          <RevealNote color="sage" rotate={-3} index={0} pin className="p-7 pt-10">
            <p className="font-serif text-6xl text-forest">
              <CountUp to={99.3} />
            </p>
            <p className="mt-2 font-hand text-2xl text-ink">accuracy on lab photos</p>
            <p className="mt-1 text-sm text-muted">3,434 PlantVillage test images</p>
          </RevealNote>
          <RevealNote color="blush" rotate={3} index={1} pin className="p-7 pt-10 sm:mt-16">
            <p className="font-serif text-6xl text-blush-ink">
              <CountUp to={54.5} />
            </p>
            <p className="mt-2 font-hand text-2xl text-ink">on real-world photos</p>
            <p className="mt-1 text-sm text-muted">310 held-out PlantDoc images</p>
          </RevealNote>
          <RevealNote color="butter" rotate={-1.5} index={2} className="p-6 sm:col-span-2 sm:mx-10">
            <div className="flex items-start gap-4">
              <HerbMark size={48} />
              <p className="font-hand text-[1.55rem] leading-snug text-forest">
                &ldquo;A photo alone cannot confirm a cause.&rdquo; We say it on every result, and we mean it.
              </p>
            </div>
          </RevealNote>
        </div>
      </div>
    </section>
  )
}

// ---- Call to action -----------------------------------------------------------

function DemoCta({ onDemo }: { onDemo: () => void }) {
  const [opening, setOpening] = useState(false)
  const { reduced } = useMotionPrefs()
  const go = () => {
    if (opening) return
    setOpening(true)
    setTimeout(onDemo, reduced ? 0 : 1100)
  }
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-28 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.h2
          className="display text-forest"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          You&rsquo;ve got <span className="italic text-blush-ink">mail</span>.
        </motion.h2>
        <p className="mt-4 max-w-md text-[1.08rem] text-muted">
          A ready-made garden is waiting: three plants, a journal, reminders and a sample analysis. Nothing to install.
        </p>

        <motion.button
          type="button"
          onClick={go}
          className="group relative mt-14 aspect-[3/2] w-[min(86vw,22rem)] rounded-lg"
          style={{ perspective: 1000 }}
          initial={{ opacity: 0, y: 40, rotate: 4 }}
          whileInView={{ opacity: 1, y: 0, rotate: -2 }}
          whileHover={{ rotate: 0, scale: 1.04 }}
          whileTap={{ scale: 0.98 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 150, damping: 16 }}
          aria-label="Open the demo garden"
        >
          <div className="absolute inset-0 rounded-lg bg-forest-soft shadow-[0_30px_50px_-24px_rgb(24_37_28/0.7)]" />
          <motion.div
            className="paper absolute inset-x-[7%] top-[10%] flex h-[80%] flex-col items-center justify-center rounded-md"
            animate={{ y: opening ? '-120%' : '0%', rotate: opening ? -6 : 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: opening ? 0.35 : 0 }}
            style={{ zIndex: 2 }}
          >
            <p className="font-hand text-3xl text-forest">Welcome to your garden</p>
            <LogoSymbol size={44} />
          </motion.div>
          <div className="absolute inset-0 rounded-lg bg-forest" style={{ zIndex: 3, clipPath: 'polygon(0 0, 50% 62%, 100% 0, 100% 100%, 0 100%)' }} />
          <motion.div
            className="absolute inset-x-0 top-0 h-[62%] origin-top transition-transform duration-500 group-hover:[transform:rotateX(35deg)]"
            animate={opening ? { rotateX: 180 } : undefined}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ zIndex: opening ? 1 : 4 }}
          >
            <div className="absolute inset-0 bg-[#1d4a33]" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
          </motion.div>
          <span className="absolute inset-x-0 bottom-[14%] z-[5] font-hand text-[1.7rem] text-card">
            {opening ? 'opening…' : 'tap to open the demo'}
          </span>
        </motion.button>

        <p className="mt-10 text-sm text-muted">
          Prefer the real thing?{' '}
          <Link to="/welcome" className="font-medium text-forest underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
      <Sticky color="lilac" rotate={-8} className="top-24 left-[6%] hidden w-36 p-4 text-xl md:block" sway>
        it&rsquo;s free!
      </Sticky>
      <Sticky color="peach" rotate={6} className="right-[7%] bottom-32 hidden w-40 p-4 text-xl md:block" sway>
        your data stays in this browser
      </Sticky>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line bg-card/60 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[76rem] flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
        <div>
          <Logo size={34} />
          <p className="mt-2 font-hand text-xl text-muted">A little care. A little bloom.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-6 text-sm text-muted">
          <a href="#how" className="hover:text-forest">How it works</a>
          <a href="#features" className="hover:text-forest">Features</a>
          <a href="#honest" className="hover:text-forest">Honest AI</a>
          <Link to="/welcome" className="hover:text-forest">Sign in</Link>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-[76rem] border-t border-line pt-6 text-center text-sm text-muted">
        Developed by: <span className="font-medium text-forest">Erti Hoxha</span>
      </p>
    </footer>
  )
}

export default function HomePage() {
  const onDemo = useStartDemo()
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => {
      document.documentElement.style.scrollBehavior = ''
    }
  }, [])

  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <Header onDemo={onDemo} />
      <main id="main">
        <Hero onDemo={onDemo} />
        <Marquee />
        <HowItWorks />
        <Letters />
        <Features />
        <PhotoStory />
        <Honest />
        <DemoCta onDemo={onDemo} />
      </main>
      <Footer />
    </div>
  )
}
