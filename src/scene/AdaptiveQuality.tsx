import { useCallback, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import { activeQuality, dprForFactor, profileForFactor, type DeviceInfo } from '../lib/quality'
import { setUi } from '../state/store'

/**
 * 실시간 FPS를 감시해 두 가지를 함께 조절합니다.
 *  1) 렌더링 해상도(DPR) — 화면 크기별 픽셀 예산 안에서 스케일링
 *  2) 셰이더 품질 단계 — 적분 스텝 수, 노이즈 옥타브, 파티클 수
 */
export function AdaptiveQuality({ device }: { device: DeviceInfo }) {
  const setDpr = useThree((state) => state.setDpr)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)
  const factor = useRef(device.factor)

  const apply = useCallback(
    (next: number) => {
      factor.current = next
      const profile = profileForFactor(next)
      const dpr = dprForFactor(next, device.mobile, profile)
      activeQuality.profile = profile
      setDpr(dpr)
      setUi({ tier: profile.tier, dpr })
    },
    [device.mobile, setDpr],
  )

  // 창 크기가 바뀌면 픽셀 예산에 맞춰 DPR을 다시 계산합니다.
  useEffect(() => apply(factor.current), [apply, width, height])

  return (
    <PerformanceMonitor
      factor={device.factor}
      step={0.1}
      flipflops={6}
      bounds={(refresh) => (refresh > 90 ? [60, 100] : [45, 57])}
      onChange={({ factor: next }) => apply(next)}
    />
  )
}
