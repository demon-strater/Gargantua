import { useSyncExternalStore } from 'react'
import gsap from 'gsap'
import * as THREE from 'three'
import { blToCartesian, horizonRadius } from '../lib/kerr'

/*
 * 매 프레임 바뀌는 값(카메라, 입력, 셰이더 파라미터)은 React state가 아닌
 * 가변 객체로 두고 gsap이 직접 트윈합니다. 리렌더 없이 useFrame/rAF에서 읽기만 합니다.
 * 길이 단위는 모두 블랙홀 질량 M (GM/c²) 입니다.
 */

/** 첫 진입 시 멀리서 날아 들어오는 연출 (1 → 0) */
export const intro = { k: 1 }

/** 자유 비행 카메라 상태 (마인크래프트 크리에이티브 모드식: 요·피치 + 수평 이동 + 상승/하강) */
export const flight = {
  position: new THREE.Vector3(0, 38 * Math.sin(0.075), 38 * Math.cos(0.075)),
  velocity: new THREE.Vector3(),
  yaw: 0, // 0 = -Z 방향(블랙홀 쪽)을 봄
  pitch: -0.075,
  fov: 48,
  engaged: false, // 비행 조작 활성 (인트로가 끝나고 클릭한 뒤)
  autopilot: false, // 프리셋 시점으로 이동 중
}

/** HUD와 구조 팝업이 읽어 가는 계측값 (실제 스핀 기준 BL 좌표) */
export const telemetry = {
  r: 54,
  theta: Math.PI / 2,
  alpha: 1, // ZAMO 시간 지연 dτ/dt
  omega: 0, // 틀 끌림 각속도
  varpi: 54, // 원통 반지름
  speed: 0, // 비행 속도 (M/s)
  fps: 0,
  planet: new THREE.Vector3(),
}

/* ── 물리 파라미터 ───────────────────────────────────────────────────────── */

export type MorphMode = 'spin' | 'inner'

export type PhysicsParams = {
  spin: number // a/M (음수 = 원반이 블랙홀 자전과 반대로 공전)
  beaming: number // 도플러 빔 + 중력 적색편이 세기 (0 = 영화 연출, 1 = 실제 물리)
  thickness: number // 원반 두께 H/r
  temperature: number // 원반 최고 온도 (K)
  outer: number // 원반 바깥 반지름 (M)
  inner: number // 원반 안쪽 경계: 0 = ISCO, 1 = 바깥 반지름 (잘린 원반)
  flow: number // 두꺼운 고온 가스층 밝기 (0 = 없음)
  roll: number // 화면 회전 (°) — 90°면 원반이 세로로 섭니다
  indigo: boolean // 흑체 색 대신 인디고 색감
  morph: boolean // 형태 변형 자동 재생
  morphMode: MorphMode // 'spin' = 스핀만 오감, 'inner' = 안쪽 경계만 오감
  exposure: number
  lensing: boolean
  massLog: number // log10(M / M☉) — 모양은 바꾸지 않고 실제 크기만 정합니다
}

/** 셰이더가 읽는 값. 슬라이더를 움직이면 gsap이 이 객체를 부드럽게 보간합니다. */
export const physics = {
  spin: 0.6,
  beaming: 1,
  thickness: 0.012,
  temperature: 6800,
  outer: 26,
  inner: 0,
  flow: 0,
  roll: -0.07,
  palette: 0,
  exposure: 1,
  lensing: 1,
  fade: 0, // 인트로 노출 페이드
}

export function tweenPhysics(params: PhysicsParams, duration = 0.9) {
  const spinMorph = params.morph && params.morphMode === 'spin'
  const innerMorph = params.morph && params.morphMode === 'inner'
  gsap.to(physics, {
    beaming: params.beaming,
    thickness: params.thickness,
    temperature: params.temperature,
    outer: params.outer,
    flow: params.flow,
    roll: (params.roll * Math.PI) / 180,
    palette: params.indigo ? 1 : 0,
    exposure: params.exposure,
    lensing: params.lensing ? 1 : 0,
    // 형태 변형 재생 중에는 해당 값을 재생 타임라인이 맡습니다.
    ...(spinMorph ? {} : { spin: params.spin }),
    ...(innerMorph ? {} : { inner: params.inner }),
    duration,
    ease: 'power2.inOut',
    overwrite: 'auto',
  })
  setMorph(params.morph ? params.morphMode : null)
}

/*
 * 형태 변형
 *  - spin : 스핀 a/M 하나만 +0.998 ↔ −0.998 로 오갑니다. ISCO가 1.2 M ↔ 9 M 로 움직여
 *           원반 크기가 고정이면 넓은 원반 → 도넛 → 가는 고리가 됩니다. (순수한 물리 값 변화)
 *  - inner: 스핀은 두고 원반 안쪽 경계(잘린 원반)만 ISCO ↔ 바깥 가장자리로 오갑니다.
 */
let morphTimeline: gsap.core.Timeline | null = null
let morphMode: MorphMode | null = null

function setMorph(mode: MorphMode | null) {
  if (mode === morphMode) return
  morphTimeline?.kill()
  morphMode = mode
  morphTimeline = null
  if (mode === 'spin') {
    morphTimeline = gsap
      .timeline()
      .to(physics, { spin: 0.998, inner: 0, duration: 1.2, ease: 'power2.inOut' })
      .add(gsap.to(physics, { spin: -0.998, duration: 5, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 1.4 }))
  } else if (mode === 'inner') {
    morphTimeline = gsap
      .timeline()
      .to(physics, { inner: 0, duration: 1.2, ease: 'power2.inOut' })
      .add(gsap.to(physics, { inner: 0.95, duration: 4.5, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 1.4 }))
  }
}

/**
 * 프리셋 시점으로 자동 비행: 원반 평면 기준 고도 inclination(°), 거리 distance(M)에서
 * 블랙홀 중심을 바라보도록 부드럽게 이동합니다. 현재 방위각은 유지합니다.
 */
export function flyToView(inclinationDeg: number, distance: number, duration = 2.6) {
  const p = flight.position
  const azimuth = Math.atan2(p.x, p.z)
  const elevation = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(inclinationDeg, -89, 89))
  distance = Math.max(distance, horizonRadius(physics.spin) + 0.14)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) duration = 0
  const target = blToCartesian(distance, Math.PI / 2 - elevation, Math.PI / 2 - azimuth, physics.spin, new THREE.Vector3())
  // 도착 지점에서 중심을 바라보는 요/피치 (요 0 = -Z 방향, 피치 음수 = 아래)
  const yaw = Math.atan2(target.x, target.z)
  const pitch = -Math.atan2(target.y, Math.hypot(target.x, target.z))
  // 요는 가까운 쪽으로 돌도록 2π 범위를 맞춥니다.
  const startYaw = flight.yaw
  const dyaw = Math.atan2(Math.sin(yaw - startYaw), Math.cos(yaw - startYaw))

  flight.autopilot = true
  flight.velocity.set(0, 0, 0)
  gsap.killTweensOf(flight.position)
  gsap.killTweensOf(flight)
  gsap.to(flight.position, { x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut' })
  gsap.to(flight, {
    yaw: startYaw + dyaw,
    pitch,
    duration,
    ease: 'power3.inOut',
    onComplete: () => {
      flight.autopilot = false
    },
  })
}

export type QualityTier = 'low' | 'medium' | 'high'

export function startFlight() {
  window.dispatchEvent(new Event('gargantua:engage'))
}

export function goHome() {
  flight.fov = 48
  setUi({ orbit: false, waypoint: 'overview' })
  flyToView(4.3, 38)
}

/* ── UI가 구독하는 작은 반응형 스토어 ───────────────────────────────────── */

export type UiState = {
  ready: boolean
  tier: QualityTier
  dpr: number
  params: PhysicsParams
  preset: string | null
  panelOpen: boolean
  engaged: boolean // 비행 시작 여부 (첫 클릭 이후)
  helpOpen: boolean
  scanOpen: boolean
  cinematic: boolean
  orbit: boolean
  paused: boolean
  qualityMode: 'auto' | 'high'
  waypoint: string | null
}

let ui: UiState = {
  ready: false,
  tier: 'high',
  dpr: 1,
  params: {
    spin: 0.6,
    beaming: 1,
    thickness: 0.012,
    temperature: 6800,
    outer: 26,
    inner: 0,
    flow: 0,
    roll: -4,
    indigo: false,
    morph: false,
    morphMode: 'spin',
    exposure: 1,
    lensing: true,
    massLog: 8,
  },
  preset: 'physical',
  panelOpen: false,
  engaged: false,
  helpOpen: false,
  scanOpen: true,
  cinematic: false,
  orbit: false,
  paused: false,
  qualityMode: 'auto',
  waypoint: 'overview',
}
const listeners = new Set<() => void>()

export function setUi(patch: Partial<UiState>) {
  const next = { ...ui, ...patch }
  if ((Object.keys(patch) as (keyof UiState)[]).every((key) => next[key] === ui[key])) return
  ui = next
  if (patch.paused !== undefined) morphTimeline?.paused(patch.paused)
  listeners.forEach((listener) => listener())
}

export function getUi() {
  return ui
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUi<T>(select: (state: UiState) => T): T {
  return useSyncExternalStore(subscribe, () => select(ui), () => select(ui))
}
