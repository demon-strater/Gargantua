import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import common from '../shaders/common.glsl?raw'
import vertexShader from '../shaders/blackhole.vert.glsl?raw'
import fragmentShader from '../shaders/blackhole.frag.glsl?raw'
import { blBasis, cartesianToBL, diskInnerRadius, horizonRadius, iscoRadius, zamo } from '../lib/kerr'
import { activeQuality } from '../lib/quality'
import { physics, setUi, telemetry } from '../state/store'
import { bakeDiskTexture, bakeSkyCube } from './generatedTextures'

/** 원반 시간 배율 — 1초에 3 M 의 좌표 시간이 흐릅니다. */
const DISK_SPEED = 3
/** 블랙홀을 공전하는 작은 행성 (M 단위) */
const PLANET_ORBIT = 14.8
const PLANET_INCLINATION = 0.21
const PLANET_RADIUS = 0.3

/**
 * 화면 전체를 덮는 사각형 하나에 커 블랙홀 광선 추적 셰이더를 그립니다.
 * 블랙홀·강착 원반·행성·은하수가 모두 이 패스 안에서 함께 굴절됩니다.
 */
export function BlackHole({ skySize }: { skySize: number }) {
  const gl = useThree((state) => state.gl)

  const textures = useMemo(() => ({ disk: bakeDiskTexture(gl), sky: bakeSkyCube(gl, skySize) }), [gl, skySize])
  useEffect(
    () => () => {
      textures.disk.dispose()
      textures.sky.dispose()
    },
    [textures],
  )

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: common + fragmentShader,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uDiskTime: { value: 0 },
          uCamWorld: { value: new THREE.Matrix4() },
          uProjInv: { value: new THREE.Matrix4() },
          uCamBL: { value: new THREE.Vector3() },
          uCamBasis: { value: new THREE.Matrix3() },
          uZamo: { value: new THREE.Vector4() },
          uM: { value: 1 },
          uA: { value: 0.6 },
          uSpin: { value: 0.6 },
          uHorizon: { value: 1.8 },
          uDiskInner: { value: 3.8 },
          uIsco: { value: 3.8 },
          uFlow: { value: 0 },
          uPalette: { value: 0 },
          uDiskOuter: { value: 26 },
          uDiskThickness: { value: 0.018 },
          uDiskTemp: { value: 5800 },
          uBeaming: { value: 1 },
          uExposure: { value: 0 },
          uPixelAngle: { value: 0.001 },
          uSteps: { value: activeQuality.profile.steps },
          uStepScale: { value: activeQuality.profile.stepScale },
          uEscapeRadius: { value: 100 },
          uPlanetPos: { value: new THREE.Vector3() },
          uPlanetRadius: { value: PLANET_RADIUS },
          uPlanetOrbit: { value: PLANET_ORBIT },
          uDiskTex: { value: null },
          uSkyTex: { value: null },
        },
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])
  material.uniforms.uDiskTex.value = textures.disk.texture
  material.uniforms.uSkyTex.value = textures.sky.texture

  const scratch = useMemo(() => ({ bl: new THREE.Vector3(), eye: new THREE.Vector3() }), [])
  const diskTime = useRef(0)
  const frames = useRef(0)

  useFrame((state, delta) => {
    const u = material.uniforms
    const camera = state.camera as THREE.PerspectiveCamera
    const profile = activeQuality.profile

    diskTime.current += Math.min(delta, 0.1) * DISK_SPEED
    u.uTime.value = state.clock.elapsedTime
    u.uDiskTime.value = diskTime.current

    // 렌즈 효과를 끄면 광선이 지나는 시공간의 M, a를 0으로 보내 평평하게 만듭니다.
    const spin = physics.spin
    const m = physics.lensing
    const a = spin * m
    // 카메라가 원반면(y = 0) 위에 정확히 놓이면 첫 스텝이 원반 통과로 잡히므로 살짝 띄웁니다.
    const eye = scratch.eye.copy(camera.position)
    if (Math.abs(eye.y) < 0.02) eye.y = eye.y < 0 ? -0.02 : 0.02
    const bl = cartesianToBL(eye, a, scratch.bl)
    const frame = zamo(bl.x, bl.y, a, m)
    blBasis(bl.x, bl.y, bl.z, a, u.uCamBasis.value)
    u.uCamBL.value.copy(bl)
    u.uZamo.value.set(frame.alpha, frame.omega, frame.varpi, Math.sqrt(frame.sigma))
    u.uM.value = m
    u.uA.value = a
    u.uSpin.value = spin
    u.uHorizon.value = horizonRadius(spin)
    // 안쪽 경계: ISCO에서 바깥 반지름까지 (형태 변형 재생 시 gsap이 physics.inner를 오갑니다)
    u.uDiskInner.value = diskInnerRadius(spin, physics.outer, physics.inner)
    u.uIsco.value = iscoRadius(spin)
    u.uFlow.value = physics.flow
    u.uPalette.value = physics.palette

    u.uCamWorld.value.copy(camera.matrixWorld)
    u.uProjInv.value.copy(camera.projectionMatrixInverse)
    u.uPixelAngle.value = THREE.MathUtils.degToRad(camera.fov) / (state.size.height * state.viewport.dpr)
    u.uEscapeRadius.value = Math.max(bl.x * 1.3, 100)

    u.uSteps.value = profile.steps
    u.uStepScale.value = profile.stepScale

    u.uDiskOuter.value = physics.outer
    u.uDiskThickness.value = physics.thickness
    u.uDiskTemp.value = physics.temperature
    u.uBeaming.value = physics.beaming
    u.uExposure.value = physics.exposure * physics.fade

    // 원반과 같은 방향으로 케플러 각속도 Ω = 1/(r^{3/2} + a) 로 공전하는 기울어진 궤도
    const angle = diskTime.current / (Math.pow(PLANET_ORBIT, 1.5) + spin) + 2.4
    u.uPlanetPos.value.set(
      PLANET_ORBIT * Math.cos(angle),
      PLANET_ORBIT * Math.sin(angle) * Math.sin(PLANET_INCLINATION),
      PLANET_ORBIT * Math.sin(angle) * Math.cos(PLANET_INCLINATION),
    )

    telemetry.planet.copy(u.uPlanetPos.value)

    // 첫 프레임에서 셰이더 컴파일이 끝난 뒤 인트로 연출을 시작합니다.
    if (++frames.current === 3) setUi({ ready: true })
  }, -1)

  return (
    <mesh frustumCulled={false} renderOrder={-1} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
