import { useEffect, useRef, useState, useCallback } from 'react'
import { runHeldKarp, runBranchAndBound, runChristofides, generateRandomMatrix, cityLabel } from './algorithms'
import CanvasMap from './components/CanvasMap'
import BenchmarksTab from './components/BenchmarksTab'
import AlgorithmsInfo from './components/AlgorithmsInfo'
import TeamTab from './components/TeamTab'

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER HOOK
// ═══════════════════════════════════════════════════════════════════════════════
function useAnimatedCounter(target, duration = 800, decimals = 0) {
  const [value, setValue] = useState(0)
  const raf = useRef(null)
  const start = useRef(null)

  useEffect(() => {
    if (target === null || target === undefined) { setValue(0); return }
    start.current = performance.now()
    const from = 0
    const tick = (now) => {
      const elapsed = now - start.current
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setValue(from + (target - from) * eased)
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => raf.current && cancelAnimationFrame(raf.current)
  }, [target, duration])

  return decimals > 0 ? value.toFixed(decimals) : Math.round(value)
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE CANVAS
// ═══════════════════════════════════════════════════════════════════════════════
function ParticleCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.3, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      op: Math.random() * 0.4 + 0.1, td: Math.random() > 0.5 ? 1 : -1, ts: Math.random() * 0.012 + 0.003,
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < 130) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(96,165,250,${(1 - d / 130) * 0.09})`; ctx.lineWidth = 0.5; ctx.stroke()
          }
        }
      }
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.op += p.ts * p.td
        if (p.op > 0.55 || p.op < 0.05) p.td *= -1
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
        g.addColorStop(0, `rgba(96,165,250,${p.op})`); g.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(191,219,254,${p.op})`; ctx.fill()
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEPPER
// ═══════════════════════════════════════════════════════════════════════════════
function Stepper({ currentStep }) {
  const steps = [
    { id: 'config', label: 'Configure', icon: '⚙' },
    { id: 'matrix', label: 'Matrix & Algo', icon: '▦' },
    { id: 'results', label: 'Results', icon: '✦' },
  ]
  const stepIndex = { config: 0, matrix: 1, results: 2 }[currentStep] || 0

  return (
    <div className="stepper" style={{ marginBottom: 12 }}>
      {steps.map((s, i) => {
        const status = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'inactive'
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div className="stepper-step">
              <div className={`stepper-circle ${status}`}>
                {status === 'done' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span>{s.icon}</span>
                )}
              </div>
              <span className={`stepper-label ${status}`}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`stepper-line ${i < stepIndex ? 'active' : 'inactive'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════════
function Navbar({ activeTab, setActiveTab }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  const links = [
    { id: 'visualizer', label: 'Matrix Visualizer' },
    { id: 'canvas-map', label: '2D Interactive Map' },
    { id: 'benchmarks', label: 'Benchmarks' },
    { id: 'algorithms-info', label: 'Algorithms Info' },
    { id: 'team', label: 'Team' },
  ]
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: scrolled ? 'rgba(3,7,18,0.85)' : 'rgba(3,7,18,0.3)',
      backdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      transition: 'all 0.4s ease',
      padding: scrolled ? '12px 0' : '20px 0',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setActiveTab('visualizer')}>
          <div className="logo-mark" style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em', color: 'white' }}>
            MCT<span className="gradient-text">Finder</span>
          </span>
        </div>

        {/* Desktop links — centered */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="hide-mobile">
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => setActiveTab(l.id)}
              className="nav-link"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: activeTab === l.id ? 'white' : 'rgba(148,163,184,0.7)',
                padding: '4px 0',
                position: 'relative',
                transition: 'color 0.25s'
              }}
            >
              {l.label}
              {activeTab === l.id && (
                <span style={{
                  position: 'absolute', bottom: -4, left: 0, right: 0, height: 1,
                  background: '#60a5fa', boxShadow: '0 0 6px #60a5fa'
                }} />
              )}
            </button>
          ))}
        </div>

        {/* Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="hide-mobile">
          <div className="glass-card" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 8px #60a5fa', flexShrink: 0 }} />
            <span style={{ color: 'rgba(148,163,184,0.9)', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>DAA Project · 2026</span>
          </div>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }} className="show-mobile">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /> : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="glass-card" style={{ margin: '8px 16px 0', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {links.map(l => (
            <button
              key={l.id}
              onClick={() => { setActiveTab(l.id); setOpen(false) }}
              className="nav-link"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                padding: '8px 12px',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: activeTab === l.id ? 'white' : 'rgba(148,163,184,0.7)',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED GRAPH VISUALIZATION (sequential edge drawing)
// ═══════════════════════════════════════════════════════════════════════════════
function GraphViz({ n, path, dist }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    const radius = Math.min(W, H) * 0.34
    const cx = W / 2, cy = H / 2
    const pos = Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i / n) - Math.PI / 2
      return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) }
    })

    if (animRef.current) cancelAnimationFrame(animRef.current)

    // If no path, just draw static graph
    if (!path || path.length <= 1) {
      ctx.clearRect(0, 0, W, H)
      drawBackground(ctx, pos, n, W, H)
      drawNodes(ctx, pos, n, path, dist)
      return
    }

    // Animate edges one by one
    const totalEdges = path.length - 1
    const edgeDuration = 400 // ms per edge
    const totalDuration = totalEdges * edgeDuration
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / totalDuration, 1)
      const currentEdgeFloat = progress * totalEdges
      const completedEdges = Math.floor(currentEdgeFloat)
      const edgeProgress = currentEdgeFloat - completedEdges

      ctx.clearRect(0, 0, W, H)
      drawBackground(ctx, pos, n, W, H)

      // Draw completed edges
      for (let i = 0; i < Math.min(completedEdges, totalEdges); i++) {
        drawRouteEdge(ctx, pos, path, i, dist, 1)
      }

      // Draw current animating edge
      if (completedEdges < totalEdges) {
        drawRouteEdge(ctx, pos, path, completedEdges, dist, edgeProgress)
      }

      // Draw nodes (with pulse on arrival)
      drawNodes(ctx, pos, n, path, dist, completedEdges)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      }
    }

    animRef.current = requestAnimationFrame(animate)

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [n, path, dist])

  return <canvas ref={canvasRef} width={500} height={400} style={{ width: '100%', maxWidth: 500, display: 'block', margin: '0 auto' }} />
}

function drawBackground(ctx, pos, n) {
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    ctx.beginPath(); ctx.moveTo(pos[i].x, pos[i].y); ctx.lineTo(pos[j].x, pos[j].y)
    ctx.strokeStyle = 'rgba(96,165,250,0.05)'; ctx.lineWidth = 1; ctx.stroke()
  }
}

function drawRouteEdge(ctx, pos, path, edgeIndex, dist, progress) {
  const u = path[edgeIndex], v = path[edgeIndex + 1]
  if (u === undefined || v === undefined || !pos[u] || !pos[v]) return
  const x1 = pos[u].x, y1 = pos[u].y, x2 = pos[v].x, y2 = pos[v].y
  const ex = x1 + (x2 - x1) * progress, ey = y1 + (y2 - y1) * progress

  // Glow
  ctx.save()
  ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 20
  const gr = ctx.createLinearGradient(x1, y1, ex, ey)
  gr.addColorStop(0, 'rgba(59,130,246,0.95)')
  gr.addColorStop(0.5, 'rgba(96,165,250,1)')
  gr.addColorStop(1, 'rgba(59,130,246,0.95)')
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey)
  ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.stroke()
  ctx.restore()

  // Traveling dot
  ctx.beginPath()
  ctx.arc(ex, ey, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#60a5fa'
  ctx.shadowColor = '#60a5fa'
  ctx.shadowBlur = 15
  ctx.fill()
  ctx.shadowBlur = 0

  // Arrow (only when complete)
  if (progress >= 0.95) {
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const tipX = x2 - 18 * Math.cos(angle), tipY = y2 - 18 * Math.sin(angle)
    ctx.beginPath()
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - 9 * Math.cos(angle - Math.PI / 6), tipY - 9 * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(tipX, tipY)
    ctx.lineTo(tipX - 9 * Math.cos(angle + Math.PI / 6), tipY - 9 * Math.sin(angle + Math.PI / 6))
    ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.stroke()
  }

  // Weight label (when at least partially drawn)
  if (progress > 0.4 && dist) {
    const mx = (x1 + ex) / 2, my = (y1 + ey) / 2
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const nx = -Math.sin(angle) * 18, ny = Math.cos(angle) * 18
    // Glass pill background
    const lx = mx + nx, ly = my + ny
    ctx.fillStyle = 'rgba(15,23,42,0.8)'
    const textW = 22
    ctx.beginPath()
    ctx.roundRect(lx - textW / 2 - 6, ly - 9, textW + 12, 18, 6)
    ctx.fill()
    ctx.strokeStyle = 'rgba(96,165,250,0.3)'
    ctx.lineWidth = 0.5
    ctx.stroke()
    ctx.fillStyle = 'rgba(147,197,253,0.95)'; ctx.font = 'bold 11px Inter,sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(dist[u][v], lx, ly)
  }
}

function drawNodes(ctx, pos, n, path, dist, completedEdges = Infinity) {
  const radius = Math.min(500, 400) * 0.34
  const cx = 250, cy = 200

  pos.forEach((p, i) => {
    const isStart = i === 0
    const inRoute = path?.includes(i)
    // Check if this node has been "reached" by the animation
    const reachedIndex = path ? path.indexOf(i) : -1
    const isReached = reachedIndex >= 0 && reachedIndex <= completedEdges
    const justArrived = reachedIndex === completedEdges && completedEdges !== Infinity

    // Pulse ring for just-arrived
    if (justArrived) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(p.x, p.y, 28, 0, Math.PI * 2)
      ctx.strokeStyle = isStart ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }

    // Outer glow
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30)
    gr.addColorStop(0, isStart ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.3)')
    gr.addColorStop(1, 'transparent')
    ctx.beginPath(); ctx.arc(p.x, p.y, 30, 0, Math.PI * 2); ctx.fillStyle = gr; ctx.fill()

    // Node circle
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2)
    ctx.fillStyle = isStart ? '#78350f' : (inRoute && isReached) ? '#1e3a8a' : '#0f172a'
    ctx.fill()
    ctx.strokeStyle = isStart ? '#f59e0b' : '#3b82f6'
    ctx.lineWidth = isReached ? 3 : 2.5
    ctx.stroke()

    // Label
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px Inter,sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(cityLabel(i), p.x, p.y)

    // Outer label
    const a = (2 * Math.PI * i / n) - Math.PI / 2
    const lr = radius + 30
    ctx.fillStyle = isStart ? 'rgba(251,191,36,0.7)' : 'rgba(148,163,184,0.6)'
    ctx.font = '10px Inter,sans-serif'
    ctx.fillText(cityLabel(i), cx + lr * Math.cos(a), cy + lr * Math.sin(a))
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 1 — CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
function ConfigStep({ onContinue }) {
  const [n, setN] = useState(4)
  const [method, setMethod] = useState('manual')
  const [err, setErr] = useState('')

  const presets = [4, 6, 8, 10]

  const go = () => {
    const v = parseInt(n, 10)
    if (!v || v < 2 || v > 10) { setErr('Enter a number between 2 and 10.'); return }
    setErr(''); onContinue(v, method)
  }

  return (
    <div style={{ width: '100%', maxWidth: 520, animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
      <div className="glass-card" style={{ padding: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 36 }}>
          <div className="icon-glow" style={{ width: 46, height: 46, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <div>
            <div style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.125rem' }}>Configure Problem</div>
            <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.75rem', marginTop: 2 }}>Define cities and input method</div>
          </div>
        </div>

        {/* Quick-select presets */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ display: 'block', color: 'rgba(148,163,184,0.8)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Number of Cities
          </label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {presets.map(p => (
              <button
                key={p}
                onClick={() => { setN(p); setErr('') }}
                className={`quick-chip ${parseInt(n) === p ? 'selected' : ''}`}
              >
                {p}
              </button>
            ))}
          </div>
          <input
            id="num-cities-input"
            type="number" min="2" max="10"
            value={n}
            onChange={e => { setN(e.target.value); setErr('') }}
            className="hero-input"
            placeholder="Custom (2–10)"
            style={{ width: '100%', borderRadius: 12, padding: '14px 16px', fontSize: '0.95rem' }}
          />
          <div style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem', marginTop: 8 }}>
            Supports 2–10 cities · All three algorithms work optimally in this range
          </div>
        </div>

        {/* Input method */}
        <div style={{ marginBottom: 36 }}>
          <label style={{ display: 'block', color: 'rgba(148,163,184,0.8)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Input Method
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { id: 'manual', label: 'Manual Entry', desc: 'Enter custom distances', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { id: 'random', label: 'Random', desc: 'Auto-generate distances', icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg> },
            ].map(m => {
              const sel = method === m.id
              return (
                <button key={m.id} id={`method-${m.id}`} onClick={() => setMethod(m.id)} style={{
                  padding: '16px 14px', borderRadius: 14, border: sel ? '1px solid rgba(96,165,250,0.55)' : '1px solid rgba(255,255,255,0.08)',
                  background: sel ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s',
                }}>
                  <div style={{ color: sel ? '#60a5fa' : 'rgba(100,116,139,1)', marginBottom: 8 }}>{m.icon}</div>
                  <div style={{ color: sel ? 'white' : 'rgba(148,163,184,0.8)', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4, fontFamily: "'Space Grotesk',sans-serif" }}>{m.label}</div>
                  <div style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem' }}>{m.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {err && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: '0.875rem', marginBottom: 20 }}>
            {err}
          </div>
        )}

        <button id="continue-btn" onClick={go} className="btn-primary" style={{
          width: '100%', padding: '16px', borderRadius: 14, color: 'white', fontWeight: 700, fontSize: '0.95rem',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          Continue
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 2 — MATRIX + ALGORITHM
// ═══════════════════════════════════════════════════════════════════════════════
function MatrixStep({ n, inputMethod, matrix, onMatrixChange, onBack, onSolve, onSolveAll, isRunning }) {
  const [selectedAlgo, setSelectedAlgo] = useState(null)
  const [err, setErr] = useState('')
  const [symmetric, setSymmetric] = useState(true)

  const ALGOS = [
    { id: 'bb', name: 'Branch & Bound', short: 'B&B', type: 'Exact', time: 'O(n!)', space: 'O(n)', desc: 'Optimal solution via pruned DFS with tight bounding.', accent: '#10b981' },
    { id: 'hk', name: 'Held-Karp', short: 'HK', type: 'Exact DP', time: 'O(2ⁿ·n²)', space: 'O(2ⁿ·n)', desc: 'Guaranteed optimal via dynamic programming bitmask DP.', accent: '#3b82f6' },
    { id: 'ch', name: 'Christofides', short: 'CH', type: '≤1.5× Opt', time: 'O(n³)', space: 'O(n²)', desc: 'Polynomial approximation: MST + matching + Euler shortcut.', accent: '#8b5cf6' },
  ]

  // Compute heat-map ranges for color coding
  const allValues = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i !== j && matrix[i]?.[j] > 0) allValues.push(matrix[i][j])
  }
  const minVal = Math.min(...allValues, Infinity)
  const maxVal = Math.max(...allValues, 0)
  const range = maxVal - minVal || 1

  const getHeatClass = (val) => {
    if (val <= 0 || !val) return ''
    const ratio = (val - minVal) / range
    if (ratio < 0.33) return 'matrix-heat-low'
    if (ratio < 0.66) return 'matrix-heat-med'
    return 'matrix-heat-high'
  }

  const handleCell = (i, j, val) => {
    const m = matrix.map(r => [...r])
    const num = val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0)
    m[i][j] = num
    if (symmetric && i !== j) m[j][i] = num
    onMatrixChange(m)
    setErr('')
  }

  const validateMatrix = () => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        if (!matrix[i]?.[j] || matrix[i][j] <= 0) {
          setErr(`Missing distance at [${cityLabel(i)} → ${cityLabel(j)}]. All values must be > 0.`)
          return false
        }
      }
    return true
  }

  const handleSingle = () => {
    if (!selectedAlgo) { setErr('Select an algorithm first.'); return }
    if (!validateMatrix()) return
    setErr('')
    onSolve(selectedAlgo)
  }

  const handleAll = () => {
    if (!validateMatrix()) return
    setErr('')
    onSolveAll()
  }

  return (
    <div style={{ width: '100%', animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
      {/* Back row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
          color: 'rgba(148,163,184,0.7)', cursor: 'pointer', padding: '8px 14px', fontSize: '0.8rem',
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <span style={{ color: 'rgba(71,85,105,1)', fontSize: '0.8rem' }}>
          {n} Cities · {inputMethod === 'random' ? 'Random Generation' : 'Manual Entry'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        {/* Matrix Card */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.05rem' }}>Distance Matrix</div>
              <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.75rem', marginTop: 3 }}>
                Enter travel cost from row city to column city
                {allValues.length > 0 && (
                  <span style={{ marginLeft: 12 }}>
                    <span style={{ color: '#10b981', fontSize: '0.68rem' }}>■</span> Low
                    <span style={{ color: '#f59e0b', fontSize: '0.68rem', marginLeft: 6 }}>■</span> Mid
                    <span style={{ color: '#ef4444', fontSize: '0.68rem', marginLeft: 6 }}>■</span> High
                  </span>
                )}
              </div>
            </div>
            {inputMethod !== 'random' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setSymmetric(!symmetric)}>
                <div style={{
                  width: 38, height: 22, borderRadius: 11,
                  background: symmetric ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.3s',
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: symmetric ? 19 : 3,
                    width: 16, height: 16, borderRadius: '50%', background: 'white',
                    transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </div>
                <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.75rem' }}>Auto-symmetric</span>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 5 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  {Array.from({ length: n }, (_, j) => (
                    <th key={j} className="matrix-col-header">{cityLabel(j)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: n }, (_, i) => (
                  <tr key={i}>
                    <td className="matrix-row-header">{cityLabel(i)}</td>
                    {Array.from({ length: n }, (_, j) => (
                      <td key={j} style={{ padding: 2 }}>
                        {i === j
                          ? <div className="matrix-cell-diag">—</div>
                          : <input
                              type="number" min="1"
                              value={matrix[i]?.[j] || ''}
                              onChange={e => handleCell(i, j, e.target.value)}
                              className={`matrix-cell-input ${getHeatClass(matrix[i]?.[j])}`}
                              placeholder="—"
                              title={`${cityLabel(i)} → ${cityLabel(j)}`}
                            />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Algorithm Selection */}
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.05rem', marginBottom: 6 }}>Select Algorithm</div>
          <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.75rem', marginBottom: 24 }}>Choose the TSP solving strategy to apply to your distance matrix</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 8 }}>
            {ALGOS.map(a => {
              const sel = selectedAlgo === a.id
              return (
                <button key={a.id} id={`algo-${a.id}`} onClick={() => { setSelectedAlgo(a.id); setErr('') }} className={sel ? 'algo-card-selected' : ''} style={{
                  padding: '20px 18px', borderRadius: 16, textAlign: 'left', cursor: 'pointer', transition: 'all 0.25s',
                  border: sel ? `1px solid ${a.accent}60` : '1px solid rgba(255,255,255,0.08)',
                  background: sel ? `${a.accent}14` : 'rgba(255,255,255,0.03)',
                  '--algo-accent': a.accent,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: '0.8rem',
                      background: sel ? `${a.accent}20` : 'rgba(255,255,255,0.05)',
                      color: sel ? a.accent : 'rgba(100,116,139,1)',
                      border: `1px solid ${sel ? a.accent + '40' : 'rgba(255,255,255,0.08)'}`,
                    }}>{a.short}</div>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                      background: sel ? `${a.accent}18` : 'rgba(255,255,255,0.05)',
                      color: sel ? a.accent : 'rgba(100,116,139,1)',
                      border: `1px solid ${sel ? a.accent + '35' : 'rgba(255,255,255,0.08)'}`,
                    }}>{a.type}</span>
                  </div>
                  <div style={{ color: sel ? 'white' : 'rgba(148,163,184,0.7)', fontWeight: 700, fontSize: '0.875rem', marginBottom: 8, fontFamily: "'Space Grotesk',sans-serif" }}>{a.name}</div>
                  <div style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem', lineHeight: 1.55, marginBottom: 12 }}>{a.desc}</div>
                  <div style={{ color: sel ? a.accent : 'rgba(71,85,105,1)', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>Time: {a.time}</span>
                    <span>Space: {a.space}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Error */}
        {err && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '14px 18px', color: '#f87171', fontSize: '0.875rem' }}>
            ⚠ {err}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <button id="find-tour-btn" disabled={isRunning} onClick={handleSingle} className="btn-primary" style={{
            width: '100%', padding: '18px', borderRadius: 16, color: 'white', fontWeight: 800, fontSize: '0.95rem',
            cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: "'Space Grotesk',sans-serif",
            letterSpacing: '-0.01em',
          }}>
            {isRunning ? (
              <><svg style={{ animation: 'spin 1s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3"/><path d="M21 12a9 9 0 01-9-9" strokeLinecap="round"/>
              </svg>Running…</>
            ) : (
              <><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>Find Tour</>
            )}
          </button>

          <button disabled={isRunning} onClick={handleAll} className="btn-emerald" style={{
            width: '100%', padding: '18px', borderRadius: 16, color: 'white', fontWeight: 800, fontSize: '0.95rem',
            cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: "'Space Grotesk',sans-serif",
            letterSpacing: '-0.01em',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
            Run All & Compare
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE BREAKDOWN
// ═══════════════════════════════════════════════════════════════════════════════
function EdgeBreakdown({ path, dist }) {
  if (!path || path.length <= 1 || !dist) return null

  const edges = []
  let totalCost = 0
  for (let i = 0; i < path.length - 1; i++) {
    const u = path[i], v = path[i + 1]
    const cost = dist[u][v]
    totalCost += cost
    edges.push({ from: u, to: v, cost })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {edges.map((e, i) => {
        const pct = totalCost > 0 ? (e.cost / totalCost * 100) : 0
        return (
          <div key={i} className="edge-row" style={{ animationDelay: `${i * 0.06}s` }}>
            <div style={{ width: 28, color: 'rgba(100,116,139,1)', fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
              #{i + 1}
            </div>
            <div style={{ flex: '0 0 90px', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '0.82rem', color: '#93c5fd' }}>
              {cityLabel(e.from)} → {cityLabel(e.to)}
            </div>
            <div style={{ flex: 1, padding: '0 12px' }}>
              <div className="edge-bar" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ flex: '0 0 50px', textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', color: 'white' }}>
              {e.cost}
            </div>
            <div style={{ flex: '0 0 45px', textAlign: 'right', color: 'rgba(148,163,184,0.5)', fontSize: '0.7rem' }}>
              {pct.toFixed(0)}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP 3 — SINGLE RESULT
// ═══════════════════════════════════════════════════════════════════════════════
function ResultsSection({ results, n, dist, algoName }) {
  const routeStr = results.path.map(cityLabel).join(' → ')
  const animCost = useAnimatedCounter(results.cost, 1000)
  const animTime = useAnimatedCounter(results.executionTime, 800, 3)

  return (
    <div style={{ width: '100%', marginTop: 32, animation: 'fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="icon-glow" style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: '1.25rem' }}>
            Results — <span className="gradient-text">{algoName}</span>
          </div>
          <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.75rem', marginTop: 2 }}>Optimal solution computed</div>
        </div>
        {results.isApproximate && (
          <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
            Approximation · {results.approximationRatio}
          </span>
        )}
      </div>

      {/* Metric Verification Banner */}
      {results.metricCheck && (
        <div className="glass-card animate-fade-in" style={{
          padding: '14px 18px',
          borderRadius: 14,
          marginBottom: 20,
          borderLeft: results.metricCheck.isMetric ? '3px solid #10b981' : '3px solid #f59e0b',
          background: results.metricCheck.isMetric ? 'rgba(16,185,129,0.03)' : 'rgba(245,158,11,0.03)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <span style={{ fontSize: '1.2rem', color: results.metricCheck.isMetric ? '#10b981' : '#f59e0b', lineHeight: 1 }}>
            {results.metricCheck.isMetric ? '✓' : '⚠'}
          </span>
          <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: results.metricCheck.isMetric ? '#34d399' : '#f59e0b' }}>
              {results.metricCheck.isMetric ? 'Metric TSP Network Verified' : 'Non-Metric Network Detected'}
            </span>
            <span style={{ color: 'rgba(148,163,184,0.7)', marginLeft: 8 }}>
              {results.metricCheck.isMetric 
                ? 'The triangle inequality d(A,C) ≤ d(A,B) + d(B,C) holds across all cities. Christofides 1.5× approximation is guaranteed.' 
                : `${results.metricCheck.reason}. The Christofides 1.5× approximation ratio limit may not hold.`}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
        {/* Left: metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Route */}
          <div className="glass-card stat-card" style={{ padding: '22px 24px' }}>
            <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Optimal Route</div>
            <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.6, fontFamily: "'Space Grotesk',sans-serif", wordBreak: 'break-word' }}>{routeStr}</div>
          </div>

          {/* Cost + Time (animated) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="glass-card stat-card" style={{ padding: '20px 18px' }}>
              <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Total Cost</div>
              <div className="gradient-text counter-value animate-count-up" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{animCost}</div>
              <div style={{ color: 'rgba(71,85,105,1)', fontSize: '0.7rem', marginTop: 4 }}>units</div>
            </div>
            <div className="glass-card stat-card" style={{ padding: '20px 18px' }}>
              <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Exec. Time</div>
              <div className="gradient-text counter-value animate-count-up" style={{ fontSize: '1.8rem', lineHeight: 1 }}>{animTime}</div>
              <div style={{ color: 'rgba(71,85,105,1)', fontSize: '0.7rem', marginTop: 4 }}>ms</div>
            </div>
          </div>

          {/* Complexity */}
          <div className="glass-card" style={{ padding: '22px 24px' }}>
            <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Complexity Analysis</div>
            {[
              { label: 'Time Complexity', val: results.timeComplexity },
              { label: 'Space Complexity', val: results.spaceComplexity },
              ...(results.isApproximate ? [{ label: 'Approx. Ratio', val: results.approximationRatio }] : []),
            ].map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: 'rgba(100,116,139,1)', fontSize: '0.8rem' }}>{c.label}</span>
                <code style={{
                  color: '#93c5fd', fontSize: '0.78rem', fontWeight: 700,
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  padding: '3px 10px', borderRadius: 8,
                }}>{c.val}</code>
              </div>
            ))}
          </div>

          {/* Edge Breakdown */}
          <div className="glass-card" style={{ padding: '22px 24px' }}>
            <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Route Breakdown</div>
            <EdgeBreakdown path={results.path} dist={dist} />
          </div>
        </div>

        {/* Right: graph */}
        <div className="glass-card" style={{ padding: '22px 24px' }}>
          <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Route Graph Visualization</div>
          <GraphViz n={n} path={results.path} dist={dist} key={`graph-${results.path.join('-')}-${results.executionTime}`} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14 }}>
            {[
              { color: '#f59e0b', label: 'Start city' },
              { color: '#3b82f6', label: 'Route city' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                <span style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 2, background: '#3b82f6', borderRadius: 1 }} />
              <span style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem' }}>Optimal edge</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPARISON RESULTS (Run All)
// ═══════════════════════════════════════════════════════════════════════════════
function ComparisonResults({ allResults, n, dist }) {
  if (!allResults || allResults.length === 0) return null

  // Find winner (lowest cost, then fastest time)
  const winner = allResults.reduce((best, r) => {
    if (r.cost < best.cost) return r
    if (r.cost === best.cost && r.executionTime < best.executionTime) return r
    return best
  }, allResults[0])

  const accents = { 'Branch & Bound': '#10b981', 'Held-Karp': '#3b82f6', 'Christofides': '#8b5cf6' }

  return (
    <div style={{ width: '100%', marginTop: 32, animation: 'fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="icon-glow" style={{ width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: '1.25rem' }}>
            Algorithm <span className="gradient-text">Comparison</span>
          </div>
          <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.75rem', marginTop: 2 }}>All three algorithms solved — side-by-side results</div>
        </div>
      </div>

      {/* Metric Verification Banner */}
      {allResults[0]?.metricCheck && (
        <div className="glass-card animate-fade-in" style={{
          padding: '14px 18px',
          borderRadius: 14,
          marginBottom: 20,
          borderLeft: allResults[0].metricCheck.isMetric ? '3px solid #10b981' : '3px solid #f59e0b',
          background: allResults[0].metricCheck.isMetric ? 'rgba(16,185,129,0.03)' : 'rgba(245,158,11,0.03)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12
        }}>
          <span style={{ fontSize: '1.2rem', color: allResults[0].metricCheck.isMetric ? '#10b981' : '#f59e0b', lineHeight: 1 }}>
            {allResults[0].metricCheck.isMetric ? '✓' : '⚠'}
          </span>
          <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: allResults[0].metricCheck.isMetric ? '#34d399' : '#f59e0b' }}>
              {allResults[0].metricCheck.isMetric ? 'Metric TSP Network Verified' : 'Non-Metric Network Detected'}
            </span>
            <span style={{ color: 'rgba(148,163,184,0.7)', marginLeft: 8 }}>
              {allResults[0].metricCheck.isMetric 
                ? 'The triangle inequality d(A,C) ≤ d(A,B) + d(B,C) holds across all cities. Christofides 1.5× approximation is guaranteed.' 
                : `${allResults[0].metricCheck.reason}. The Christofides 1.5× approximation ratio limit may not hold.`}
            </span>
          </div>
        </div>
      )}

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        {allResults.map((r, i) => {
          const isWinner = r === winner
          const accent = accents[r.name] || '#3b82f6'
          return (
            <div
              key={r.name}
              className={`glass-card comparison-card ${isWinner ? 'winner-card' : ''}`}
              style={{
                padding: '24px',
                borderColor: isWinner ? 'rgba(16,185,129,0.5)' : undefined,
                animation: `fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) ${i * 0.1}s both`,
              }}
            >
              {isWinner && (
                <div className="winner-badge" style={{ marginBottom: 14 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  BEST RESULT
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${accent}20`, border: `1px solid ${accent}40`, color: accent,
                  fontWeight: 800, fontSize: '0.75rem', fontFamily: "'Space Grotesk',sans-serif"
                }}>
                  {r.name === 'Branch & Bound' ? 'B&B' : r.name === 'Held-Karp' ? 'HK' : 'CH'}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', fontFamily: "'Space Grotesk',sans-serif" }}>{r.name}</div>
                  <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.68rem' }}>{r.timeComplexity}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Tour Cost</div>
                  <AnimatedValue target={r.cost} style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', fontFamily: "'Space Grotesk',sans-serif" }} />
                </div>
                <div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Time</div>
                  <AnimatedValue target={r.executionTime} decimals={3} style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', fontFamily: "'Space Grotesk',sans-serif" }} suffix=" ms" />
                </div>
              </div>

              <div>
                <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 4 }}>Tour Sequence</div>
                <div style={{ color: accent, fontSize: '0.78rem', fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", wordBreak: 'break-all' }}>
                  {r.path.map(cityLabel).join(' → ')}
                </div>
              </div>

              {r.isApproximate && (
                <div style={{ marginTop: 10, padding: '4px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', fontSize: '0.68rem', display: 'inline-block' }}>
                  Approx · {r.approximationRatio}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Winner's Graph */}
      <div className="glass-card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Best Route Visualization
          </div>
          <span className="winner-badge" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {winner.name}
          </span>
        </div>
        <GraphViz n={n} path={winner.path} dist={dist} key={`graph-comp-${winner.path.join('-')}-${winner.executionTime}`} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14 }}>
          {[
            { color: '#f59e0b', label: 'Start city' },
            { color: '#3b82f6', label: 'Route city' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
              <span style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 24, height: 2, background: '#3b82f6', borderRadius: 1 }} />
            <span style={{ color: 'rgba(71,85,105,1)', fontSize: '0.72rem' }}>Optimal edge</span>
          </div>
        </div>
      </div>

      {/* Edge Breakdown for winner */}
      <div className="glass-card" style={{ padding: '22px 24px', marginTop: 18 }}>
        <div style={{ color: 'rgba(100,116,139,1)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
          Best Route — Edge Breakdown
        </div>
        <EdgeBreakdown path={winner.path} dist={dist} />
      </div>
    </div>
  )
}

// Helper: Animated value display
function AnimatedValue({ target, decimals = 0, style = {}, suffix = '' }) {
  const val = useAnimatedCounter(target, 900, decimals)
  return <div style={style}>{val}{suffix}</div>
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState('visualizer')
  const [step, setStep] = useState('config')
  const [numCities, setNumCities] = useState(4)
  const [inputMethod, setInputMethod] = useState('manual')
  const [matrix, setMatrix] = useState([])
  const [results, setResults] = useState(null)
  const [allResults, setAllResults] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [algoName, setAlgoName] = useState('')
  const resultsRef = useRef(null)

  // Compute visual step for stepper
  const visualStep = results || allResults ? 'results' : step

  const handleContinue = useCallback((n, method) => {
    setNumCities(n); setInputMethod(method); setResults(null); setAllResults(null)
    const m = method === 'random'
      ? generateRandomMatrix(n)
      : Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 0 : 0))
    setMatrix(m); setStep('matrix')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleBack = useCallback(() => { setStep('config'); setResults(null); setAllResults(null); setMatrix([]) }, [])

  const handleSolve = useCallback((algoId) => {
    const names = { bb: 'Branch & Bound', hk: 'Held-Karp', ch: 'Christofides' }
    setAlgoName(names[algoId]); setIsRunning(true); setResults(null); setAllResults(null)
    setTimeout(() => {
      try {
        const fn = { bb: runBranchAndBound, hk: runHeldKarp, ch: runChristofides }[algoId]
        const res = fn(matrix)
        if (res.error) { alert(res.error) }
        else {
          setResults(res)
          setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
        }
      } catch (e) { alert('Algorithm error: ' + e.message) }
      finally { setIsRunning(false) }
    }, 60)
  }, [matrix])

  const handleSolveAll = useCallback(() => {
    setIsRunning(true); setResults(null); setAllResults(null)
    setTimeout(() => {
      try {
        const algos = [
          { fn: runBranchAndBound, name: 'Branch & Bound' },
          { fn: runHeldKarp, name: 'Held-Karp' },
          { fn: runChristofides, name: 'Christofides' },
        ]
        const results = algos.map(a => {
          const res = a.fn(matrix)
          return { ...res, name: a.name }
        }).filter(r => !r.error)
        if (results.length === 0) { alert('No valid tour found.'); return }
        setAllResults(results)
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      } catch (e) { alert('Algorithm error: ' + e.message) }
      finally { setIsRunning(false) }
    }, 60)
  }, [matrix])

  return (
    <div style={{ position: 'relative', minHeight: '100vh', background: '#030712' }}>
      {/* Ambient glow orbs */}
      <div className="glow-orb-1" />
      <div className="glow-orb-2" />
      <div className="glow-orb-3" />
      <ParticleCanvas />

      {/* Actual UI */}
      <div style={{ position: 'relative', zIndex: 10 }}>
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Page content */}
        <div className="grid-bg" style={{ minHeight: '100vh', paddingTop: '6.5rem', paddingBottom: '5rem' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px' }}>

            {/* ── Hero title ─────────────────── */}
            <div style={{ textAlign: 'center', marginBottom: activeTab === 'visualizer' ? '2rem' : '2rem', transition: 'all 0.3s' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}
                className="glass-card">
                <div style={{ padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 20 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#60a5fa', boxShadow: '0 0 8px #60a5fa', flexShrink: 0 }} />
                  <span style={{ color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Design &amp; Analysis of Algorithms
                  </span>
                </div>
              </div>

              <h1 style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: activeTab === 'visualizer' ? 'clamp(2.4rem, 6vw, 4.5rem)' : 'clamp(2rem, 4vw, 3rem)',
                fontWeight: 900,
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                marginBottom: activeTab === 'visualizer' ? '1.25rem' : '0.5rem',
                transition: 'all 0.3s'
              }}>
                <span style={{ color: 'white', textShadow: '0 0 80px rgba(96,165,250,0.45)' }}>Minimum Cost</span>
                <br />
                <span className="gradient-text">Tour Finder</span>
              </h1>

              {activeTab === 'visualizer' && (
                <>
                  <p style={{ color: 'rgba(100,116,139,1)', fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
                    Solve the{' '}
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>Travelling Salesman Problem</span>
                    {' '}using exact and approximation algorithms with real-time route visualization.
                  </p>
                  {/* Hero stat chips */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
                    <div className="hero-chip">
                      <span className="chip-dot" style={{ background: '#10b981' }} />
                      3 Algorithms
                    </div>
                    <div className="hero-chip">
                      <span className="chip-dot" style={{ background: '#3b82f6' }} />
                      Up to 10 Cities
                    </div>
                    <div className="hero-chip">
                      <span className="chip-dot" style={{ background: '#8b5cf6' }} />
                      Real-time Viz
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── Step separator ──────────────────────────────────────── */}
            <div className="glow-separator" style={{ marginBottom: '1.5rem' }} />

            {/* ── Stepper (only on visualizer tab) ──── */}
            {activeTab === 'visualizer' && (
              <Stepper currentStep={visualStep} />
            )}

            {/* ── Tab Views ─────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {activeTab === 'visualizer' && (
                <>
                  {step === 'config' && (
                    <ConfigStep onContinue={handleContinue} />
                  )}

                  {(step === 'matrix' || step === 'done') && (
                    <MatrixStep
                      n={numCities}
                      inputMethod={inputMethod}
                      matrix={matrix}
                      onMatrixChange={setMatrix}
                      onBack={handleBack}
                      onSolve={handleSolve}
                      onSolveAll={handleSolveAll}
                      isRunning={isRunning}
                    />
                  )}

                  {results && (
                    <div ref={resultsRef} style={{ width: '100%' }}>
                      <div className="glow-separator" style={{ margin: '2.5rem 0' }} />
                      <ResultsSection results={results} n={numCities} dist={matrix} algoName={algoName} />
                    </div>
                  )}

                  {allResults && (
                    <div ref={resultsRef} style={{ width: '100%' }}>
                      <div className="glow-separator" style={{ margin: '2.5rem 0' }} />
                      <ComparisonResults allResults={allResults} n={numCities} dist={matrix} />
                    </div>
                  )}
                </>
              )}

              {activeTab === 'canvas-map' && (
                <CanvasMap />
              )}

              {activeTab === 'benchmarks' && (
                <BenchmarksTab />
              )}

              {activeTab === 'algorithms-info' && (
                <AlgorithmsInfo />
              )}

              {activeTab === 'team' && (
                <TeamTab />
              )}
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: '5rem' }}>
              <div className="glow-separator" style={{ marginBottom: '1.5rem' }} />
              <p style={{ color: 'rgba(51,65,85,1)', fontSize: '0.75rem' }}>
                Minimum Cost Tour Finder · DAA Academic Project 2026 · B.Tech Computer Science
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
