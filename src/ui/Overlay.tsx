import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { DeviceInfo } from '../lib/quality'
import { getUi, intro, physics, pointer, rig, setUi, telemetry, useUi } from '../state/store'

gsap.registerPlugin(ScrollTrigger)

const QUOTE = 'Somewhere, something incredible is waiting to be known.'

const CHAPTERS = [
  {
    index: '01',
    title: 'Gravitational Lensing',
    lead: '시공간이 빛을 휘게 합니다',
    body: '블랙홀 뒤편에 있는 원반의 빛이 중력에 끌려 위아래로 감겨 올라옵니다. 그림자 위로 솟은 고리는, 사실 블랙홀 너머에 있는 원반의 뒷면입니다.',
    data: 'Deflection ≈ 2 Rs / b',
  },
  {
    index: '02',
    title: 'Relativistic Beaming',
    lead: '다가오는 빛은 더 푸르고, 더 밝게',
    body: '안쪽 원반은 광속의 절반에 가까운 속도로 돕니다. 우리를 향해 오는 쪽은 청색 편이와 함께 타오르고, 멀어지는 쪽은 붉게 식어 갑니다.',
    data: 'v(ISCO) ≈ 0.5 c  ·  I ∝ δ³',
  },
  {
    index: '03',
    title: 'Photon Sphere',
    lead: '빛마저 궤도를 도는 곳',
    body: '그림자 가장자리의 가느다란 빛의 고리는 블랙홀을 한 바퀴, 혹은 그 이상 휘감은 뒤에야 빠져나온 광자들입니다.',
    data: 'r = 1.5 Rs  ·  b꜀ = 3√3⁄2 Rs',
  },
  {
    index: '04',
    title: 'Event Horizon',
    lead: '돌아올 수 없는 경계',
    body: '이 너머로는 빛조차 돌아오지 못합니다. 여기서 흐르는 한 시간은, 먼 우주에서 흐르는 한 시간보다 깁니다.',
    data: 'r = 1 Rs  ·  v(escape) = c',
  },
] as const

export function Overlay({ device }: { device: DeviceInfo }) {
  const root = useRef<HTMLDivElement>(null)
  const ready = useUi((state) => state.ready)

  useScrollJourney(root)
  useIntro(root, ready, device.reducedMotion)
  usePointerParallax()

  return (
    <div ref={root} className="overlay">
      <div className="veil" aria-hidden="true">
        <span className="veil__text">Calibrating spacetime</span>
      </div>

      <header className="chrome">
        <div className="brand">
          <span className="brand__mark">Gargantua</span>
          <span className="brand__sub">Schwarzschild · 10⁸ M☉</span>
        </div>
        <Hud />
      </header>

      <main className="journey">
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

        {CHAPTERS.map((chapter) => (
          <section key={chapter.index} className="chapter">
            <article className="chapter__card">
              <p className="chapter__index" data-reveal>
                {chapter.index} <span />
              </p>
              <h2 className="chapter__title" data-reveal>
                {chapter.title}
              </h2>
              <p className="chapter__lead" data-reveal>
                {chapter.lead}
              </p>
              <p className="chapter__body" data-reveal>
                {chapter.body}
              </p>
              <p className="chapter__data" data-reveal>
                {chapter.data}
              </p>
            </article>
          </section>
        ))}
      </main>

      <div className="scroll-hint" aria-hidden="true">
        <div className="scroll-hint__inner">
          <span>Scroll to descend</span>
          <i />
        </div>
      </div>

      <Controls />
    </div>
  )
}

/** 스크롤 진행도 → 카메라 궤도 (점점 빨려 들어가는 줌인) + 챕터 텍스트 등장 */
function useScrollJourney(root: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap
        .timeline({
          defaults: { duration: 1, ease: 'sine.inOut' },
          scrollTrigger: { trigger: '.journey', start: 'top top', end: 'bottom bottom', scrub: 1.6 },
        })
        .to(rig, { distance: 20, elevation: 0.26, azimuth: -0.55, fov: 42, roll: -0.03 })
        .to(rig, { distance: 14, elevation: 0.05, azimuth: -1.2, fov: 46, roll: 0.035 })
        .to(rig, { distance: 9.5, elevation: 0.15, azimuth: -1.85, fov: 54, roll: -0.02 })
        .to(rig, { distance: 6.2, elevation: 0.075, azimuth: -2.35, fov: 64, roll: 0, ease: 'power2.in' })

      gsap.utils.toArray<HTMLElement>('.chapter').forEach((chapter) => {
        gsap.fromTo(
          chapter.querySelectorAll('[data-reveal]'),
          { autoAlpha: 0, y: 36, filter: 'blur(10px)' },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 1.4,
            stagger: 0.12,
            ease: 'power3.out',
            scrollTrigger: { trigger: chapter, start: 'top 62%', end: 'bottom 38%', toggleActions: 'play reverse play reverse' },
          },
        )
      })

      gsap.to('.hero__inner', {
        autoAlpha: 0,
        y: -70,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 35%', scrub: true },
      })
      gsap.to('.scroll-hint', {
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.hero', start: 'top top', end: '30% top', scrub: true },
      })
    }, root)
    return () => ctx.revert()
  }, [root])
}

/** 셰이더 컴파일이 끝나면: 어둠 속에서 날아 들어오며 노출이 차오르고, 명언이 한 단어씩 떠오릅니다. */
function useIntro(root: RefObject<HTMLDivElement | null>, ready: boolean, reducedMotion: boolean) {
  useLayoutEffect(() => {
    if (!ready) return
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .to('.veil', { autoAlpha: 0, duration: 2.2, ease: 'power2.inOut' }, 0)
        .fromTo(physics, { exposure: 0 }, { exposure: 1, duration: 4.5, ease: 'power2.out' }, 0)
        .fromTo(intro, { k: 1 }, { k: 0, duration: reducedMotion ? 0.01 : 8, ease: 'expo.out' }, 0)
        .fromTo('.hero__eyebrow', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'power3.out' }, 1.8)
        .fromTo(
          '.quote__word',
          { autoAlpha: 0, y: 14, filter: 'blur(12px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 2, stagger: 0.16, ease: 'power3.out' },
          2.4,
        )
        .fromTo('.quote__cite', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 1.6, ease: 'power2.out' }, '-=0.9')
        .fromTo(
          ['.chrome', '.controls', '.scroll-hint__inner'],
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 1.8, stagger: 0.2, ease: 'power2.out' },
          '-=1.2',
        )
    }, root)
    return () => ctx.revert()
  }, [root, ready, reducedMotion])
}

/** 마우스/터치 위치를 gsap.quickTo로 관성 있게 따라가 카메라 궤도에 반영합니다. */
function usePointerParallax() {
  useEffect(() => {
    const toX = gsap.quickTo(pointer, 'x', { duration: 1.8, ease: 'power3.out' })
    const toY = gsap.quickTo(pointer, 'y', { duration: 1.8, ease: 'power3.out' })
    const onMove = (event: PointerEvent) => {
      toX((event.clientX / window.innerWidth) * 2 - 1)
      toY((event.clientY / window.innerHeight) * 2 - 1)
    }
    const onLeave = () => {
      toX(0)
      toY(0)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])
}

/** 카메라 위치의 거리 / 시간 지연 / 렌더 품질을 실시간으로 표시 (리렌더 없이 DOM 직접 갱신) */
function Hud() {
  const distanceRef = useRef<HTMLElement>(null)
  const dilationRef = useRef<HTMLElement>(null)
  const renderRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - last < 120) return
      last = now
      const r = telemetry.distance
      const { tier, dpr } = getUi()
      if (distanceRef.current) distanceRef.current.textContent = `${r.toFixed(1)} Rs`
      if (dilationRef.current) dilationRef.current.textContent = `×${(1 / Math.sqrt(1 - 1 / r)).toFixed(4)}`
      if (renderRef.current) renderRef.current.textContent = `${tier} · ${dpr.toFixed(2)}x`
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <dl className="hud">
      <div>
        <dt>Distance</dt>
        <dd ref={distanceRef}>—</dd>
      </div>
      <div>
        <dt>Time dilation</dt>
        <dd ref={dilationRef}>—</dd>
      </div>
      <div className="hud__render">
        <dt>Render</dt>
        <dd ref={renderRef}>—</dd>
      </div>
    </dl>
  )
}

/** 물리 효과를 켜고 끄며 비교해 볼 수 있는 토글 */
function Controls() {
  const doppler = useUi((state) => state.doppler)
  const lensing = useUi((state) => state.lensing)

  const toggle = (key: 'doppler' | 'lensing', on: boolean) => {
    setUi({ [key]: on })
    gsap.to(physics, { [key]: on ? 1 : 0, duration: 1.8, ease: 'power2.inOut', overwrite: 'auto' })
  }

  return (
    <div className="controls">
      <button type="button" aria-pressed={doppler} onClick={() => toggle('doppler', !doppler)}>
        <i /> Doppler beaming
      </button>
      <button type="button" aria-pressed={lensing} onClick={() => toggle('lensing', !lensing)}>
        <i /> Gravitational lensing
      </button>
    </div>
  )
}
