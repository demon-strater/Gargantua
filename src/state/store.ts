import { useSyncExternalStore } from 'react'
import gsap from 'gsap'

/*
 * 매 프레임 바뀌는 값(카메라, 포인터, 셰이더 파라미터)은 React state가 아닌
 * 가변 객체로 두고 gsap이 직접 트윈합니다. 리렌더 없이 useFrame에서 읽기만 합니다.
 * 길이 단위는 모두 블랙홀 질량 M (GM/c²) 입니다.
 */

/** 스크롤 타임라인이 조종하는 카메라 궤도 파라미터 */
export const rig = {
  distance: 54, // 블랙홀 중심까지의 거리 (M)
  elevation: 0, // 관측 경사각에 더해지는 고도 오프셋 (rad)
  azimuth: 0, // 공전 방위각 (rad)
  fov: 40,
  roll: 0,
}

/** 첫 진입 시 멀리서 날아 들어오는 연출 (1 → 0) */
export const intro = { k: 1 }

/** gsap.quickTo로 부드럽게 따라가는 정규화된 포인터 위치 (-1 ~ 1) */
export const pointer = { x: 0, y: 0 }

/** HUD가 읽어 가는 계측값 */
export const telemetry = { distance: 54, dilation: 1 }

/* ── 물리 파라미터 ───────────────────────────────────────────────────────── */

export type PhysicsParams = {
  spin: number // a/M (음수 = 원반이 블랙홀 자전과 반대로 공전)
  inclination: number // 원반 평면 기준 관측 고도 (°)
  beaming: number // 도플러 빔 + 중력 적색편이 세기 (0 = 영화 연출, 1 = 실제 물리)
  thickness: number // 원반 두께 H/r
  temperature: number // 원반 최고 온도 (K)
  outer: number // 원반 바깥 반지름 (M)
  inner: number // 원반 안쪽 경계: 0 = ISCO, 1 = 바깥 반지름 (잘린 원반)
  roll: number // 화면 회전 (°) — 90°면 원반이 세로로 섭니다
  indigo: boolean // 흑체 색 대신 인디고 색감
  morph: boolean // 안쪽 경계를 자동으로 오가며 형태 변형 재생
  exposure: number
  lensing: boolean
  massLog: number // log10(M / M☉) — 모양은 바꾸지 않고 실제 크기만 정합니다
}

/** 셰이더가 읽는 값. 슬라이더를 움직이면 gsap이 이 객체를 부드럽게 보간합니다. */
export const physics = {
  spin: 0.6,
  inclination: (6 * Math.PI) / 180,
  beaming: 1,
  thickness: 0.012,
  temperature: 5800,
  outer: 26,
  inner: 0,
  roll: 0,
  palette: 0,
  exposure: 1,
  lensing: 1,
  fade: 0, // 인트로 노출 페이드
}

export function tweenPhysics(params: PhysicsParams, duration = 0.9) {
  gsap.to(physics, {
    spin: params.spin,
    inclination: (params.inclination * Math.PI) / 180,
    beaming: params.beaming,
    thickness: params.thickness,
    temperature: params.temperature,
    outer: params.outer,
    roll: (params.roll * Math.PI) / 180,
    palette: params.indigo ? 1 : 0,
    exposure: params.exposure,
    lensing: params.lensing ? 1 : 0,
    // 형태 변형 재생 중에는 안쪽 경계를 재생 타임라인이 맡습니다.
    ...(params.morph ? {} : { inner: params.inner }),
    duration,
    ease: 'power2.inOut',
    overwrite: 'auto',
  })
  setMorph(params.morph)
}

/*
 * 형태 변형: 원반 안쪽 경계를 ISCO에서 바깥 가장자리까지 오가게 합니다.
 * 꽉 찬 원반 → 가운데가 뚫린 도넛 → 렌즈된 바깥 가장자리만 남은 가는 고리 → 다시 원반.
 */
let morphTimeline: gsap.core.Timeline | null = null

// 재생을 멈추면 tweenPhysics가 안쪽 경계를 슬라이더 값으로 되돌립니다.
function setMorph(on: boolean) {
  if (on === Boolean(morphTimeline)) return
  morphTimeline?.kill()
  morphTimeline = on
    ? gsap
        .timeline()
        .to(physics, { inner: 0, duration: 1.2, ease: 'power2.inOut' })
        .add(gsap.to(physics, { inner: 0.95, duration: 4.5, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatDelay: 1.4 }))
    : null
}

export type QualityTier = 'low' | 'medium' | 'high'

/* ── UI가 구독하는 작은 반응형 스토어 ───────────────────────────────────── */

export type UiState = {
  ready: boolean
  tier: QualityTier
  dpr: number
  params: PhysicsParams
  preset: string | null
  panelOpen: boolean
}

let ui: UiState = {
  ready: false,
  tier: 'high',
  dpr: 1,
  params: {
    spin: 0.6,
    inclination: 6,
    beaming: 1,
    thickness: 0.012,
    temperature: 5800,
    outer: 26,
    inner: 0,
    roll: 0,
    indigo: false,
    morph: false,
    exposure: 1,
    lensing: true,
    massLog: 8,
  },
  preset: 'physical',
  panelOpen: false,
}
const listeners = new Set<() => void>()

export function setUi(patch: Partial<UiState>) {
  const next = { ...ui, ...patch }
  if ((Object.keys(patch) as (keyof UiState)[]).every((key) => next[key] === ui[key])) return
  ui = next
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
