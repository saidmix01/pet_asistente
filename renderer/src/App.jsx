import { useEffect, useRef, useState } from 'react'

const api = typeof window !== 'undefined' ? window.pet : null

const SPRITE_URL = '/assets/pugasset-grid.png'
const SHEET = {
  width: 800,
  height: 512,
  frameWidth: 64,
  frameHeight: 64,
  columns: 11,
  rows: 8,
  offsetX: 95,
  offsetY: 0,
}
const FPS = 12

export default function App() {
  const [fallbackOffset, setFallbackOffset] = useState({ x: 0, y: 0 })
  const [frame, setFrame] = useState(0)
  const draggingRef = useRef(false)
  const hoveredRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const intervalMs = Math.max(16, Math.round(1000 / FPS))
    const totalFrames = SHEET.columns * SHEET.rows
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % totalFrames)
    }, intervalMs)

    return () => clearInterval(id)
  }, [])

  const setInteractive = (interactive) => {
    if (!api || typeof api.setInteractive !== 'function') return
    api.setInteractive(interactive)
  }

  const moveBy = (dx, dy) => {
    if (api && typeof api.moveBy === 'function') {
      api.moveBy(dx, dy)
      return
    }

    setFallbackOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const onPointerEnter = () => {
    hoveredRef.current = true
    setInteractive(true)
  }

  const onPointerLeave = () => {
    hoveredRef.current = false
    if (!draggingRef.current) setInteractive(false)
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    draggingRef.current = true
    lastRef.current = { x: e.screenX, y: e.screenY }
    setInteractive(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const dx = e.screenX - lastRef.current.x
    const dy = e.screenY - lastRef.current.y
    lastRef.current = { x: e.screenX, y: e.screenY }
    moveBy(dx, dy)
  }

  const stopDrag = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
    }
    if (!hoveredRef.current) setInteractive(false)
  }

  const col = frame % SHEET.columns
  const row = Math.floor(frame / SHEET.columns) % SHEET.rows
  const bgX = -(SHEET.offsetX + col * SHEET.frameWidth)
  const bgY = -(SHEET.offsetY + row * SHEET.frameHeight)

  return (
    <div className="stage">
      <div
        className="pet"
        style={{
          width: SHEET.frameWidth,
          height: SHEET.frameHeight,
          transform: `translate(${fallbackOffset.x}px, ${fallbackOffset.y}px)`,
          backgroundImage: `url(${SPRITE_URL})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${bgX}px ${bgY}px`,
          backgroundSize: `${SHEET.width}px ${SHEET.height}px`,
        }}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      />
    </div>
  )
}
