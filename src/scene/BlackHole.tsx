import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import vertexShader from '../shaders/blackhole.vert.glsl?raw'
import fragmentShader from '../shaders/blackhole.frag.glsl?raw'
import { activeQuality } from '../lib/quality'
import { physics, setUi } from '../state/store'

/** 원반 회전 시간 배율 — 안쪽 원반이 약 15초에 한 바퀴 돕니다. */
const DISK_SPEED = 3
/** 블랙홀을 공전하는 작은 행성 (Rs 단위) */
const PLANET_ORBIT = 7.4
const PLANET_INCLINATION = 0.21
const PLANET_RADIUS = 0.15

/**
 * 화면 전체를 덮는 사각형 하나에 레이마칭 셰이더를 그립니다.
 * 블랙홀·강착 원반·행성·은하수 배경이 모두 이 패스 안에서 함께 굴절됩니다.
 */
export function BlackHole() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uDiskTime: { value: 0 },
          uCamPos: { value: new THREE.Vector3() },
          uCamWorld: { value: new THREE.Matrix4() },
          uProjInv: { value: new THREE.Matrix4() },
          uPixelAngle: { value: 0.001 },
          uSteps: { value: activeQuality.profile.steps },
          uStepScale: { value: activeQuality.profile.stepScale },
          uOctaves: { value: activeQuality.profile.octaves },
          uExposure: { value: 0 },
          uDoppler: { value: 1 },
          uLensing: { value: 1 },
          uEscapeRadius: { value: 60 },
          uPlanetPos: { value: new THREE.Vector3() },
          uPlanetRadius: { value: PLANET_RADIUS },
        },
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  const diskTime = useRef(0)
  const frames = useRef(0)

  useFrame((state, delta) => {
    const u = material.uniforms
    const camera = state.camera as THREE.PerspectiveCamera
    const profile = activeQuality.profile

    diskTime.current += Math.min(delta, 0.1) * DISK_SPEED
    u.uTime.value = state.clock.elapsedTime
    u.uDiskTime.value = diskTime.current

    u.uCamPos.value.copy(camera.position)
    u.uCamWorld.value.copy(camera.matrixWorld)
    u.uProjInv.value.copy(camera.projectionMatrixInverse)
    u.uPixelAngle.value = THREE.MathUtils.degToRad(camera.fov) / (state.size.height * state.viewport.dpr)
    u.uEscapeRadius.value = Math.max(camera.position.length() * 1.35, 48)

    u.uSteps.value = profile.steps
    u.uStepScale.value = profile.stepScale
    u.uOctaves.value = profile.octaves

    u.uExposure.value = physics.exposure
    u.uDoppler.value = physics.doppler
    u.uLensing.value = physics.lensing

    // 원반과 같은 방향으로 케플러 속도로 공전 (기울어진 궤도)
    const angle = diskTime.current * (0.70711 / Math.pow(PLANET_ORBIT, 1.5)) + 2.4
    u.uPlanetPos.value.set(
      PLANET_ORBIT * Math.cos(angle),
      PLANET_ORBIT * Math.sin(angle) * Math.sin(PLANET_INCLINATION),
      PLANET_ORBIT * Math.sin(angle) * Math.cos(PLANET_INCLINATION),
    )

    // 첫 프레임에서 셰이더 컴파일이 끝난 뒤 인트로 연출을 시작합니다.
    if (++frames.current === 3) setUi({ ready: true })
  }, -1)

  return (
    <mesh frustumCulled={false} renderOrder={-1} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
