import { useEffect, useRef, useState } from 'react'
import { horizonRadius, iscoRadius, photonOrbitRadii } from '../lib/kerr'
import { flight, flyToView, getUi, goHome, physics, setUi, startFlight, telemetry, useUi } from '../state/store'
import { Icon, type IconName } from './Icon'

const DESTINATIONS = [
  { id: 'overview', number: '01', title: '파노라마', sub: 'PANORAMIC VIEW', radius: () => 38, elevation: 4.3 },
  { id: 'disk', number: '02', title: '강착 원반', sub: 'ACCRETION DISK', radius: () => Math.max(iscoRadius(physics.spin) + 2, physics.outer * .74), elevation: 12 },
  { id: 'photon', number: '03', title: '광자 궤도', sub: 'PHOTON REGION', radius: () => photonOrbitRadii(physics.spin)[1] + .35, elevation: 20 },
  { id: 'horizon', number: '04', title: '사건의 지평선', sub: 'EVENT HORIZON', radius: () => horizonRadius(physics.spin) + .17, elevation: 4.3 },
]

export function ObservatoryControls() {
  const ui = useUi(s => s)
  const fps = useRef<HTMLSpanElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const start = performance.now()
    const timer = window.setInterval(() => {
      if (fps.current) fps.current.textContent = `${Math.round(telemetry.fps)} FPS`
      const seconds = Math.floor((performance.now() - start) / 1000)
      if (clock.current) clock.current.textContent = `T+ ${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
    }, 500)
    const onCapture = () => setNotice('관측 이미지가 저장되었습니다')
    const onError = () => setNotice('이미지 저장에 실패했습니다. 다시 시도해 주세요.')
    window.addEventListener('gargantua:captured', onCapture)
    window.addEventListener('gargantua:capture-error', onError)
    return () => { clearInterval(timer); window.removeEventListener('gargantua:captured', onCapture); window.removeEventListener('gargantua:capture-error', onError) }
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const selectView = (destination: typeof DESTINATIONS[number]) => {
    if (document.pointerLockElement) document.exitPointerLock()
    setUi({ waypoint: destination.id, orbit: false, scanOpen: true })
    flight.fov = 48
    flyToView(destination.elevation, destination.radius())
  }
  const tools: { icon: IconName; label: string; key?: string; active?: boolean; action: () => void }[] = [
    { icon: ui.paused ? 'play' : 'pause', label: ui.paused ? '시간 재생' : '시간 일시 정지', active: ui.paused, action: () => setUi({ paused: !getUi().paused }) },
    { icon: 'home', label: '처음 시점으로', key: 'R', action: goHome },
    { icon: 'target', label: ui.scanOpen ? '구조 스캔 숨기기' : '구조 스캔 표시', active: ui.scanOpen, action: () => setUi({ scanOpen: !getUi().scanOpen }) },
    { icon: 'camera', label: '관측 이미지 저장', action: () => { setNotice('관측 이미지를 저장하는 중…'); window.dispatchEvent(new Event('gargantua:capture')) } },
    { icon: 'expand', label: '시네마틱 보기', key: 'V', action: () => setUi({ cinematic: true }) },
  ]
  return <>
    <div className="mode-switch" role="group" aria-label="관측 모드">
      <button aria-pressed={!ui.engaged || ui.orbit} onClick={() => { flight.engaged = false; flight.velocity.set(0, 0, 0); setUi({ orbit: true, engaged: false }); if (document.pointerLockElement) document.exitPointerLock() }}><Icon name="orbit" />궤도 관찰</button>
      <button aria-pressed={ui.engaged && !ui.orbit} onClick={startFlight}><Icon name="flight" />자유 비행</button>
    </div>
    <nav className="destinations" aria-label="관측 지점 이동">
      <div className="destinations__heading"><span>NAVIGATION ARRAY</span><span>관측 지점 선택 <Icon name="arrow" /></span></div>
      <div className="destinations__list">{DESTINATIONS.map(d => <button key={d.id} disabled={!ui.ready} onClick={() => selectView(d)} aria-pressed={ui.waypoint === d.id}>
        <span className="destination__number">{d.number}</span><span className={`destination__diagram destination__diagram--${d.id}`} aria-hidden="true"><i /><b /></span>
        <span className="destination__text"><strong>{d.title}</strong><small>{d.sub}</small></span><Icon name="chevron" />
      </button>)}</div>
    </nav>
    <div className="tool-rail" role="toolbar" aria-label="관측 도구">{tools.map(t => <button key={t.label} title={`${t.label}${t.key ? ` (${t.key})` : ''}`} aria-label={t.label} aria-pressed={t.active} onClick={t.action}><Icon name={t.icon} /></button>)}</div>
    <footer className="statusbar">
      <span className="statusbar__connection"><span className="status-dot" /> ALL SYSTEMS NOMINAL</span>
      <span className="statusbar__model">KERR METRIC <i>/</i> {ui.params.beaming > .99 && ui.params.lensing ? 'RELATIVISTIC' : 'CUSTOM OPTICS'}</span>
      <button className="quality-button" onClick={() => setUi({ qualityMode: ui.qualityMode === 'auto' ? 'high' : 'auto' })} title="자동 품질 / 최고 품질 전환"><i className="quality-bars" /><span>{ui.qualityMode === 'auto' ? 'AUTO' : 'ULTRA'}</span><span ref={fps}>— FPS</span></button>
      <span ref={clock} className="mission-clock">T+ 00:00:00</span>
      <span className="statusbar__version">OBSERVATORY / V.02</span>
    </footer>
    {notice && <div className="toast" role="status">{notice}</div>}
  </>
}
