import { useState } from 'react'
import { detectDevice } from './lib/quality'
import { Experience } from './scene/Experience'
import { Overlay } from './ui/Overlay'

export default function App() {
  const [device] = useState(detectDevice)

  return (
    <>
      <div className="stage" aria-hidden="true">
        <Experience device={device} />
      </div>
      <Overlay device={device} />
    </>
  )
}
