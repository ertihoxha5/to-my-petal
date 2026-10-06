import type { SVGProps } from 'react'

/** Fine line icons on a 24px grid, 1.5px stroke, round joins. */
const paths = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  journal: 'M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5m0-13c2-1.5 5-2 8-1.5v13c-3-.5-6 0-8 1.5m0-13v13',
  plus: 'M12 5v14M5 12h14',
  leaf: 'M5 19C5 10 10 5 19 5c0 9-5 14-14 14Zm0 0 8-8',
  sprout: 'M12 20v-8m0 0c0-3.5-2.5-6-6.5-6C5.5 9.5 8 12 12 12Zm0 0c0-4 2.5-7 7-7 0 4-3 7-7 7Z',
  upload: 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4',
  arrowRight: 'M5 12h14m-5-5 5 5-5 5',
  arrowLeft: 'M19 12H5m5-5-5 5 5 5',
  chevronRight: 'm9 6 6 6-6 6',
  chevronDown: 'm6 9 6 6 6-6',
  calendar: 'M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1ZM8 4v4m8-4v4M4 10.5h16',
  water:
    'M4 10h9.5l3-2.5H19M4 10v6.5A2.5 2.5 0 0 0 6.5 19h4.5a2.5 2.5 0 0 0 2.5-2.5V10M13.5 12.5l4 1.5 1.5-1M6 10V8a2 2 0 0 1 2-2h1.5',
  wipe: 'M6 18c-1-6 3-11 12-12-1 9-6 13-12 12Zm0 0 7-7m-9.5 9.5L6 18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6',
  mist: 'M8 10h8M6 14h12M9 18h6M12 3c-2 2.5-3 4-3 5.2a3 3 0 0 0 6 0C15 7 14 5.5 12 3Z',
  feed: 'M7 20h10l1-9H6l1 9Zm1-9V8a4 4 0 0 1 8 0v3',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8a7.5 7.5 0 0 1 15 0',
  close: 'M6 6l12 12M18 6 6 18',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Zm9.5-13.5 4 4',
  trash: 'M5 7h14m-9 0V5h4v2m-7 0 .8 12a1 1 0 0 0 1 1h6.4a1 1 0 0 0 1-1L17 7',
  archive: 'M4 5h16v4H4zM5.5 9v10h13V9M10 13h4',
  camera: 'M4 8a1 1 0 0 1 1-1h3l1.5-2h5L16 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Zm8 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  compare: 'M12 3v18M8 7H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3m8-10h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3',
  alert: 'M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.5v.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v6m0-9v.5',
  question: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1V14m0 3v.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5m0-15v15m0 0A1.5 1.5 0 0 0 6.5 21H19v-3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  external: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  download: 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14',
  image: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6Zm0 10 4.5-4.5L13 16l2.5-2.5L20 18M15.5 9.5h.01',
  note: 'M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20V3.5Zm8.5 0V8H19M9 12h6m-6 3.5h6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3m0 8v3a1 1 0 0 1-1 1h-3m-8 0H5a1 1 0 0 1-1-1v-3M8 12h8',
  rotate: 'M4 12a8 8 0 0 1 13.7-5.7L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.7L4 15.5M4 20v-4.5h4.5',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.5 7.5 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.5 7.5 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
} as const

export type IconName = keyof typeof paths

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.5,
  title,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number; title?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={paths[name]} />
    </svg>
  )
}

export const reminderIcon: Record<string, IconName> = {
  water: 'water',
  wipe_leaves: 'wipe',
  rotate_light: 'rotate',
  check_light: 'sun',
  mist: 'mist',
  feed: 'feed',
  custom: 'bell',
}
