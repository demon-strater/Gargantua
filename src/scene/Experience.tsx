import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { activeQuality, dprForFactor, profileForFactor, type DeviceInfo } from '../lib/quality'
import { AdaptiveQuality } from './AdaptiveQuality'
import { BlackHole } from './BlackHole'
import { FlightRig } from './FlightRig'
import { Effects } from './Effects'
import { StarDust } from './StarDust'
import { ObservationCapture } from './ObservationCapture'

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
      camera={{ fov: 48, near: 0.05, far: 1200, position: [0, 12, 130] }}
    >
      <AdaptiveQuality device={device} />
      <FlightRig />
      <BlackHole skySize={device.skySize} />
      <StarDust />
      <Effects />
      <ObservationCapture />
    </Canvas>
  )
}
