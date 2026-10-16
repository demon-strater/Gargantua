import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { activeQuality, MAX_DUST } from '../lib/quality'

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHoleDepth;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;
    gl_Position = projectionMatrix * mv;

    // 블랙홀보다 앞쪽에 있는 먼지만 보이게 합니다 (뒤쪽 빛은 셰이더가 렌즈로 처리).
    float front = 1.0 - smoothstep(uHoleDepth * 0.5, uHoleDepth * 0.85, depth);
    float near = smoothstep(1.6, 8.0, depth);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.4 + aSeed * 1.6) + aSeed * 61.0);
    vAlpha = twinkle * front * near * (0.2 + 0.8 * fract(aSeed * 7.13));
    vColor = mix(vec3(1.0, 0.80, 0.60), vec3(0.62, 0.74, 1.0), fract(aSeed * 3.71));

    float size = (0.6 + fract(aSeed * 11.3)) * 52.0 / max(depth, 1.0);
    gl_PointSize = clamp(size, 1.0, 7.0) * uPixelRatio;
    vAlpha *= clamp(size, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 16.0) * vAlpha;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor * 0.55, a);
  }
`

/** 카메라와 블랙홀 사이를 떠다니는 성간 먼지 — 카메라가 움직일 때 깊이감(시차)을 만듭니다. */
export function StarDust() {
  const group = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    const positions = new Float32Array(MAX_DUST * 3)
    const seeds = new Float32Array(MAX_DUST)
    const v = new THREE.Vector3()
    for (let i = 0; i < MAX_DUST; i++) {
      // 반지름 32~240 M 껍질에 부피 균일 분포, 원반 평면 쪽에 살짝 몰리게
      const r = Math.cbrt(THREE.MathUtils.lerp(32 ** 3, 240 ** 3, Math.random()))
      v.randomDirection()
      v.y *= 0.55
      v.normalize().multiplyScalar(r)
      positions.set([v.x, v.y, v.z], i * 3)
      seeds[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uHoleDepth: { value: 54 } },
      }),
    [],
  )

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uPixelRatio.value = state.viewport.dpr
    material.uniforms.uHoleDepth.value = state.camera.position.length()
    geometry.setDrawRange(0, activeQuality.profile.dust)
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.004
  })

  return <points ref={group} geometry={geometry} material={material} frustumCulled={false} />
}
