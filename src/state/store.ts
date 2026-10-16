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
    exposure: params.exposure,
    lensing: params.lensing ? 1 : 0,
    duration,
    ease: 'power2.inOut',
    overwrite: 'auto',
  })
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
