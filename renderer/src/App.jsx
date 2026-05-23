import { useEffect, useRef, useState } from 'react'

const api = typeof window !== 'undefined' ? window.pet : null

const SPRITE_URL = '/assets/pugasset-grid.png'
const SHEET = {
  width: 800,
  height: 512,
  frameWidth: 64,
  frameHeight: 64,
  offsetX: 95,
  offsetY: 0,
}
const FPS = 12

// Sniff animation: row 7, cols 0–7 (8 frames, loops infinitely)
const ANIM_FRAMES = [
  { row: 7, col: 0 },
  { row: 7, col: 1 },
  { row: 7, col: 2 },
  { row: 7, col: 3 },
  { row: 7, col: 4 },
  { row: 7, col: 5 },
  { row: 7, col: 6 },
  { row: 7, col: 7 },
]

export default function App() {
  const [fallbackOffset, setFallbackOffset] = useState({ x: 0, y: 0 })
  const [frame, setFrame] = useState(0)
  const draggingRef = useRef(false)
  const hoveredRef = useRef(false)
  const lastRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const intervalMs = Math.max(16, Math.round(1000 / FPS))
    const id = setInterval(() => {
      setFrame((prev) => (prev + 1) % ANIM_FRAMES.length)
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

  const animFrame = ANIM_FRAMES[frame]
  const bgX = -(SHEET.offsetX + animFrame.col * SHEET.frameWidth)
  const bgY = -(SHEET.offsetY + animFrame.row * SHEET.frameHeight)

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
