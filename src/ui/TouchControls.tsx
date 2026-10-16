import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useUi } from '../state/store'
import { touchInput } from './touchInput'

const RADIUS = 46

/** 모바일: 왼쪽 가상 조이스틱(이동) + 오른쪽 상승/하강/가속 버튼. 시선은 화면 드래그. */
export function TouchControls() {
  const engaged = useUi((state) => state.engaged)
  const knob = useRef<HTMLSpanElement>(null)
  const origin = useRef<{ id: number; x: number; y: number } | null>(null)

  if (!engaged) return null

  const move = (x: number, y: number) => {
    const length = Math.hypot(x, y)
    const k = length > RADIUS ? RADIUS / length : 1
    const dx = x * k
    const dy = y * k
    touchInput.x = dx / RADIUS
    touchInput.y = -dy / RADIUS
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`
  }
  const release = () => {
    origin.current = null
    touchInput.x = 0
    touchInput.y = 0
    if (knob.current) knob.current.style.transform = ''
  }

  const hold = (lift: number) => ({
    onPointerDown: (event: ReactPointerEvent) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      touchInput.lift = lift
    },
    onPointerUp: () => (touchInput.lift = 0),
    onPointerCancel: () => (touchInput.lift = 0),
  })

  return (
    <div className="touch">
      <div
        className="touch__stick"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          const rect = event.currentTarget.getBoundingClientRect()
          origin.current = { id: event.pointerId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          move(event.clientX - origin.current.x, event.clientY - origin.current.y)
        }}
        onPointerMove={(event) => {
          if (origin.current?.id === event.pointerId) move(event.clientX - origin.current.x, event.clientY - origin.current.y)
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <span ref={knob} />
      </div>
      <div className="touch__buttons">
        <button type="button" aria-label="상승" {...hold(1)}>
          ▲
        </button>
        <button type="button" aria-label="하강" {...hold(-1)}>
          ▼
        </button>
        <button
          type="button"
          aria-label="가속"
          onPointerDown={() => (touchInput.boost = true)}
          onPointerUp={() => (touchInput.boost = false)}
          onPointerCancel={() => (touchInput.boost = false)}
        >
          ≫
        </button>
      </div>
    </div>
  )
}
