import type { QualityTier } from '../state/store'

export type QualityProfile = {
  tier: QualityTier
  steps: number // 광선 적분 최대 스텝
  stepScale: number // 한 스텝의 공간 이동량 ≈ stepScale · r
  dust: number // 성간 먼지 파티클 수
  pixelBudget: number // 셰이더가 처리할 최대 픽셀 수 (해상도 스케일링 상한)
}

export const PROFILES: Record<QualityTier, QualityProfile> = {
  low: { tier: 'low', steps: 200, stepScale: 0.075, dust: 1400, pixelBudget: 0.9e6 },
  medium: { tier: 'medium', steps: 300, stepScale: 0.058, dust: 2800, pixelBudget: 1.8e6 },
  high: { tier: 'high', steps: 420, stepScale: 0.045, dust: 4500, pixelBudget: 3.2e6 },
}

export const MAX_DUST = PROFILES.high.dust

/** 현재 적용 중인 품질. 셰이더 유니폼과 파티클 수가 매 프레임 이 값을 읽습니다. */
export const activeQuality: { profile: QualityProfile } = { profile: PROFILES.high }

export type DeviceInfo = { mobile: boolean; factor: number; reducedMotion: boolean; skySize: number }

/** 첫 프레임 전에 기기 성능을 대략 추정해 시작 품질(0~1)을 정합니다. */
export function detectDevice(): DeviceInfo {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = Math.min(window.screen.width, window.screen.height) < 820
  const mobile = coarse && small
  const cores = navigator.hardwareConcurrency ?? 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let factor: number
  if (mobile) factor = cores >= 8 && memory >= 6 ? 0.4 : 0.2
  else if (isIntegratedGpu()) factor = 0.6
  else factor = cores >= 8 ? 0.8 : 0.55
  return { mobile, factor, reducedMotion, skySize: mobile ? 512 : 768 }
}

/** 내장 GPU는 중간 품질에서 시작하고, 여유가 있으면 PerformanceMonitor가 올립니다. */
function isIntegratedGpu(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return true
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return /intel|iris|uhd|mali|adreno|powervr|swiftshader|llvmpipe|microsoft basic/i.test(renderer)
  } catch {
    return true
  }
}

/** PerformanceMonitor의 factor(0~1)를 품질 단계로 변환합니다. */
export function profileForFactor(factor: number): QualityProfile {
  if (factor < 0.34) return PROFILES.low
  if (factor < 0.67) return PROFILES.medium
  return PROFILES.high
}

/**
 * 렌더링 해상도 스케일링.
 * factor에 따라 DPR을 보간하고, 화면이 커도 셰이더 픽셀 수가 예산을 넘지 않게 제한합니다.
 */
export function dprForFactor(factor: number, mobile: boolean, profile: QualityProfile): number {
  const native = window.devicePixelRatio || 1
  const [min, max] = mobile ? [0.5, Math.min(native, 1.25)] : [0.6, Math.min(native, 1.75)]
  const wanted = min + (max - min) * factor
  const area = window.innerWidth * window.innerHeight
  const budgetDpr = Math.sqrt(profile.pixelBudget / Math.max(area, 1))
  const dpr = Math.max(0.45, Math.min(wanted, budgetDpr))
  return Math.round(dpr * 20) / 20
}
