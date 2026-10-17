import type { PhysicsParams } from '../state/store'

export type Preset = {
  id: string
  label: string
  note: string
  params: Partial<PhysicsParams>
  /** 프리셋을 고르면 이 시점(원반 평면 기준 고도 °, 거리 M)으로 자동 비행합니다. */
  view: { inclination: number; distance: number }
}

/** 각 프리셋이 공통으로 되돌리는 원반·연출 값 */
const BASE: Partial<PhysicsParams> = {
  thickness: 0.012,
  temperature: 6800,
  outer: 26,
  inner: 0,
  flow: 0,
  roll: -4,
  indigo: false,
  morph: false,
  morphMode: 'spin',
  lensing: true,
  exposure: 1,
}

export const PRESETS: Preset[] = [
  {
    id: 'physical',
    label: '실제 물리',
    note: '영화 렌더링의 스핀 a/M = 0.6에 도플러 빔과 중력 적색편이를 모두 적용한 모습',
    params: { ...BASE, spin: 0.6, beaming: 1 },
    view: { inclination: 4.3, distance: 38 },
  },
  {
    id: 'film',
    label: '영화 연출',
    note: '영화는 관객이 혼동하지 않도록 도플러 효과를 빼고 대칭 원반으로 연출했습니다 (James et al. 2015)',
    params: { ...BASE, spin: 0.6, beaming: 0, temperature: 6200, exposure: 1.15 },
    view: { inclination: 4.3, distance: 38 },
  },
  {
    id: 'indigo',
    label: '인디고 난류',
    note: '참고 영상의 인디고·백금색 난류를 재해석한 색감입니다. 색은 연출용이며 빛의 경로는 Kerr 측지선으로 계산합니다.',
    params: { ...BASE, spin: 0.85, beaming: 0.6, temperature: 9000, indigo: true, roll: 0, flow: 0.08 },
    view: { inclination: 3, distance: 38 },
  },
  {
    id: 'extreme',
    label: '극한 스핀',
    note: 'a/M = 0.999. 밀러 행성의 극단적 시간 지연을 설명하려면 거의 최대 속도로 회전해야 합니다',
    params: { ...BASE, spin: 0.999, beaming: 1 },
    view: { inclination: 6, distance: 54 },
  },
  {
    id: 'schwarzschild',
    label: '무회전',
    note: '회전하지 않는 슈바르츠실트 블랙홀 (a = 0). 그림자가 완전한 원이 됩니다',
    params: { ...BASE, spin: 0, beaming: 1 },
    view: { inclination: 6, distance: 54 },
  },
  {
    id: 'm87',
    label: 'M87* 시점',
    note: 'EHT가 관측한 M87*처럼 자전축에 가까운 방향(약 17°)에서, 두꺼운 고온 가스층과 함께 내려다본 모습',
    params: { ...BASE, spin: 0.9, beaming: 1, flow: 0.5 },
    view: { inclination: 73, distance: 54 },
  },
  {
    id: 'morph',
    label: '형태 변형',
    note: '스핀 a/M 하나만 +0.998 ↔ −0.998로 오갑니다. ISCO가 1.2 M ↔ 9 M로 움직이며 원반이 넓은 원반 → 도넛 → 가는 고리로 변합니다',
    params: {
      ...BASE,
      spin: 0.998,
      beaming: 0.35,
      outer: 11,
      flow: 0.45,
      roll: 90,
      temperature: 9000,
      indigo: true,
      morph: true,
      morphMode: 'spin',
    },
    view: { inclination: 1.5, distance: 46 },
  },
]
