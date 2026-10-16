import type { PhysicsParams } from '../state/store'

export type Preset = {
  id: string
  label: string
  note: string
  params: Partial<PhysicsParams>
}

/** 각 프리셋이 공통으로 되돌리는 원반·시점 값 */
const BASE: Partial<PhysicsParams> = {
  inclination: 6,
  thickness: 0.012,
  temperature: 5800,
  outer: 26,
  inner: 0,
  roll: 0,
  indigo: false,
  morph: false,
}

export const PRESETS: Preset[] = [
  {
    id: 'physical',
    label: '실제 물리',
    note: '영화 렌더링의 스핀 a/M = 0.6에 도플러 빔과 중력 적색편이를 모두 적용한 모습',
    params: { ...BASE, spin: 0.6, beaming: 1 },
  },
  {
    id: 'film',
    label: '영화 연출',
    note: '영화는 관객이 혼동하지 않도록 도플러 효과를 빼고 대칭 원반으로 연출했습니다 (James et al. 2015)',
    params: { ...BASE, spin: 0.6, beaming: 0 },
  },
  {
    id: 'extreme',
    label: '극한 스핀',
    note: 'a/M = 0.999. 밀러 행성의 극단적 시간 지연을 설명하려면 거의 최대 속도로 회전해야 합니다',
    params: { ...BASE, spin: 0.999, beaming: 1 },
  },
  {
    id: 'schwarzschild',
    label: '무회전',
    note: '회전하지 않는 슈바르츠실트 블랙홀 (a = 0). 그림자가 완전한 원이 됩니다',
    params: { ...BASE, spin: 0, beaming: 1 },
  },
  {
    id: 'm87',
    label: 'M87* 시점',
    note: 'EHT가 관측한 M87*처럼 자전축에 가까운 방향(약 17°)에서 내려다본 모습',
    params: { ...BASE, spin: 0.9, beaming: 1, inclination: 73 },
  },
  {
    id: 'morph',
    label: '형태 변형',
    note: '원반을 거의 정확히 옆에서 세워 보고(1.5°), 안쪽 경계를 오가게 합니다. 넓은 도넛 → 가는 고리 → 다시 도넛',
    params: { ...BASE, spin: 0.9, beaming: 0.35, inclination: 1.5, roll: 90, outer: 18, temperature: 9000, indigo: true, morph: true },
  },
]
