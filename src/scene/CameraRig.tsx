import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { intro, physics, pointer, rig, telemetry } from '../state/store'

/**
 * 블랙홀 중심을 기준으로 한 구면 좌표 카메라.
 * 관측 경사각(물리 패널) + 스크롤(rig) + 마우스 패럴랙스 + 아주 느린 자동 공전을 합성합니다.
 */
export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const camera = state.camera as THREE.PerspectiveCamera
    const drift = reducedMotion ? 0 : state.clock.elapsedTime * 0.012
    const parallax = reducedMotion ? 0.4 : 1

    // 카메라가 원반 매질 안으로 들어가지 않도록 최소 고도를 둡니다.
    const clearance = Math.atan(3 * physics.thickness) + 0.015
    const azimuth = rig.azimuth + drift + pointer.x * 0.32 * parallax
    const elevation = THREE.MathUtils.clamp(
      physics.inclination + rig.elevation - pointer.y * 0.08 * parallax,
      clearance,
      1.45,
    )
    const distance = rig.distance + intro.k * 92

    camera.position.set(
      distance * Math.cos(elevation) * Math.sin(azimuth),
      distance * Math.sin(elevation),
      distance * Math.cos(elevation) * Math.cos(azimuth),
    )

    // 시선이 포인터 쪽으로 살짝 따라가며 근경 먼지와 블랙홀 사이에 시차가 생깁니다.
    target.set(Math.cos(azimuth), 0, -Math.sin(azimuth)).multiplyScalar(pointer.x * 1.0 * parallax)
    target.y = -pointer.y * 0.5 * parallax
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    camera.rotateZ(rig.roll - pointer.x * 0.015 * parallax)

    if (camera.fov !== rig.fov) {
      camera.fov = rig.fov
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
    telemetry.distance = distance
  }, -2)

  return null
}
