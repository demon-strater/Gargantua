import { Component, useState, type ReactNode } from 'react'
import { detectDevice } from './lib/quality'
import { Experience } from './scene/Experience'
import { Overlay } from './ui/Overlay'

export default function App() {
  const [device] = useState(detectDevice)

  return (
    <ObservatoryBoundary>
      <div className="stage" aria-hidden="true">
        <Experience device={device} />
      </div>
      <Overlay device={device} />
    </ObservatoryBoundary>
  )
}

class ObservatoryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="render-error">
      <span>GARGANTUA / OBSERVATORY</span>
      <h1>관측 장치를 시작하지 못했습니다.</h1>
      <p>WebGL 2를 지원하는 브라우저와 하드웨어 가속이 필요합니다.<br />브라우저의 그래픽 가속 설정을 확인한 뒤 다시 시도해 주세요.</p>
      <button onClick={() => window.location.reload()}>관측소 다시 열기</button>
    </main>
  }
}
