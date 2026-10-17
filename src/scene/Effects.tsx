import { useMemo } from 'react'
import { Bloom, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { useUi } from '../state/store'

/**
 * 시네마틱 후보정 체인. 셰이더는 HDR 선형값을 출력하므로
 * Bloom → 톤매핑 → 렌즈 색수차 → 필름 그레인 → 비네트 순서로 처리합니다.
 */
export function Effects() {
  const lowTier = useUi((state) => state.tier === 'low')
  const aberration = useMemo(() => new THREE.Vector2(0.00012, 0.00008), [])

  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      <Bloom
        mipmapBlur
        intensity={0.58}
        luminanceThreshold={1.05}
        luminanceSmoothing={0.3}
        radius={0.75}
        levels={lowTier ? 6 : 8}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <ChromaticAberration offset={aberration} radialModulation modulationOffset={0.45} />
      <Noise premultiply={false} blendFunction={BlendFunction.OVERLAY} opacity={0.025} />
      <Vignette offset={0.3} darkness={0.54} />
    </EffectComposer>
  )
}
