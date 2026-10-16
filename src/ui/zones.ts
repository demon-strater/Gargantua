import {
  circularOrbitTimeDilation,
  diskInnerRadius,
  diskTemperature,
  ergosphereRadius,
  horizonRadius,
  iscoRadius,
  keplerOmega,
  photonOrbitRadii,
  radiativeEfficiency,
  AU_KM,
  SOLAR_GRAVITATIONAL_RADIUS_KM,
} from '../lib/kerr'
import { flight, physics, telemetry, type PhysicsParams } from '../state/store'

/*
 * 비행 중 블랙홀 구조에 가까워지면 열리는 스캔 팝업.
 * 안쪽(위험한) 구조일수록 우선순위가 높고, 경계에서 깜빡이지 않도록 나갈 때는 문턱을 조금 넓힙니다.
 */

export type ZoneId = 'horizon' | 'ergo' | 'photon' | 'isco' | 'planet' | 'disk' | 'dragging' | 'lensing' | 'overview'
export type Accent = 'cyan' | 'amber' | 'magenta' | 'red'

export type Zone = {
  id: ZoneId
  code: string
  titleEn: string
  title: string
  accent: Accent
  description: string
  rows: (ctx: Context) => [string, string][]
}

export type Context = {
  r: number
  theta: number
  a: number
  rh: number
  isco: number
  inner: number
  outer: number
  ergo: number
  photon: [number, number]
  planetDistance: number
  mass: number // 태양 질량 단위
  height: number // 원반면에서의 높이 |y|
}

const PLANET_ORBIT = 14.8
/** GM/c³ (초) — 태양 질량 1개 기준 */
const SOLAR_TIME_S = 4.9255e-6

export function buildContext(params: PhysicsParams): Context {
  const a = physics.spin
  return {
    r: telemetry.r,
    theta: telemetry.theta,
    a,
    rh: horizonRadius(a),
    isco: iscoRadius(a),
    inner: diskInnerRadius(a, physics.outer, physics.inner),
    outer: physics.outer,
    ergo: ergosphereRadius(a, telemetry.theta),
    photon: photonOrbitRadii(a),
    planetDistance: flight.position.distanceTo(telemetry.planet),
    mass: 10 ** params.massLog,
    height: Math.abs(flight.position.y),
  }
}

/** 우선순위 순서 (앞쪽일수록 안쪽 구조) */
export const ZONES: Zone[] = [
  {
    id: 'horizon',
    code: 'WARN//00 · EVENT_HORIZON',
    titleEn: 'EVENT HORIZON',
    title: '사건의 지평선',
    accent: 'red',
    description:
      '더 이상 다가갈 수 없습니다. r₊ 안쪽에서는 모든 미래가 중심을 향하고, 빛조차 바깥으로 나오지 못합니다. 지금 이곳의 1초는 먼 우주의 시계로 훨씬 긴 시간입니다.',
    rows: (c) => [
      ['지평선까지', `${(c.r - c.rh).toFixed(2)} M · ${formatLength((c.r - c.rh) * SOLAR_GRAVITATIONAL_RADIUS_KM * c.mass)}`],
      ['지평선 반지름 r₊', `${c.rh.toFixed(3)} M`],
      ['여기서 1초 =', `바깥 ${formatSeconds(1 / telemetry.alpha)}`],
    ],
  },
  {
    id: 'ergo',
    code: 'SCAN//01 · ERGOSPHERE',
    titleEn: 'ERGOSPHERE',
    title: '에르고스피어',
    accent: 'magenta',
    description:
      '시공간 자체가 회전하는 영역입니다. 이 안에서는 빛의 속도로 거슬러도 제자리에 머물 수 없어 모든 것이 블랙홀과 함께 돕니다. 회전 에너지를 꺼낼 수 있는 곳(펜로즈 과정)이기도 합니다.',
    rows: (c) => {
      const drag = (telemetry.varpi * telemetry.omega) / telemetry.alpha
      return [
        ['이 위도의 경계 r_E(θ)', `${c.ergo.toFixed(3)} M`],
        ['공간이 끌리는 속도', drag >= 1 ? `${drag.toFixed(2)} c · 정지 불가` : `${drag.toFixed(2)} c`],
        ['틀 끌림 각속도 ω', `${telemetry.omega.toFixed(4)} /M`],
      ]
    },
  },
  {
    id: 'photon',
    code: 'SCAN//02 · PHOTON_SPHERE',
    titleEn: 'PHOTON SPHERE',
    title: '광자 구',
    accent: 'magenta',
    description:
      '빛이 블랙홀 둘레를 원을 그리며 도는 불안정한 궤도들입니다. 여기서 아주 조금 벗어난 빛이 그림자 가장자리의 가느다란 광자 고리를 만듭니다. 회전 방향으로 도는 빛은 더 안쪽까지 들어올 수 있습니다.',
    rows: (c) => [
      ['순행 광자 궤도', `${c.photon[0].toFixed(2)} M`],
      ['역행 광자 궤도', `${c.photon[1].toFixed(2)} M`],
      ['현재 반지름', `${c.r.toFixed(2)} M`],
    ],
  },
  {
    id: 'isco',
    code: 'SCAN//03 · ISCO',
    titleEn: 'INNERMOST STABLE ORBIT',
    title: '최내각 안정 원궤도',
    accent: 'amber',
    description:
      '이보다 안쪽에는 안정된 원궤도가 없어, 원반의 가스가 나선을 그리며 지평선으로 떨어집니다. 원반의 안쪽 끝이 여기서 정해지고, 떨어지기 전까지 정지 질량의 상당 부분이 빛으로 바뀝니다.',
    rows: (c) => [
      ['ISCO 반지름', `${c.isco.toFixed(3)} M`],
      ['질량 → 빛 변환 효율', `${(radiativeEfficiency(c.a) * 100).toFixed(1)} % (핵융합 0.7 %)`],
      ['공전 주기', formatSeconds(2 * Math.PI * (Math.pow(c.isco, 1.5) + c.a) * SOLAR_TIME_S * c.mass)],
      ['궤도의 1시간 =', `바깥 ${circularOrbitTimeDilation(c.isco * 1.0001, c.a).toFixed(2)}시간`],
    ],
  },
  {
    id: 'planet',
    code: 'SCAN//04 · PLANET_K1',
    titleEn: 'ORBITING WORLD',
    title: '공전하는 행성',
    accent: 'cyan',
    description:
      '블랙홀을 도는 작은 행성입니다. 영화 속 밀러 행성처럼 1시간이 7년이 되려면, 거의 최대로 회전하는 블랙홀의 ISCO 바로 바깥을 돌아야 합니다. 이 행성의 궤도는 그보다 훨씬 바깥입니다.',
    rows: (c) => [
      ['궤도 반지름', `${PLANET_ORBIT.toFixed(1)} M`],
      ['행성의 1시간 =', `바깥 ${circularOrbitTimeDilation(PLANET_ORBIT, c.a).toFixed(3)}시간`],
      ['공전 주기', formatSeconds(2 * Math.PI * (Math.pow(PLANET_ORBIT, 1.5) + c.a) * SOLAR_TIME_S * c.mass)],
    ],
  },
  {
    id: 'disk',
    code: 'SCAN//05 · ACCRETION_DISK',
    titleEn: 'ACCRETION DISK',
    title: '강착 원반',
    accent: 'amber',
    description:
      '블랙홀로 떨어지는 가스가 케플러 속도로 돌며 마찰로 달궈져 빛나는 원반입니다. 안쪽일수록 빠르고 뜨겁습니다. 영화 속 원반은 태양 표면 정도의 온도로 설정되었습니다.',
    rows: (c) => {
      const omega = keplerOmega(c.r, c.a)
      const v = Math.min((telemetry.varpi * (omega - telemetry.omega)) / telemetry.alpha, 0.999)
      return [
        ['이 반지름의 온도', `${Math.round(diskTemperature(c.r, c.inner, physics.temperature)).toLocaleString()} K`],
        ['가스 공전 속도', `${v.toFixed(3)} c`],
        ['공전 주기', formatSeconds(2 * Math.PI * (Math.pow(c.r, 1.5) + c.a) * SOLAR_TIME_S * c.mass)],
        ['원반 범위', `${c.inner.toFixed(1)} – ${c.outer.toFixed(1)} M`],
      ]
    },
  },
  {
    id: 'dragging',
    code: 'SCAN//06 · FRAME_DRAGGING',
    titleEn: 'FRAME DRAGGING',
    title: '틀 끌림',
    accent: 'cyan',
    description:
      '회전하는 블랙홀은 주변 시공간을 함께 끌고 돕니다. 이 위치에서 "회전하지 않으려는" 관측자도 실제로는 ω의 각속도로 돌게 됩니다. 그림자 한쪽이 납작해지는 이유도 이것입니다.',
    rows: (c) => [
      ['틀 끌림 각속도 ω', `${telemetry.omega.toFixed(5)} /M`],
      ['끌림 1회전 주기', telemetry.omega > 1e-6 ? formatSeconds(((2 * Math.PI) / telemetry.omega) * SOLAR_TIME_S * c.mass) : '—'],
      ['적도 에르고 경계', `${ergosphereRadius(c.a, Math.PI / 2).toFixed(2)} M`],
    ],
  },
  {
    id: 'lensing',
    code: 'SCAN//07 · GRAVITATIONAL_LENS',
    titleEn: 'GRAVITATIONAL LENSING',
    title: '중력 렌즈',
    accent: 'cyan',
    description:
      '블랙홀 뒤편 원반의 빛이 휘어진 시공간을 따라 위아래로 감겨 와 고리처럼 보입니다. 가까이 갈수록 별과 은하수까지 하늘 전체가 일그러집니다.',
    rows: (c) => [
      ['이 거리를 스치는 빛의 꺾임', `≈ ${((4 / c.r) * (180 / Math.PI)).toFixed(1)}°`],
      ['그림자 시직경', `≈ ${shadowDiameterDeg(c.r).toFixed(1)}°`],
      ['현재 반지름', `${c.r.toFixed(1)} M`],
    ],
  },
  {
    id: 'overview',
    code: 'TARGET//GARGANTUA',
    titleEn: 'GARGANTUA',
    title: '가르강튀아',
    accent: 'cyan',
    description:
      '태양 1억 개 질량의 회전하는 블랙홀. 가까이 날아갈수록 원반, 틀 끌림, 광자 구, 에르고스피어, 사건의 지평선의 정보가 차례로 열립니다.',
    rows: (c) => [
      ['질량', `10^${Math.log10(c.mass).toFixed(1)} M☉`],
      ['스핀 a/M', c.a.toFixed(3)],
      ['지평선 반지름', formatLength(c.rh * SOLAR_GRAVITATIONAL_RADIUS_KM * c.mass)],
      ['거리', `${c.r.toFixed(1)} M`],
    ],
  },
]

/** 현재 위치에서 열려야 할 구조. 이미 열려 있는 구조는 나갈 때 문턱을 6% 넓혀 깜빡임을 막습니다. */
export function detectZone(c: Context, current: ZoneId | null): ZoneId | null {
  const pad = (id: ZoneId) => (id === current ? 1.06 : 1)
  // 원반면에서 ±30° 안쪽이면 원반 위를 나는 것으로 봅니다.
  const overDisk = c.height < 0.5 * c.r
  const checks: Record<ZoneId, boolean> = {
    horizon: c.r < (c.rh + 0.2) * pad('horizon'),
    ergo: Math.abs(c.a) > 0.05 && c.r < (c.ergo + 0.25) * pad('ergo'),
    photon: c.r < (c.photon[1] + 0.7) * pad('photon'),
    isco: overDisk && c.r < (c.isco + 1.2) * pad('isco'),
    planet: c.planetDistance < 5 * pad('planet'),
    disk: overDisk && c.r < c.outer * pad('disk') && c.r > c.inner * 0.9,
    dragging: c.r < 14 * pad('dragging'),
    lensing: c.r < 34 * pad('lensing'),
    overview: c.r < 90 * pad('overview'),
  }
  return ZONES.find((zone) => checks[zone.id])?.id ?? null
}

/** 그림자 시직경: 임계 충돌 변수 b_c ≈ 3√3 M 를 쓰는 근사 (스핀에 따라 수 % 달라짐) */
function shadowDiameterDeg(r: number) {
  const s = Math.min((3 * Math.sqrt(3) * Math.sqrt(Math.max(1 - 2 / r, 0))) / r, 1)
  return (2 * Math.asin(s) * 180) / Math.PI
}

function formatLength(km: number) {
  const au = km / AU_KM
  if (au >= 0.05) return `${au.toPrecision(3)} AU`
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)}백만 km`
  return `${Math.round(km).toLocaleString()} km`
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return '∞'
  if (seconds < 120) return `${seconds.toFixed(1)}초`
  if (seconds < 7200) return `${(seconds / 60).toFixed(1)}분`
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)}시간`
  if (seconds < 3.15e7 * 2) return `${(seconds / 86400).toFixed(1)}일`
  return `${(seconds / 3.156e7).toFixed(1)}년`
}
