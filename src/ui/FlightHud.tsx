import { useEffect, useRef, useState, type RefObject } from 'react'
import { ergosphereRadius, horizonRadius, iscoRadius, photonOrbitRadii } from '../lib/kerr'
import { getUi, physics, telemetry, useUi } from '../state/store'

/** 우측 상단 계측값 (리렌더 없이 DOM 직접 갱신) */
export function FlightTelemetry() {
  const refs = {
    r: useRef<HTMLElement>(null),
    dilation: useRef<HTMLElement>(null),
    speed: useRef<HTMLElement>(null),
    spin: useRef<HTMLElement>(null),
    render: useRef<HTMLElement>(null),
  }

  useEffect(() => {
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 100) return
      last = now
      const { tier, dpr } = getUi()
      set(refs.r, `${telemetry.r.toFixed(2)} M`)
      set(refs.dilation, `×${(1 / telemetry.alpha).toFixed(telemetry.alpha < 0.1 ? 1 : 4)}`)
      set(refs.speed, `${telemetry.speed.toFixed(1)} M/s`)
      set(refs.spin, physics.spin.toFixed(3))
      set(refs.render, `${tier} · ${dpr.toFixed(2)}x`)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <dl className="hud">
      <div>
        <dt>Radius</dt>
        <dd ref={refs.r}>—</dd>
      </div>
      <div>
        <dt>Time dilation</dt>
        <dd ref={refs.dilation}>—</dd>
      </div>
      <div className="hud__speed">
        <dt>Velocity</dt>
        <dd ref={refs.speed}>—</dd>
      </div>
      <div className="hud__spin">
        <dt>Spin a/M</dt>
        <dd ref={refs.spin}>—</dd>
      </div>
      <div className="hud__render">
        <dt>Render</dt>
        <dd ref={refs.render}>—</dd>
      </div>
    </dl>
  )
}

function set(ref: RefObject<HTMLElement | null>, text: string) {
  if (ref.current && ref.current.textContent !== text) ref.current.textContent = text
}

/** 화면 중앙 조준선 */
export function Reticle() {
  return (
    <div className="reticle" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <b />
    </div>
  )
}

/** 하단 반지름 게이지: 지평선부터 120 M까지 로그 눈금 위에 구조와 내 위치를 표시 */
export function RadialGauge() {
  const marker = useRef<HTMLSpanElement>(null)
  const [ticks, setTicks] = useState<{ label: string; r: number; x: number }[]>([])

  useEffect(() => {
    let frame = 0
    let lastTicks = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const rh = horizonRadius(physics.spin)
      const scale = (r: number) => Math.min(Math.max(Math.log(r / rh) / Math.log(120 / rh), 0), 1)
      if (marker.current) marker.current.style.left = `${scale(telemetry.r) * 100}%`
      // 스핀이 변하면(형태 변형 재생) 눈금 위치도 따라 움직입니다.
      if (now - lastTicks > 150) {
        lastTicks = now
        const a = physics.spin
        const [pro, retro] = photonOrbitRadii(a)
        const list = [
          { label: 'r₊', r: rh },
          { label: '에르고', r: ergosphereRadius(a, Math.PI / 2) },
          { label: '광자', r: (pro + retro) / 2 },
          { label: 'ISCO', r: iscoRadius(a) },
          { label: '행성', r: 14.8 },
          { label: '원반 끝', r: physics.outer },
        ]
        setTicks(list.map((item) => ({ ...item, x: scale(item.r) * 100 })))
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="gauge" aria-hidden="true">
      <div className="gauge__track">
        {ticks.map((item) => (
          <span key={item.label} className="gauge__tick" style={{ left: `${item.x}%` }}>
            <em>{item.label}</em>
          </span>
        ))}
        <span ref={marker} className="gauge__marker" />
      </div>
      <div className="gauge__scale">
        <span>EVENT HORIZON</span>
        <span>RADIAL DEPTH · LOG</span>
        <span>120 M</span>
      </div>
    </div>
  )
}

const KEYS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], '이동'],
  [['SPACE'], '상승'],
  [['SHIFT'], '하강'],
  [['CTRL'], '가속'],
  [['MOUSE'], '시선'],
  [['ESC'], '마우스 해제'],
  [['P'], '물리 패널'],
  [['H'], '도움말'],
]

/** 좌측 하단 조작 안내 (H로 접기) */
export function ControlsHelp() {
  const open = useUi((state) => state.helpOpen)
  return (
    <div className="keys" data-open={open}>
      <p className="keys__title">FLIGHT CONTROLS</p>
      {open && (
        <ul>
          {KEYS.map(([caps, label]) => (
            <li key={label}>
              <span>
                {caps.map((cap) => (
                  <kbd key={cap}>{cap}</kbd>
                ))}
              </span>
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 비행 시작 안내 / 마우스 고정 안내 */
export function EngagePrompt({ touch }: { touch: boolean }) {
  const ready = useUi((state) => state.ready)
  const engaged = useUi((state) => state.engaged)
  const locked = useUi((state) => state.pointerLocked)
  const panelOpen = useUi((state) => state.panelOpen)

  if (!ready) return null
  if (!engaged) {
    return (
      <div className="engage" role="status">
        <span className="engage__btn">[ {touch ? 'TAP' : 'CLICK'} TO ENGAGE ]</span>
        <span className="engage__sub">{touch ? '화면을 터치하면 비행을 시작합니다' : '클릭하면 자유 비행을 시작합니다'}</span>
      </div>
    )
  }
  if (!touch && !locked && !panelOpen) {
    return (
      <div className="engage engage--hint" role="status">
        <span className="engage__sub">클릭: 마우스 시점 고정 · 드래그: 시선 회전</span>
      </div>
    )
  }
  return null
}
