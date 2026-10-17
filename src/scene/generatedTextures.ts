import * as THREE from 'three'
import common from '../shaders/common.glsl?raw'
import quadVertex from '../shaders/blackhole.vert.glsl?raw'
import diskFragment from '../shaders/diskTexture.frag.glsl?raw'
import skyVertex from '../shaders/sky.vert.glsl?raw'
import skyFragment from '../shaders/sky.frag.glsl?raw'

/**
 * 강착 원반 텍스처 (2048×1024, φ 방향 반복, 밉맵).
 * 매 프레임 노이즈를 계산하는 대신 한 번 구워 두고 체적 샘플링에서 읽기만 합니다.
 */
export function bakeDiskTexture(gl: THREE.WebGLRenderer, requestedSize = 4096) {
  const size = Math.min(requestedSize, gl.capabilities.maxTextureSize)
  const target = new THREE.WebGLRenderTarget(size, size / 2, {
    type: THREE.UnsignedByteType,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: false,
  })
  const material = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: common + diskFragment,
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const scene = new THREE.Scene().add(quad)

  const previous = gl.getRenderTarget()
  gl.setRenderTarget(target)
  gl.render(scene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1))
  gl.setRenderTarget(previous)

  quad.geometry.dispose()
  material.dispose()
  return target
}

/** 은하수 큐브맵 (HDR). 별은 렌즈로 늘어나도 선명하도록 메인 셰이더에서 따로 그립니다. */
export function bakeSkyCube(gl: THREE.WebGLRenderer, size: number) {
  const target = new THREE.WebGLCubeRenderTarget(size, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
  })
  const material = new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: common + skyFragment,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
  })
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(10, 96, 48), material)
  const scene = new THREE.Scene().add(sphere)
  new THREE.CubeCamera(0.1, 100, target).update(gl, scene)

  sphere.geometry.dispose()
  material.dispose()
  return target
}
