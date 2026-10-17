import type { CSSProperties, ReactNode } from 'react'

export type IconName = 'orbit' | 'flight' | 'target' | 'sliders' | 'expand' | 'camera' | 'pause' | 'play' | 'close' | 'arrow' | 'info' | 'home' | 'chevron' | 'grid'
const paths: Record<IconName, ReactNode> = {
  orbit: <><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)" /><path d="m18 4 2 1 1-2" /></>,
  flight: <><path d="m12 3 8 17-8-4-8 4 8-17Z" /><path d="M12 3v13" /></>,
  target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 1v4m0 14v4M1 12h4m14 0h4" /></>,
  sliders: <><path d="M5 3v18M12 3v18M19 3v18" /><path d="M2 8h6m1 8h6m1-10h6" strokeWidth="3" /></>,
  expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  camera: <><path d="M3 7h5l2-3h4l2 3h5v13H3Z" /><circle cx="12" cy="13" r="4" /></>,
  pause: <path d="M8 5v14M16 5v14" strokeWidth="3" />,
  play: <path d="m8 4 12 8-12 8Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v1" /></>,
  home: <><path d="m3 10 9-7 9 7v10H3Z" /><path d="M9 20v-7h6v7" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  grid: <path d="M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z" />,
}
export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
