import { useEffect } from 'react'
import { addAfterEffect, useThree } from '@react-three/fiber'

/** Read the completed framebuffer immediately after the postprocessing pass. */
export function ObservationCapture() {
  const gl = useThree(s => s.gl)
  useEffect(() => {
    let requested = false
    let saving = false
    const request = () => { if (!saving) requested = true }
    const fail = () => { saving = false; window.dispatchEvent(new Event('gargantua:capture-error')) }
    window.addEventListener('gargantua:capture', request)
    const unsubscribe = addAfterEffect(() => {
      if (!requested) return
      requested = false
      saving = true
      try {
        gl.domElement.toBlob(blob => {
          if (!blob) return fail()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `gargantua-observation-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
          a.click()
          setTimeout(() => URL.revokeObjectURL(url), 5000)
          saving = false
          window.dispatchEvent(new Event('gargantua:captured'))
        }, 'image/png')
      } catch { fail() }
    })
    return () => { unsubscribe(); window.removeEventListener('gargantua:capture', request) }
  }, [gl])
  return null
}
