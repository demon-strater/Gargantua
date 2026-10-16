import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { flight, getUi, useUi } from '../state/store'
import { ZONES, buildContext, detectZone, type Context, type Zone, type ZoneId } from './zones'

/** 비행 위치를 감시해 가까워진 구조의 스캔 팝업을 띄웁니다. */
export function ScanPopup({ reducedMotion }: { reducedMotion: boolean }) {
  const engaged = useUi((state) => state.engaged)
  const [zoneId, setZoneId] = useState<ZoneId | null>(null)
  const [context, setContext] = useState<Context | null>(null)

  useEffect(() => {
    if (!engaged) return
    let current: ZoneId | null = null
    const tick = () => {
      const ctx = buildContext(getUi().params)
      const next = detectZone(ctx, current)
      if (next !== current) {
        current = next
        setZoneId(next)
      }
      setContext(ctx)
    }
    tick()
    const timer = window.setInterval(tick, 200)
    return () => window.clearInterval(timer)
  }, [engaged])

  const zone = ZONES.find((item) => item.id === zoneId)
  if (!engaged || !zone || !context) return null
  return <ScanCard key={zone.id} zone={zone} context={context} reducedMotion={reducedMotion} />
}

function ScanCard({ zone, context, reducedMotion }: { zone: Zone; context: Context; reducedMotion: boolean }) {
  const root = useRef<HTMLElement>(null)
  const titleEn = useScramble(zone.titleEn, reducedMotion)

  // 등장: 위에서 아래로 스캔하듯 열리며 가로로 몇 번 튀는 글리치
  useLayoutEffect(() => {
    if (!root.current || reducedMotion) return
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo('.scan__frame', { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.55, ease: 'steps(9)' })
        .to('.scan__frame', { keyframes: { x: [-10, 6, -4, 3, -1, 0] }, duration: 0.36, ease: 'none' }, 0)
        .fromTo('.scan__frame', { opacity: 0.2 }, { opacity: 1, duration: 0.3, ease: 'steps(5)' }, 0)
        .fromTo('[data-row]', { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.06 }, 0.35)
    }, root)
    return () => ctx.revert()
  }, [reducedMotion])

  const rows = zone.rows(context)
  return (
    <aside ref={root} className="scan" data-accent={zone.accent} aria-live="polite">
      <div className="scan__frame">
        <div className="scan__inner">
          <header className="scan__bar">
            <span>{zone.code}</span>
            <span className="scan__rec">● LIVE</span>
          </header>
          <div className="scan__body">
            <p className="scan__en">{titleEn}</p>
            <h3 className="scan__title">{zone.title}</h3>
            <p className="scan__desc">{zone.description}</p>
            <div className="scan__grid">
              <StructureMap zone={zone.id} context={context} />
              <dl className="scan__rows">
                {rows.map(([label, value]) => (
                  <div key={label} data-row>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <footer className="scan__foot">
            <span>R {context.r.toFixed(2)} M</span>
            <span>θ {((context.theta * 180) / Math.PI).toFixed(1)}°</span>
            <span>a {context.a.toFixed(3)}</span>
          </footer>
        </div>
      </div>
    </aside>
  )
}

/**
 * 위에서 내려다본 구조도 (로그 반지름 눈금): 지평선 · 에르고스피어 · 광자 궤도 · ISCO · 원반 · 행성 궤도.
 * 지금 열린 구조를 강조하고, 내 위치를 점으로 표시합니다.
 */
function StructureMap({ zone, context }: { zone: ZoneId; context: Context }) {
  const size = 128
  const c = size / 2
  const max = Math.max(context.outer * 1.25, 18)
  const f = (r: number) => (Math.log1p(r) / Math.log1p(max)) * (c - 6)
  const hot = (id: ZoneId) => (zone === id ? 'is-hot' : undefined)
  const azimuth = Math.atan2(flight.position.z, flight.position.x)
  const me = Math.min(f(context.r), c - 3)

  return (
    <svg className="scan__map" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={c - 2} className="map__frame" />
      <line x1={c} y1={4} x2={c} y2={size - 4} className="map__axis" />
      <line x1={4} y1={c} x2={size - 4} y2={c} className="map__axis" />
      <circle cx={c} cy={c} r={(f(context.inner) + f(context.outer)) / 2} className={`map__disk ${hot('disk') ?? ''}`} strokeWidth={Math.max(f(context.outer) - f(context.inner), 1)} />
      <circle cx={c} cy={c} r={f(14.8)} className={`map__planet ${hot('planet') ?? ''}`} />
      <circle cx={c} cy={c} r={f(context.isco)} className={`map__isco ${hot('isco') ?? ''}`} />
      <circle cx={c} cy={c} r={(f(context.photon[0]) + f(context.photon[1])) / 2} strokeWidth={Math.max(f(context.photon[1]) - f(context.photon[0]), 1)} className={`map__photon ${hot('photon') ?? ''}`} />
      <circle cx={c} cy={c} r={f(2)} className={`map__ergo ${hot('ergo') ?? ''}`} />
      <circle cx={c} cy={c} r={f(context.rh)} className={`map__horizon ${hot('horizon') ?? ''}`} />
      <circle cx={c + Math.cos(azimuth) * me} cy={c + Math.sin(azimuth) * me} r={3} className="map__me" />
    </svg>
  )
}

/** 영문 제목이 무작위 기호에서 한 글자씩 해독되듯 나타나는 효과 */
function useScramble(text: string, disabled: boolean) {
  const [output, setOutput] = useState(text)
  useEffect(() => {
    if (disabled) {
      setOutput(text)
      return
    }
    const glyphs = '01<>/\\_-=+#%&ABCDEFXYZ'
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const progress = Math.min((now - start) / 650, 1)
      const shown = Math.floor(progress * text.length)
      let out = text.slice(0, shown)
      for (let i = shown; i < text.length; i++) out += text[i] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0]
      setOutput(out)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [text, disabled])
  return output
}
