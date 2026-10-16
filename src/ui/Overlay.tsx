import { useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import type { DeviceInfo } from '../lib/quality'
import { intro, physics, useUi } from '../state/store'
import { ControlsHelp, EngagePrompt, FlightTelemetry, RadialGauge, Reticle } from './FlightHud'
import { PhysicsPanel } from './PhysicsPanel'
import { ScanPopup } from './ScanPopup'
import { TouchControls } from './TouchControls'

const QUOTE = 'Somewhere, something incredible is waiting to be known.'

export function Overlay({ device }: { device: DeviceInfo }) {
  const root = useRef<HTMLDivElement>(null)
  const ready = useUi((state) => state.ready)
  const engaged = useUi((state) => state.engaged)
  const touch = device.mobile || window.matchMedia('(pointer: coarse)').matches

  useIntro(root, ready, device.reducedMotion)
  useEngage(root, engaged)

  return (
    <div ref={root} className="overlay">
      <div className="veil" aria-hidden="true">
        <span className="veil__text">Calibrating spacetime</span>
      </div>

      <header className="chrome">
        <div className="brand">
          <span className="brand__mark">Gargantua</span>
          <span className="brand__sub">Kerr black hole · free flight</span>
        </div>
        <FlightTelemetry />
      </header>

      <section className="hero">
        <div className="hero__inner">
          <p className="hero__eyebrow">Expedition Log · 001</p>
          <blockquote className="quote">
            <p>
              {QUOTE.split(' ').map((word, i) => (
                <span key={i} className="quote__word">
                  {word}{' '}
                </span>
              ))}
            </p>
            <footer className="quote__cite">— Carl Sagan</footer>
          </blockquote>
        </div>
      </section>

      <EngagePrompt touch={touch} />

      <div className="flight-layer">
        <Reticle />
        <RadialGauge />
        {!touch && <ControlsHelp />}
      </div>

      <ScanPopup reducedMotion={device.reducedMotion} />
      {touch && <TouchControls />}
      <PhysicsPanel />
    </div>
  )
}

/** 셰이더 컴파일이 끝나면: 어둠 속에서 날아 들어오며 노출이 차오르고, 명언이 한 단어씩 떠오릅니다. */
function useIntro(root: RefObject<HTMLDivElement | null>, ready: boolean, reducedMotion: boolean) {
  useLayoutEffect(() => {
    if (!ready) return
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .to('.veil', { autoAlpha: 0, duration: 2.2, ease: 'power2.inOut' }, 0)
        .fromTo(physics, { fade: 0 }, { fade: 1, duration: 4.5, ease: 'power2.out' }, 0)
        .fromTo(intro, { k: 1 }, { k: 0, duration: reducedMotion ? 0.01 : 7, ease: 'expo.out' }, 0)
        .fromTo('.hero__eyebrow', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'power3.out' }, 1.8)
        .fromTo(
          '.quote__word',
          { autoAlpha: 0, y: 14, filter: 'blur(12px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 2, stagger: 0.16, ease: 'power3.out' },
          2.4,
        )
        .fromTo('.quote__cite', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'power2.out' }, '-=0.9')
        .fromTo(['.chrome', '.panel-dock', '.engage'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6, stagger: 0.15, ease: 'power2.out' }, 2.2)
    }, root)
    return () => ctx.revert()
  }, [root, ready, reducedMotion])
}

/** 비행을 시작하면 명언이 물러나고 비행 HUD가 켜집니다. */
function useEngage(root: RefObject<HTMLDivElement | null>, engaged: boolean) {
  useLayoutEffect(() => {
    if (!engaged) return
    const ctx = gsap.context(() => {
      gsap.to('.hero', { autoAlpha: 0, y: 30, duration: 1.2, ease: 'power2.in' })
      gsap.fromTo('.flight-layer', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, delay: 0.4, ease: 'power2.out' })
      gsap.set(['.chrome', '.panel-dock'], { autoAlpha: 1 })
    }, root)
    return () => ctx.revert()
  }, [root, engaged])
}
