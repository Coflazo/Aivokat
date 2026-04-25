import React from 'react'

const MESSAGES = [
  'Mapping clause hierarchy…',
  'Building semantic graph…',
  'Connecting playbook nodes…',
  'Activating brain…',
]

const ORBIT_DOTS = [
  { angle: 0,   rx: 104, ry: 68, duration: 3.2, delay: 0 },
  { angle: 72,  rx: 104, ry: 68, duration: 3.2, delay: 0.64 },
  { angle: 144, rx: 104, ry: 68, duration: 3.2, delay: 1.28 },
  { angle: 216, rx: 104, ry: 68, duration: 3.2, delay: 1.92 },
  { angle: 288, rx: 104, ry: 68, duration: 3.2, delay: 2.56 },
  { angle: 40,  rx: 78,  ry: 50, duration: 2.4, delay: 0.3 },
  { angle: 160, rx: 78,  ry: 50, duration: 2.4, delay: 1.1 },
  { angle: 280, rx: 78,  ry: 50, duration: 2.4, delay: 1.9 },
]

export function BrainLoader({ label = 'Loading brain…' }: { label?: string }): JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const frameRef = React.useRef<number>(0)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = 260
    const H = 180
    canvas.width = W
    canvas.height = H

    const cx = W / 2
    const cy = H / 2
    const RX = 108
    const RY = 70

    let start = performance.now()

    function draw(now: number): void {
      const t = (now - start) / 1000
      ctx!.clearRect(0, 0, W, H)

      // Outer ellipse glow
      const glowAlpha = 0.12 + 0.06 * Math.sin(t * 1.4)
      ctx!.strokeStyle = `rgba(0,153,153,${glowAlpha})`
      ctx!.lineWidth = 18
      ctx!.beginPath()
      ctx!.ellipse(cx, cy, RX + 10, RY + 7, 0.08, 0, Math.PI * 2)
      ctx!.stroke()

      // Main ellipse
      const mainAlpha = 0.22 + 0.10 * Math.sin(t * 1.1)
      ctx!.strokeStyle = `rgba(0,153,153,${mainAlpha})`
      ctx!.lineWidth = 1.5
      ctx!.beginPath()
      ctx!.ellipse(cx, cy, RX, RY, 0.08, 0, Math.PI * 2)
      ctx!.stroke()

      // Inner ellipse
      ctx!.strokeStyle = `rgba(0,153,153,${mainAlpha * 0.4})`
      ctx!.lineWidth = 1
      ctx!.beginPath()
      ctx!.ellipse(cx, cy, RX * 0.62, RY * 0.62, -0.08, 0, Math.PI * 2)
      ctx!.stroke()

      // Orbiting dots
      ORBIT_DOTS.forEach((dot, i) => {
        const angle = (dot.angle * Math.PI / 180) + (t / dot.duration) * Math.PI * 2 + dot.delay
        const x = cx + dot.rx * Math.cos(angle)
        const y = cy + dot.ry * Math.sin(angle)
        const pulse = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.2)
        const r = i < 5 ? 3.5 : 2.5
        ctx!.beginPath()
        ctx!.arc(x, y, r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(0,153,153,${pulse})`
        ctx!.fill()

        // Synapse lines from dot to center (faint)
        if (i < 5) {
          const lineAlpha = 0.04 + 0.04 * Math.sin(t * 2 + i)
          ctx!.beginPath()
          ctx!.moveTo(cx, cy)
          ctx!.lineTo(x, y)
          ctx!.strokeStyle = `rgba(0,153,153,${lineAlpha})`
          ctx!.lineWidth = 0.8
          ctx!.stroke()
        }
      })

      // Random synapse spark between two random orbit positions
      const sparkPhase = t * 0.7
      const sparkA = Math.floor(sparkPhase) % ORBIT_DOTS.length
      const sparkB = (sparkA + 2) % ORBIT_DOTS.length
      const sparkProgress = sparkPhase - Math.floor(sparkPhase)
      const sparkAlpha = sparkProgress < 0.5
        ? sparkProgress * 2 * 0.4
        : (1 - sparkProgress) * 2 * 0.4
      if (sparkAlpha > 0.02) {
        const dotA = ORBIT_DOTS[sparkA]
        const dotB = ORBIT_DOTS[sparkB]
        const angleA = (dotA.angle * Math.PI / 180) + (t / dotA.duration) * Math.PI * 2 + dotA.delay
        const angleB = (dotB.angle * Math.PI / 180) + (t / dotB.duration) * Math.PI * 2 + dotB.delay
        const ax = cx + dotA.rx * Math.cos(angleA)
        const ay = cy + dotA.ry * Math.sin(angleA)
        const bx = cx + dotB.rx * Math.cos(angleB)
        const by = cy + dotB.ry * Math.sin(angleB)
        const grad = ctx!.createLinearGradient(ax, ay, bx, by)
        grad.addColorStop(0, `rgba(0,153,153,0)`)
        grad.addColorStop(0.5, `rgba(0,153,153,${sparkAlpha})`)
        grad.addColorStop(1, `rgba(0,153,153,0)`)
        ctx!.beginPath()
        ctx!.moveTo(ax, ay)
        ctx!.lineTo(bx, by)
        ctx!.strokeStyle = grad
        ctx!.lineWidth = 1.2
        ctx!.stroke()
      }

      // Core pulsing dot
      const coreR = 5 + 2 * Math.sin(t * 2.2)
      const coreGlow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3)
      coreGlow.addColorStop(0, 'rgba(0,153,153,.9)')
      coreGlow.addColorStop(1, 'rgba(0,153,153,0)')
      ctx!.beginPath()
      ctx!.arc(cx, cy, coreR * 3, 0, Math.PI * 2)
      ctx!.fillStyle = coreGlow
      ctx!.fill()
      ctx!.beginPath()
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx!.fillStyle = 'rgba(0,153,153,.95)'
      ctx!.fill()

      frameRef.current = requestAnimationFrame(draw)
    }

    frameRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameRef.current)
  }, [])

  return (
    <div className="brainLoader" role="status" aria-label={label}>
      <canvas ref={canvasRef} style={{ width: 260, height: 180 }} />
      <div className="brainLoaderTexts">
        {MESSAGES.map((msg) => (
          <span key={msg}>{msg}</span>
        ))}
      </div>
    </div>
  )
}
