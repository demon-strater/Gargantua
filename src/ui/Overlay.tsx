import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import type { DeviceInfo } from '../lib/quality'
import { intro, physics, setUi, startFlight, useUi } from '../state/store'
import { ControlsHelp, FlightTelemetry, RadialGauge, Reticle } from './FlightHud'
import { PhysicsPanel } from './PhysicsPanel'
import { ScanPopup } from './ScanPopup'
import { TouchControls } from './TouchControls'
import { ObservatoryControls } from './ObservatoryControls'
import { Icon } from './Icon'

export function Overlay({ device }: { device: DeviceInfo }) {
  const root = useRef<HTMLDivElement>(null)
  const ready = useUi(s => s.ready)
  const engaged = useUi(s => s.engaged)
  const cinematic = useUi(s => s.cinematic)
  const locked = useUi(s => s.pointerLocked)
  const touch = device.mobile || window.matchMedia('(pointer: coarse)').matches

  useLayoutEffect(() => {
    if (!ready) return
    const ctx = gsap.context(() => {
      const duration = device.reducedMotion ? 0 : 2.4
      gsap.timeline()
        .to('.veil', { autoAlpha: 0, duration: 0.7 })
        .to(physics, { fade: 1, duration, ease: 'power2.out' }, 0)
        .to(intro, { k: 0, duration, ease: 'power3.out' }, 0)
        .fromTo('.console-shell', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.35)
    }, root)
    return () => ctx.revert()
  }, [ready, device.reducedMotion])

  return (
    <div ref={root} className="overlay" data-cinematic={cinematic} data-engaged={engaged} data-ready={ready}>
      <div className="veil" aria-hidden={ready}>
        <div className="loader-orbit"><span /><i /></div>
        <span className="veil__text">INITIALIZING OBSERVATORY</span>
        <span className="veil__sub">시공간을 계산하는 중</span>
      </div>
      <div className="console-shell" inert={cinematic || !ready}>
        <div className="screen-vignette" aria-hidden="true" />
        <header className="chrome">
          <div className="brand">
            <span className="brand__symbol"><Icon name="orbit" /></span>
            <span><span className="brand__mark">GARGANTUA<span className="brand__registered">/ 02</span></span><span className="brand__sub">DEEP SPACE OBSERVATORY</span></span>
          </div>
          <div className="header-mission"><span className="status-dot" /> EXPEDITION 001 <span className="slash">/</span> LIVE OBSERVATION</div>
          <button className="header-controls" onClick={() => setUi({ helpOpen: true })}><Icon name="info" /><span>조작 안내</span><kbd>H</kbd></button>
        </header>
        <div className="telemetry-strip"><span className="telemetry-strip__label">TELEMETRY <i /></span><FlightTelemetry /></div>
        <section className="mission">
          <p className="eyebrow"><span>01</span> BEYOND THE EVENT HORIZON</p>
          <h1>THE EDGE<br />OF <em>INFINITY.</em></h1>
          <div className="mission__rule"><i /><span>가르강튀아 관측 프로젝트</span></div>
          <p className="mission__description">빛이 휘어지고, 시간이 느려지는 곳.<br />미지의 시공간을 자유롭게 탐사하세요.</p>
          <button className="flight-button" disabled={!ready} onClick={startFlight}>
            <Icon name="flight" /><span>{engaged ? '자유 비행 계속하기' : '자유 비행 시작'}<small>{engaged ? 'RESUME EXPLORATION' : 'BEGIN EXPLORATION'}</small></span><Icon name="arrow" />
          </button>
          <div className="mission__coordinates"><span>CLASSIFICATION</span><strong>SUPERMASSIVE · KERR</strong><span>COORDINATE SYSTEM</span><strong>G = c = M = 1</strong></div>
        </section>
        <div className="scene-label scene-label--top" aria-hidden="true"><span>GARGANTUA</span><i />KERR SINGULARITY</div>
        <div className="scene-label scene-label--bottom" aria-hidden="true"><i /> ACCRETION FLOW <span>RELATIVISTIC RAY TRACING</span></div>
        {engaged && <Reticle />}
        <ScanPopup reducedMotion={device.reducedMotion} />
        <RadialGauge />
        <ObservatoryControls />
        <ControlsHelp />
        <PhysicsPanel />
        {touch && <TouchControls />}
        {engaged && !locked && !touch && <div className="flight-hint">화면 클릭으로 시선 고정 <span>·</span> 드래그로 둘러보기 <span>·</span> <kbd>ESC</kbd> 해제</div>}
        <div className="frame-corner frame-corner--tl" /><div className="frame-corner frame-corner--tr" /><div className="frame-corner frame-corner--bl" /><div className="frame-corner frame-corner--br" />
      </div>
      {cinematic && <button className="cinema-exit" onClick={() => setUi({ cinematic: false })}><Icon name="grid" /> 관측 콘솔 표시 <kbd>V</kbd></button>}
    </div>
  )
}
