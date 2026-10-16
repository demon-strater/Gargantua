import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cartesianToBL, horizonRadius, zamo } from '../lib/kerr'
import { flight, getUi, intro, physics, setUi, telemetry } from '../state/store'
import { touchInput } from '../ui/touchInput'

const LOOK_SENSITIVITY = 0.0022
const DRAG_SENSITIVITY = 0.0042
const MAX_DISTANCE = 320
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight'])

/**
 * 마인크래프트 크리에이티브 모드식 자유 비행.
 *  - 클릭: 마우스 고정(포인터 락) 후 마우스로 시선, ESC로 해제 (해제 상태에서는 드래그로 시선)
 *  - W/A/S/D: 바라보는 방향 기준 수평 이동, Space/Shift: 상승/하강, Ctrl: 가속
 *  - 속도는 블랙홀까지의 거리에 비례해 자동으로 줄어들고, 사건의 지평선 바로 바깥에서 멈춥니다.
 */
export function FlightRig() {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera
  const canvas = useThree((state) => state.gl.domElement)
  const keys = useRef(new Set<string>())
  const scratch = useMemo(
    () => ({ euler: new THREE.Euler(0, 0, 0, 'YXZ'), wish: new THREE.Vector3(), forward: new THREE.Vector3(), bl: new THREE.Vector3() }),
    [],
  )

  useEffect(() => {
    camera.fov = 55
    camera.near = 0.05
    camera.updateProjectionMatrix()
  }, [camera])

  useEffect(() => {
    const engage = () => {
      if (!getUi().ready) return
      if (!getUi().engaged) setUi({ engaged: true })
      flight.engaged = true
    }
    const lock = () => {
      if (window.matchMedia('(pointer: coarse)').matches) return
      ;(document.activeElement as HTMLElement | null)?.blur?.()
      const request = canvas.requestPointerLock() as unknown as Promise<void> | undefined
      request?.catch?.(() => {})
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyP') {
        setUi({ panelOpen: !getUi().panelOpen })
        if (document.pointerLockElement) document.exitPointerLock()
        return
      }
      if (event.code === 'KeyH') {
        setUi({ helpOpen: !getUi().helpOpen })
        return
      }
      if (!MOVE_KEYS.has(event.code)) return
      // 포커스된 버튼이 Space로 눌리거나 페이지가 움직이지 않게 합니다.
      if (getUi().engaged) event.preventDefault()
      keys.current.add(event.code)
    }
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code)
    const onBlur = () => keys.current.clear()

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas || flight.autopilot) return
      flight.yaw -= event.movementX * LOOK_SENSITIVITY
      flight.pitch = THREE.MathUtils.clamp(flight.pitch - event.movementY * LOOK_SENSITIVITY, -1.55, 1.55)
    }
    const onLockChange = () => setUi({ pointerLocked: document.pointerLockElement === canvas })

    // 포인터 락이 없을 때(또는 터치)는 드래그로 시선을 돌립니다. 짧은 클릭은 비행 시작/마우스 고정.
    let drag: { id: number; x: number; y: number; moved: number } | null = null
    const onPointerDown = (event: PointerEvent) => {
      if (document.pointerLockElement === canvas) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 }
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      drag.x = event.clientX
      drag.y = event.clientY
      drag.moved += Math.abs(dx) + Math.abs(dy)
      if (!getUi().engaged || flight.autopilot) return
      flight.yaw += dx * DRAG_SENSITIVITY
      flight.pitch = THREE.MathUtils.clamp(flight.pitch + dy * DRAG_SENSITIVITY, -1.55, 1.55)
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      const click = drag.moved < 6
      drag = null
      if (!click) return
      engage()
      lock()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLockChange)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [canvas])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const { wish, forward, euler, bl } = scratch
    const pressed = keys.current
    const horizon = horizonRadius(physics.spin)

    if (flight.engaged && !flight.autopilot) {
      // 수평 이동은 요 방향 기준, 상승/하강은 세계 Y축 (크리에이티브 모드와 같은 감각)
      const f = (pressed.has('KeyW') ? 1 : 0) - (pressed.has('KeyS') ? 1 : 0) + touchInput.y
      const s = (pressed.has('KeyD') ? 1 : 0) - (pressed.has('KeyA') ? 1 : 0) + touchInput.x
      const u = (pressed.has('Space') ? 1 : 0) - (pressed.has('ShiftLeft') || pressed.has('ShiftRight') ? 1 : 0) + touchInput.lift
      const sinY = Math.sin(flight.yaw)
      const cosY = Math.cos(flight.yaw)
      wish.set(-sinY * f + cosY * s, u, -cosY * f - sinY * s)
      if (wish.lengthSq() > 1) wish.normalize()

      const r = flight.position.length()
      const boost = pressed.has('ControlLeft') || pressed.has('ControlRight') || touchInput.boost ? 3 : 1
      const speed = THREE.MathUtils.clamp(0.42 * (r - horizon), 0.35, 40) * boost
      wish.multiplyScalar(speed)
      flight.velocity.lerp(wish, 1 - Math.exp(-dt * 5))
      flight.position.addScaledVector(flight.velocity, dt)

      // 사건의 지평선 바로 바깥(r₊ + 0.12 M)에서 멈추는 벽 — 에르고스피어 안까지는 들어갈 수 있습니다.
      cartesianToBL(flight.position, physics.spin, bl)
      const floor = horizon + 0.12
      if (bl.x < floor) {
        flight.position.multiplyScalar(floor / bl.x)
        const radial = flight.position.clone().normalize()
        const inward = flight.velocity.dot(radial)
        if (inward < 0) flight.velocity.addScaledVector(radial, -inward)
      }
      if (flight.position.length() > MAX_DISTANCE) flight.position.setLength(MAX_DISTANCE)
    }

    euler.set(flight.pitch, flight.yaw, physics.roll)
    camera.quaternion.setFromEuler(euler)
    camera.position.copy(flight.position)
    // 인트로: 시선 반대 방향으로 멀리서부터 날아 들어옵니다.
    if (intro.k > 0.0001) {
      forward.set(0, 0, -1).applyQuaternion(camera.quaternion)
      camera.position.addScaledVector(forward, -intro.k * 92)
    }
    camera.updateMatrixWorld()

    // 계측값 (렌즈 토글과 무관하게 실제 시공간 기준)
    cartesianToBL(camera.position, physics.spin, bl)
    const frame = zamo(bl.x, bl.y, physics.spin, 1)
    telemetry.r = bl.x
    telemetry.theta = bl.y
    telemetry.alpha = frame.alpha
    telemetry.omega = frame.omega
    telemetry.varpi = frame.varpi
    telemetry.speed = flight.velocity.length()
  }, -2)

  return null
}
