import { useEffect, useRef, useState, useCallback } from 'react'

const api = typeof window !== 'undefined' ? window.pet : null

const SPRITE_URL = '/assets/pugasset-grid.png'
const SHEET = {
  width: 800, height: 512,
  frameWidth: 64, frameHeight: 64,
  offsetX: 95, offsetY: 0,
}
const WINDOW_W = 120
const WINDOW_H = 120

// ── Animation definitions ──────────────────────────────────
// row: spritesheet row | frames: num frames | msPerFrame: tick speed | speed: px per tick
const ANIMS = {
  sniff:     { row: 6, frames: 8, msPerFrame: 100, speed: 0  },
  walk:      { row: 4, frames: 8, msPerFrame: 100, speed: 3  },
  run:       { row: 5, frames: 8, msPerFrame: 70,  speed: 7  },
  sniffwalk: { row: 7, frames: 8, msPerFrame: 100, speed: 3  },
}

const STATE_DURATIONS = {
  sniff:     [2000, 5000],
  walk:      [1500, 4000],
  run:       [1000, 3000],
  sniffwalk: [1500, 4000],
}

const STATES = Object.keys(ANIMS)

function rand(min, max) { return Math.random() * (max - min) + min }

function pickNext(current) {
  const others = STATES.filter(s => s !== current)
  return others[Math.floor(Math.random() * others.length)]
}

// Browser fallback position
let gFallbackX = 0

export default function App() {
  const [render, setRender] = useState({
    bgX: -(SHEET.offsetX),
    bgY: -(SHEET.offsetY + 6 * SHEET.frameHeight),
    scaleX: 1,
    offsetX: 0,
    offsetY: 0,
    show: true,
  })

  // ── Refs (game-loop state, not React state) ──────────────
  const stateRef   = useRef('sniff')
  const dirRef     = useRef(1)       // 1 = right, -1 = left
  const frameRef   = useRef(0)
  const posRef     = useRef({ x: 0, y: 0 })
  const screenRef  = useRef({ w: 1920, h: 1080 })
  const draggingRef= useRef(false)
  const hoveredRef = useRef(false)
  const lastPtrRef = useRef({ x: 0, y: 0 })

  // ── Push render state (called once per rAF) ──────────────
  const syncRender = useCallback(() => {
    const anim = ANIMS[stateRef.current]
    const bgX = -(SHEET.offsetX + frameRef.current * SHEET.frameWidth)
    const bgY = -(SHEET.offsetY + anim.row * SHEET.frameHeight)
    const mirrored = dirRef.current < 0

    // In Electron the window IS the position; in browser we use CSS offset
    const offX = api ? 0 : posRef.current.x
    const offY = api ? 0 : posRef.current.y

    setRender({
      bgX, bgY,
      scaleX: mirrored ? -1 : 1,
      offsetX: offX,
      offsetY: offY,
      show: true,
    })
  }, [])

  // ── Game loop ────────────────────────────────────────────
  useEffect(() => {
    let rafId = null
    let lastTime = 0
    let frameAccum = 0
    let stateTimer = 0
    let ready = false

    const loop = (timestamp) => {
      if (!ready) {
        ready = true
        lastTime = timestamp

        // Init screen
        screenRef.current = { w: window.screen.width || 1920, h: window.screen.height || 1080 }

        // Init position via IPC
        ;(async () => {
          try {
            if (api?.getPosition) {
              const p = await api.getPosition()
              posRef.current = { x: p.x ?? 0, y: p.y ?? 0 }
            }
            if (api?.getScreenSize) {
              const s = await api.getScreenSize()
              screenRef.current = { w: s.width ?? 1920, h: s.height ?? 1080 }
            }
          } catch { /* fallback */ }

          // Random initial direction
          dirRef.current = Math.random() > 0.5 ? 1 : -1

          // First state timer
          const d = STATE_DURATIONS[stateRef.current]
          stateTimer = rand(d[0], d[1])

          syncRender()
        })()

        rafId = requestAnimationFrame(loop)
        return
      }

      const dt = timestamp - lastTime
      lastTime = timestamp

      if (!draggingRef.current) {
        const anim = ANIMS[stateRef.current]

        // ── Animation frame advance ──
        frameAccum += dt
        if (frameAccum >= anim.msPerFrame) {
          frameAccum -= anim.msPerFrame
          // Sniff always plays forward; movement anims follow direction
          const step = stateRef.current === 'sniff' ? 1 : dirRef.current
          frameRef.current = (frameRef.current + step + anim.frames) % anim.frames
        }

        // ── Movement ──
        if (anim.speed > 0) {
          const dx = anim.speed * dirRef.current
          let nx = posRef.current.x + dx
          const sw = screenRef.current.w

          // Edge → flip direction (mirror + reverse animation)
          if (nx + WINDOW_W >= sw) {
            nx = sw - WINDOW_W
            dirRef.current = -1
          } else if (nx <= 0) {
            nx = 0
            dirRef.current = 1
          }

          posRef.current = { x: nx, y: posRef.current.y }

          if (api?.moveBy) {
            api.moveBy(dx, 0).catch(() => {})
          } else {
            gFallbackX += dx
          }
        }

        // ── State transitions (random) ──
        stateTimer -= dt
        if (stateTimer <= 0) {
          const next = pickNext(stateRef.current)
          stateRef.current = next
          const d = STATE_DURATIONS[next]
          stateTimer = rand(d[0], d[1])
          frameAccum = 0
          frameRef.current = 0
        }

        syncRender()
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => { if (rafId) cancelAnimationFrame(rafId) }
  }, [syncRender])

  // ── Drag / interact handlers ────────────────────────────
  const setInteractive = (val) => {
    if (!api?.setInteractive) return
    api.setInteractive(val).catch(() => {})
  }

  const moveBy = (dx, dy) => {
    if (api?.moveBy) {
      api.moveBy(dx, dy).catch(() => {})
      return
    }
    gFallbackX += dx
    posRef.current = { x: gFallbackX, y: posRef.current.y + dy }
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
    lastPtrRef.current = { x: e.screenX, y: e.screenY }
    setInteractive(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const dx = e.screenX - lastPtrRef.current.x
    const dy = e.screenY - lastPtrRef.current.y
    lastPtrRef.current = { x: e.screenX, y: e.screenY }

    // Keep local position in sync with window
    posRef.current = {
      x: posRef.current.x + dx,
      y: posRef.current.y + dy,
    }
    moveBy(dx, dy)
  }

  const stopDrag = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    if (!hoveredRef.current) setInteractive(false)
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="stage">
      <div
        className="pet"
        style={{
          width: SHEET.frameWidth,
          height: SHEET.frameHeight,
          transform: `translate(${render.offsetX}px, ${render.offsetY}px) scaleX(${render.scaleX})`,
          backgroundImage: `url(${SPRITE_URL})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${render.bgX}px ${render.bgY}px`,
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
