import type { PhysicsParams } from '../state/store'

export type Preset = {
  id: string
  label: string
  note: string
  params: Partial<PhysicsParams>
}

const DISK = { thickness: 0.012, temperature: 5800, outer: 26 }

export const PRESETS: Preset[] = [
  {
    id: 'physical',
    label: '실제 물리',
    note: '영화 렌더링의 스핀 a/M = 0.6에 도플러 빔과 중력 적색편이를 모두 적용한 모습',
    params: { spin: 0.6, beaming: 1, inclination: 6, ...DISK },
  },
  {
    id: 'film',
    label: '영화 연출',
    note: '영화는 관객이 혼동하지 않도록 도플러 효과를 빼고 대칭 원반으로 연출했습니다 (James et al. 2015)',
    params: { spin: 0.6, beaming: 0, inclination: 6, ...DISK },
  },
  {
    id: 'extreme',
    label: '극한 스핀',
    note: 'a/M = 0.999. 밀러 행성의 극단적 시간 지연을 설명하려면 거의 최대 속도로 회전해야 합니다',
    params: { spin: 0.999, beaming: 1, inclination: 6, ...DISK },
  },
  {
    id: 'schwarzschild',
    label: '무회전',
    note: '회전하지 않는 슈바르츠실트 블랙홀 (a = 0). 그림자가 완전한 원이 됩니다',
    params: { spin: 0, beaming: 1, inclination: 6, ...DISK },
  },
  {
    id: 'm87',
    label: 'M87* 시점',
    note: 'EHT가 관측한 M87*처럼 자전축에 가까운 방향(약 17°)에서 내려다본 모습',
    params: { spin: 0.9, beaming: 1, inclination: 73, ...DISK },
  },
]
