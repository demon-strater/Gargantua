import { useSyncExternalStore } from 'react'

/*
 * 매 프레임 바뀌는 값(카메라, 포인터, 셰이더 파라미터)은 React state가 아닌
 * 가변 객체로 두고 gsap이 직접 트윈합니다. 리렌더 없이 useFrame에서 읽기만 합니다.
 */

/** 스크롤 타임라인이 조종하는 카메라 궤도 파라미터 */
export const rig = {
  distance: 27, // 블랙홀 중심까지의 거리 (Rs)
  elevation: 0.1, // 원반 평면 위 고도각 (rad)
  azimuth: 0, // 공전 방위각 (rad)
  fov: 40,
  roll: 0,
}

/** 첫 진입 시 멀리서 날아 들어오는 연출 (1 → 0) */
export const intro = { k: 1 }

/** gsap.quickTo로 부드럽게 따라가는 정규화된 포인터 위치 (-1 ~ 1) */
export const pointer = { x: 0, y: 0 }

/** 셰이더에 전달되는 연출/물리 파라미터 (토글 시 gsap으로 전환) */
export const physics = { doppler: 1, lensing: 1, exposure: 0 }

/** HUD가 읽어 가는 계측값 */
export const telemetry = { distance: 27 }

export type QualityTier = 'low' | 'medium' | 'high'

/* ── UI가 구독하는 작은 반응형 스토어 ───────────────────────────────────── */

export type UiState = {
  ready: boolean
  doppler: boolean
  lensing: boolean
  tier: QualityTier
  dpr: number
}

let ui: UiState = { ready: false, doppler: true, lensing: true, tier: 'high', dpr: 1 }
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
