import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { activeQuality, dprForFactor, profileForFactor, type DeviceInfo } from '../lib/quality'
import { AdaptiveQuality } from './AdaptiveQuality'
import { BlackHole } from './BlackHole'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { StarDust } from './StarDust'

export function Experience({ device }: { device: DeviceInfo }) {
  const initialDpr = useMemo(() => {
    const profile = profileForFactor(device.factor)
    activeQuality.profile = profile
    return dprForFactor(device.factor, device.mobile, profile)
  }, [device])

  return (
    <Canvas
      flat
      dpr={initialDpr}
      gl={{ antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 600, position: [0, 6, 80] }}
    >
      <AdaptiveQuality device={device} />
      <CameraRig reducedMotion={device.reducedMotion} />
      <BlackHole />
      <StarDust />
      <Effects />
    </Canvas>
  )
}
