import * as THREE from 'three'

/*
 * 커 블랙홀 계산 (기하 단위계 G = c = 1, 질량 M = 1).
 * 장면의 Y축이 블랙홀 자전축이고, 보이어–린드퀴스트(BL) 좌표 (r, θ, φ)와
 * 장면 직교좌표는 편구면(oblate spheroidal) 관계로 대응합니다.
 *   X = √(r² + a²) sinθ cosφ,  Y = r cosθ,  Z = √(r² + a²) sinθ sinφ
 */

/** 태양 질량 1개의 중력 반지름 GM☉/c² (km) */
export const SOLAR_GRAVITATIONAL_RADIUS_KM = 1.4766
export const AU_KM = 1.495978707e8

/** 사건의 지평선 r₊ = M + √(M² − a²) */
export function horizonRadius(a: number) {
  return 1 + Math.sqrt(Math.max(1 - a * a, 0))
}

/** 최내각 안정 원궤도 (Bardeen–Press–Teukolsky 1972). a > 0이면 원반이 블랙홀과 같은 방향으로 공전 */
export function iscoRadius(a: number) {
  const s = Math.min(Math.abs(a), 0.99999)
  const z1 = 1 + Math.cbrt(1 - s * s) * (Math.cbrt(1 + s) + Math.cbrt(1 - s))
  const z2 = Math.sqrt(3 * s * s + z1 * z1)
  return 3 + z2 - Math.sign(a) * Math.sqrt((3 - z1) * (3 + z1 + 2 * z2))
}

/** 잘린 원반의 안쪽 경계: fraction 0 = ISCO, 1 = 바깥 반지름 */
export function diskInnerRadius(a: number, outer: number, fraction: number) {
  const isco = iscoRadius(a)
  return isco + (Math.max(outer, isco + 1) - isco) * fraction
}

/** 적도면 원형 광자 궤도 반지름 — 순행(co-rotating) / 역행(counter-rotating) */
export function photonOrbitRadii(a: number): [number, number] {
  const s = Math.abs(a)
  return [2 * (1 + Math.cos((2 / 3) * Math.acos(-s))), 2 * (1 + Math.cos((2 / 3) * Math.acos(s)))]
}

/** 적도 원궤도의 u^t = dt/dτ — 그 궤도 위의 1시간이 먼 곳에서 몇 시간인지 */
export function circularOrbitTimeDilation(r: number, a: number) {
  const r15 = Math.pow(r, 1.5)
  const d = r15 - 3 * Math.sqrt(r) + 2 * a
  return d > 0 ? (r15 + a) / (Math.pow(r, 0.75) * Math.sqrt(d)) : Infinity
}

export type Zamo = { sigma: number; delta: number; alpha: number; omega: number; varpi: number }

/** 국소 비회전 관측자(ZAMO)의 시간 지연 α, 틀 끌림 각속도 ω, 원통 반지름 ϖ */
export function zamo(r: number, theta: number, a: number, m: number): Zamo {
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const sigma = r * r + a * a * c * c
  const delta = r * r - 2 * m * r + a * a
  const A = (r * r + a * a) ** 2 - a * a * delta * s * s
  return {
    sigma,
    delta,
    alpha: Math.sqrt(Math.max((sigma * delta) / A, 1e-9)),
    omega: (2 * m * a * r) / A,
    varpi: Math.sqrt(A / sigma) * s,
  }
}

/** 장면 직교좌표 → BL (r, θ, φ) */
export function cartesianToBL(p: THREE.Vector3, a: number, out: THREE.Vector3) {
  const w = p.lengthSq() - a * a
  const r = Math.sqrt(0.5 * (w + Math.sqrt(w * w + 4 * a * a * p.y * p.y)))
  out.set(r, Math.acos(THREE.MathUtils.clamp(p.y / r, -1, 1)), Math.atan2(p.z, p.x))
  return out
}

/**
 * 카메라 위치에서 BL 좌표 방향(∂r, ∂θ, ∂φ)의 유클리드 단위벡터.
 * 편구면 좌표는 직교하므로 이 세 벡터가 ZAMO 관측자의 국소 정규직교 틀이 됩니다.
 */
export function blBasis(r: number, theta: number, phi: number, a: number, out: THREE.Matrix3) {
  const S = Math.sqrt(r * r + a * a)
  const st = Math.sin(theta)
  const ct = Math.cos(theta)
  const sp = Math.sin(phi)
  const cp = Math.cos(phi)
  const er = new THREE.Vector3((r / S) * st * cp, ct, (r / S) * st * sp).normalize()
  const et = new THREE.Vector3(S * ct * cp, -r * st, S * ct * sp).normalize()
  const ep = new THREE.Vector3(-sp, 0, cp)
  return out.set(er.x, et.x, ep.x, er.y, et.y, ep.y, er.z, et.z, ep.z)
}
