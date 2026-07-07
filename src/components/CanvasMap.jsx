import { useState, useRef, useCallback, useMemo } from 'react'
import { runHeldKarp, runBranchAndBound, runChristofides, cityLabel } from '../algorithms'

export default function CanvasMap() {
  const [cities, setCities] = useState([
    { id: 0, x: 100, y: 250, label: 'A' },
    { id: 1, x: 220, y: 120, label: 'B' },
    { id: 2, x: 480, y: 160, label: 'C' },
    { id: 3, x: 340, y: 320, label: 'D' },
  ])
  const [draggingId, setDraggingId] = useState(null)
  const [selectedAlgo, setSelectedAlgo] = useState('bb')
  const [results, setResults] = useState(null)
  const [allResults, setAllResults] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [copied, setCopied] = useState(false)
  const [replayStep, setReplayStep] = useState(-1)
  const [isReplaying, setIsReplaying] = useState(false)
  
  // Custom coordinate input states
  const [customX, setCustomX] = useState('')
  const [customY, setCustomY] = useState('')
  const [inputErr, setInputErr] = useState('')

  // Custom start city/origin state
  const [startNodeIndex, setStartNodeIndex] = useState(0)

  const replayTimer = useRef(null)
  const svgRef = useRef(null)

  // Recalculate Euclidean distance matrix whenever cities change via memoization
  const matrix = useMemo(() => {
    const n = cities.length
    const m = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          m[i][j] = 0
        } else {
          const dx = cities[i].x - cities[j].x
          const dy = cities[i].y - cities[j].y
          m[i][j] = Math.round(Math.sqrt(dx * dx + dy * dy))
        }
      }
    }
    return m
  }, [cities])

  // Helper: Cyclic-shift the path to start and end at the chosen origin city
  const adjustPathToStart = useCallback((path, startIdx) => {
    if (!path || path.length <= 1) return path
    // path is like [0, 2, 1, 3, 0]. The last element is identical to the first.
    const cycle = path.slice(0, -1) // [0, 2, 1, 3]
    const pos = cycle.indexOf(startIdx)
    if (pos === -1) return path // fallback
    const shifted = [...cycle.slice(pos), ...cycle.slice(0, pos)]
    return [...shifted, startIdx]
  }, [])

  const handleSvgClick = (e) => {
    if (e.target.tagName !== 'svg' && e.target.id !== 'svg-bg') return
    if (cities.length >= 12) {
      alert('Maximum of 12 cities allowed for stability.')
      return
    }

    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 600)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 400)

    const nextId = cities.length > 0 ? Math.max(...cities.map(c => c.id)) + 1 : 0
    const newCity = {
      id: nextId,
      x: Math.max(20, Math.min(580, x)),
      y: Math.max(20, Math.min(380, y)),
      label: cityLabel(cities.length),
    }

    setCities([...cities, newCity])
    setResults(null)
    setAllResults(null)
  }

  const handleAddCustomNode = () => {
    setInputErr('')
    const px = parseInt(customX, 10)
    const py = parseInt(customY, 10)

    if (isNaN(px) || px < 20 || px > 580) {
      setInputErr('X coordinate must be an integer between 20 and 580.')
      return
    }
    if (isNaN(py) || py < 20 || py > 380) {
      setInputErr('Y coordinate must be an integer between 20 and 380.')
      return
    }
    if (cities.length >= 12) {
      setInputErr('Maximum of 12 cities allowed for stability.')
      return
    }

    const nextId = cities.length > 0 ? Math.max(...cities.map(c => c.id)) + 1 : 0
    const newCity = {
      id: nextId,
      x: px,
      y: py,
      label: cityLabel(cities.length),
    }

    setCities([...cities, newCity])
    setCustomX('')
    setCustomY('')
    setResults(null)
    setAllResults(null)
  }

  const handleNodeRemove = (id) => {
    const updatedCities = cities.filter(c => c.id !== id).map((c, index) => ({
      ...c,
      label: cityLabel(index),
    }))
    setCities(updatedCities)
    setResults(null)
    setAllResults(null)
    // Adjust startNodeIndex if it is out of bounds now
    setStartNodeIndex(prev => Math.min(prev, Math.max(0, updatedCities.length - 1)))
  }

  const handlePointerDown = (id, e) => {
    e.stopPropagation()
    setDraggingId(id)
  }

  const handlePointerMove = useCallback((e) => {
    if (draggingId === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    
    const clientX = e.clientX || (e.touches && e.touches[0].clientX)
    const clientY = e.clientY || (e.touches && e.touches[0].clientY)

    if (clientX === undefined || clientY === undefined) return

    const x = Math.round(((clientX - rect.left) / rect.width) * 600)
    const y = Math.round(((clientY - rect.top) / rect.height) * 400)

    const clampedX = Math.max(20, Math.min(580, x))
    const clampedY = Math.max(20, Math.min(380, y))

    setCities(prev => prev.map(c => c.id === draggingId ? { ...c, x: clampedX, y: clampedY } : c))
    setResults(null)
    setAllResults(null)
  }, [draggingId])

  const handlePointerUp = () => {
    setDraggingId(null)
  }

  const handleMouseMoveFeedback = (e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 600)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 400)
    setHoverPos({ x: Math.max(0, Math.min(600, x)), y: Math.max(0, Math.min(400, y)) })

    // Check edge hover
    if (results?.path) {
      const path = results.path
      for (let idx = 0; idx < path.length - 1; idx++) {
        const fromCity = cities[path[idx]]
        const toCity = cities[path[idx + 1]]
        if (!fromCity || !toCity) continue
        const dist = distToSegment(
          { x: Math.max(0, Math.min(600, x)), y: Math.max(0, Math.min(400, y)) },
          fromCity, toCity
        )
        if (dist < 15) {
          setHoveredEdge({ idx, from: path[idx], to: path[idx + 1], dist: matrix[path[idx]][path[idx + 1]] })
          return
        }
      }
    }
    setHoveredEdge(null)
  }

  // Point-to-segment distance
  function distToSegment(p, v, w) {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2
    if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2)
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
    t = Math.max(0, Math.min(1, t))
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }
    return Math.sqrt((p.x - proj.x) ** 2 + (p.y - proj.y) ** 2)
  }

  const generateRandomLayout = (num) => {
    const arr = []
    const w = 600
    const h = 400
    const pad = 40
    for (let i = 0; i < num; i++) {
      let x, y, tooClose
      let attempts = 0
      do {
        x = Math.floor(Math.random() * (w - 2 * pad)) + pad
        y = Math.floor(Math.random() * (h - 2 * pad)) + pad
        tooClose = arr.some(c => Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2) < 45)
        attempts++
      } while (tooClose && attempts < 100)

      arr.push({
        id: i,
        x,
        y,
        label: cityLabel(i),
      })
    }
    setCities(arr)
    setResults(null)
    setAllResults(null)
    setStartNodeIndex(0)
  }

  const solveTSP = () => {
    if (cities.length < 2) {
      alert('Please place at least 2 cities.')
      return
    }
    setIsRunning(true)
    setResults(null)
    setAllResults(null)
    setReplayStep(-1)

    const algoFn = { bb: runBranchAndBound, hk: runHeldKarp, ch: runChristofides }[selectedAlgo]

    setTimeout(() => {
      try {
        const res = algoFn(matrix)
        if (res.error) {
          alert(res.error)
        } else {
          // Adjust path to start at selected startNodeIndex
          res.path = adjustPathToStart(res.path, startNodeIndex)
          setResults(res)
        }
      } catch (e) {
        alert('Solving error: ' + e.message)
      } finally {
        setIsRunning(false)
      }
    }, 150)
  }

  const solveAll = () => {
    if (cities.length < 2) {
      alert('Please place at least 2 cities.')
      return
    }
    setIsRunning(true)
    setResults(null)
    setAllResults(null)
    setReplayStep(-1)

    setTimeout(() => {
      try {
        const algos = [
          { fn: runBranchAndBound, name: 'Branch & Bound', accent: '#10b981' },
          { fn: runHeldKarp, name: 'Held-Karp', accent: '#3b82f6' },
          { fn: runChristofides, name: 'Christofides', accent: '#8b5cf6' },
        ]
        const res = algos.map(a => {
          const r = a.fn(matrix)
          const adjustedPath = adjustPathToStart(r.path, startNodeIndex)
          return { ...r, path: adjustedPath, name: a.name, accent: a.accent }
        }).filter(r => !r.error)

        if (res.length === 0) { alert('No valid tour found.'); return }
        
        // Pick winner as the primary result
        const winner = res.reduce((best, r) => r.cost < best.cost ? r : best, res[0])
        setResults(winner)
        setAllResults(res)
      } catch (e) {
        alert('Solving error: ' + e.message)
      } finally {
        setIsRunning(false)
      }
    }, 150)
  }

  // Replay controls
  const startReplay = () => {
    if (!results?.path) return
    setReplayStep(0)
    setIsReplaying(true)
    let step = 0
    const totalEdges = results.path.length - 1
    if (replayTimer.current) clearInterval(replayTimer.current)
    replayTimer.current = setInterval(() => {
      step++
      if (step >= totalEdges) {
        setReplayStep(totalEdges)
        setIsReplaying(false)
        clearInterval(replayTimer.current)
      } else {
        setReplayStep(step)
      }
    }, 600)
  }

  const stepForward = () => {
    if (!results?.path) return
    const totalEdges = results.path.length - 1
    setReplayStep(prev => Math.min(prev + 1, totalEdges))
  }

  const stepBack = () => {
    setReplayStep(prev => Math.max(prev - 1, 0))
  }

  const resetReplay = () => {
    setReplayStep(-1)
    setIsReplaying(false)
    if (replayTimer.current) clearInterval(replayTimer.current)
  }

  // Export
  const exportResults = () => {
    if (!results) return
    const displayResults = allResults || [results]
    const lines = ['=== TSP Solver Results ===', '']
    displayResults.forEach(r => {
      lines.push(`Algorithm: ${r.name || 'Single'}`)
      lines.push(`Tour: ${r.path.map(idx => cities[idx]?.label || cityLabel(idx)).join(' → ')}`)
      lines.push(`Cost: ${r.cost} px`)
      lines.push(`Time: ${r.executionTime.toFixed(3)} ms`)
      lines.push('')
    })
    navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Determine which edges to show based on replay
  const visibleEdges = replayStep >= 0 ? replayStep : (results ? results.path.length - 1 : 0)

  return (
    <div style={{ width: '100%', animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
      
      {/* Upper toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.25rem' }}>Interactive 2D Workspace</h2>
          <p style={{ color: 'rgba(100,116,139,1)', fontSize: '0.75rem', marginTop: 2 }}>Click canvas to add cities, drag to move, double-click to remove</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => generateRandomLayout(6)} className="btn-outline" style={{ padding: '8px 14px', borderRadius: 10, fontSize: '0.8rem', cursor: 'pointer' }}>
            Random (6)
          </button>
          <button onClick={() => generateRandomLayout(10)} className="btn-outline" style={{ padding: '8px 14px', borderRadius: 10, fontSize: '0.8rem', cursor: 'pointer' }}>
            Random (10)
          </button>
          <button onClick={() => { setCities([]); setResults(null); setAllResults(null); setStartNodeIndex(0) }} className="btn-outline" style={{ padding: '8px 14px', borderRadius: 10, fontSize: '0.8rem', cursor: 'pointer', borderColor: 'rgba(239,68,68,0.2)', color: '#f87171' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', lgGridTemplateColumns: '7fr 5fr', gap: 24 }} className="canvas-grid-container">
        
        {/* Left column: SVG workspace */}
        <div className="glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            background: 'rgba(15,23,42,0.8)', padding: '5px 10px', borderRadius: 8,
            fontSize: '0.72rem', color: 'rgba(148,163,184,0.8)', border: '1px solid rgba(255,255,255,0.05)',
            fontFamily: 'monospace'
          }}>
            X: {isHovering ? hoverPos.x : '—'} Y: {isHovering ? hoverPos.y : '—'} | N: {cities.length}
          </div>

          {/* Edge hover tooltip */}
          {hoveredEdge && isHovering && (
            <div style={{
              position: 'absolute',
              left: `${(hoverPos.x / 600) * 100}%`,
              top: `${(hoverPos.y / 400) * 100}%`,
              transform: 'translate(-50%, -140%)',
              background: 'rgba(15,23,42,0.95)',
              border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: 8,
              padding: '6px 12px',
              zIndex: 20,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              animation: 'tooltipIn 0.2s ease both',
            }}>
              <span style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.75rem' }}>
                {cities[hoveredEdge.from]?.label} → {cities[hoveredEdge.to]?.label}
              </span>
              <span style={{ color: 'white', fontWeight: 800, fontSize: '0.8rem', marginLeft: 8 }}>
                {hoveredEdge.dist} px
              </span>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox="0 0 600 400"
            onClick={handleSvgClick}
            onPointerMove={draggingId !== null ? handlePointerMove : undefined}
            onPointerUp={draggingId !== null ? handlePointerUp : undefined}
            onPointerLeave={draggingId !== null ? handlePointerUp : undefined}
            onMouseMove={handleMouseMoveFeedback}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => { setIsHovering(false); setHoveredEdge(null) }}
            style={{
              width: '100%',
              aspectRatio: '600/400',
              borderRadius: 14,
              background: '#070a13',
              backgroundImage: 'radial-gradient(rgba(59,130,246,0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              border: '1px solid rgba(59,130,246,0.1)',
              cursor: draggingId !== null ? 'grabbing' : 'crosshair',
              touchAction: 'none'
            }}
          >
            {/* Background click target */}
            <rect id="svg-bg" width="600" height="400" fill="transparent" />

            {/* Grid coordinate axes labels */}
            <text x="15" y="20" fill="rgba(71,85,105,0.5)" fontSize="9" fontFamily="monospace">0,0</text>
            <text x="560" y="390" fill="rgba(71,85,105,0.5)" fontSize="9" fontFamily="monospace">600,400</text>

            {/* Drawn edges */}
            {results === null ? (
              // All pairs connections - faint dotted lines
              cities.map((c1, i) => 
                cities.map((c2, j) => {
                  if (i >= j) return null
                  return (
                    <line
                      key={`${c1.id}-${c2.id}`}
                      x1={c1.x} y1={c1.y}
                      x2={c2.x} y2={c2.y}
                      stroke="rgba(96,165,250,0.04)"
                      strokeWidth="1"
                    />
                  )
                })
              )
            ) : (
              // Solved path rendering
              results.path.map((cityIndex, idx) => {
                if (idx === results.path.length - 1) return null
                if (idx >= visibleEdges) return null
                const nextCityIndex = results.path[idx + 1]
                const fromCity = cities[cityIndex]
                const toCity = cities[nextCityIndex]
                if (!fromCity || !toCity) return null

                const length = Math.sqrt((fromCity.x - toCity.x) ** 2 + (fromCity.y - toCity.y) ** 2)
                const isHovered = hoveredEdge?.idx === idx

                return (
                  <g key={`route-edge-${idx}`}>
                    {/* Glow outline */}
                    <line
                      x1={fromCity.x} y1={fromCity.y}
                      x2={toCity.x} y2={toCity.y}
                      stroke="#3b82f6"
                      strokeWidth={isHovered ? 10 : 6}
                      strokeOpacity={isHovered ? 0.25 : 0.15}
                      strokeLinecap="round"
                    />
                    {/* Main Line with dash array draw animation */}
                    <line
                      x1={fromCity.x} y1={fromCity.y}
                      x2={toCity.x} y2={toCity.y}
                      stroke="url(#pathGradient)"
                      strokeWidth={isHovered ? 5 : 3.5}
                      strokeLinecap="round"
                      strokeDasharray={replayStep >= 0 ? 'none' : length}
                      strokeDashoffset={replayStep >= 0 ? 0 : length}
                      style={replayStep >= 0 ? {} : {
                        animation: 'drawRouteLine 0.5s ease-out forwards',
                        animationDelay: `${idx * 0.15}s`
                      }}
                    />
                    {/* Distance label on edge */}
                    {(() => {
                      const mx = (fromCity.x + toCity.x) / 2
                      const my = (fromCity.y + toCity.y) / 2
                      const angle = Math.atan2(toCity.y - fromCity.y, toCity.x - fromCity.x)
                      const nx = -Math.sin(angle) * 14
                      const ny = Math.cos(angle) * 14
                      return (
                        <g>
                          <rect
                            x={mx + nx - 16} y={my + ny - 9}
                            width="32" height="18" rx="5"
                            fill="rgba(15,23,42,0.85)"
                            stroke="rgba(96,165,250,0.2)"
                            strokeWidth="0.5"
                          />
                          <text
                            x={mx + nx} y={my + ny + 1}
                            textAnchor="middle" dominantBaseline="middle"
                            fill="rgba(147,197,253,0.9)"
                            fontSize="9" fontWeight="700" fontFamily="Inter,sans-serif"
                          >
                            {matrix[cityIndex]?.[nextCityIndex]}
                          </text>
                        </g>
                      )
                    })()}
                    {/* Moving pulse dot */}
                    {replayStep < 0 && (
                      <circle
                        r="4"
                        fill="#60a5fa"
                        style={{
                          offsetPath: `path('M ${fromCity.x} ${fromCity.y} L ${toCity.x} ${toCity.y}')`,
                          animation: 'offsetPulse 1.8s linear infinite',
                          animationDelay: `${idx * 0.15}s`,
                        }}
                      />
                    )}
                  </g>
                )
              })
            )}

            {/* Gradient definitions */}
            <defs>
              <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>

            {/* Render node circles */}
            {cities.map((city, index) => {
              const isDragging = draggingId === city.id
              const isStart = index === startNodeIndex
              const isInPath = results?.path.includes(index)

              return (
                <g
                  key={city.id}
                  transform={`translate(${city.x}, ${city.y})`}
                  onPointerDown={(e) => handlePointerDown(city.id, e)}
                  onDoubleClick={() => handleNodeRemove(city.id)}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  {/* Outer shadow glow ring */}
                  <circle
                    r="22"
                    fill={isStart ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)'}
                    stroke={isStart ? 'rgba(245,158,11,0.2)' : 'rgba(96,165,250,0.1)'}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  {/* Node solid circle */}
                  <circle
                    r="15"
                    fill={isStart ? '#78350f' : isInPath ? '#1e3a8a' : '#0f172a'}
                    stroke={isStart ? '#f59e0b' : '#3b82f6'}
                    strokeWidth={isDragging ? '3.5' : '2'}
                    style={{ transition: 'fill 0.3s, stroke 0.3s, stroke-width 0.1s' }}
                  />
                  {/* Label */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="Inter,sans-serif"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {city.label}
                  </text>
                  {/* Small sub-coordinate text */}
                  <text
                    y="27"
                    textAnchor="middle"
                    fill="rgba(148,163,184,0.4)"
                    fontSize="8"
                    fontFamily="monospace"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    ({city.x},{city.y})
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Replay Controls */}
          {results && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px 0', marginTop: 8,
            }}>
              <button onClick={resetReplay} className="btn-ghost" title="Reset">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 019-9 9 9 0 016.35 2.65" strokeLinecap="round"/><polyline points="21 3 21 8 16 8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={stepBack} className="btn-ghost" title="Step Back" disabled={replayStep <= 0}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={startReplay} className="btn-ghost" title="Play Replay" style={{ padding: '6px 16px' }}>
                {isReplaying ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                )}
                <span style={{ fontSize: '0.72rem' }}>Replay</span>
              </button>
              <button onClick={stepForward} className="btn-ghost" title="Step Forward" disabled={replayStep >= (results.path.length - 1)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.06)', margin: '0 4px' }} />
              <button onClick={exportResults} className={`btn-ghost ${copied ? 'copied' : ''}`} title="Copy results">
                {copied ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Export</>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right column: Config, Solve & Matrix list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Controls box */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>Solving Engine</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              {/* Custom Coordinate Node Adder Form */}
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 16 }}>
                <label style={{ display: 'block', color: 'rgba(148,163,184,0.6)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Add City Node
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    value={customX}
                    onChange={e => setCustomX(e.target.value)}
                    placeholder="X (20-580)"
                    className="hero-input"
                    style={{ flex: 1, borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', textAlign: 'center' }}
                  />
                  <input
                    type="number"
                    value={customY}
                    onChange={e => setCustomY(e.target.value)}
                    placeholder="Y (20-380)"
                    className="hero-input"
                    style={{ flex: 1, borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', textAlign: 'center' }}
                  />
                  <button
                    onClick={handleAddCustomNode}
                    className="btn-outline"
                    style={{ borderRadius: 8, padding: '8px 14px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', height: 34 }}
                  >
                    Add
                  </button>
                </div>
                {inputErr && (
                  <div style={{ color: '#f87171', fontSize: '0.68rem', marginTop: 6, fontWeight: 500 }}>
                    ⚠ {inputErr}
                  </div>
                )}
              </div>

              {/* Start/Origin City Selector Dropdown */}
              <div>
                <label style={{ display: 'block', color: 'rgba(148,163,184,0.6)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Select Start City (Origin)
                </label>
                <select
                  value={startNodeIndex}
                  onChange={e => {
                    const newStartIdx = parseInt(e.target.value, 10)
                    setStartNodeIndex(newStartIdx)
                    // If results are active, cyclic shift them immediately to make the UI response snappy
                    if (results) {
                      setResults(prev => ({
                        ...prev,
                        path: adjustPathToStart(prev.path, newStartIdx)
                      }))
                    }
                    if (allResults) {
                      setAllResults(prev => prev.map(r => ({
                        ...r,
                        path: adjustPathToStart(r.path, newStartIdx)
                      })))
                    }
                  }}
                  className="hero-input"
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white',
                    outline: 'none',
                  }}
                  disabled={cities.length === 0}
                >
                  {cities.length === 0 ? (
                    <option value="0">No cities placed</option>
                  ) : (
                    cities.map((c, idx) => (
                      <option key={c.id} value={idx} style={{ background: '#0a0f1d', color: 'white' }}>
                        City {c.label} ({c.x}, {c.y}) {idx === 0 ? ' (Default)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', color: 'rgba(148,163,184,0.6)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Select Algorithm
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { id: 'bb', label: 'B&B', name: 'Branch & Bound' },
                    { id: 'hk', label: 'H-K', name: 'Held-Karp (Exact DP)' },
                    { id: 'ch', label: 'Chris', name: 'Christofides (Approx)' },
                  ].map(a => {
                    const sel = selectedAlgo === a.id
                    return (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAlgo(a.id); setResults(null); setAllResults(null) }}
                        title={a.name}
                        style={{
                          padding: '10px 4px',
                          borderRadius: 8,
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.25s',
                          border: sel ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.06)',
                          background: sel ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                          color: sel ? '#60a5fa' : 'rgba(148,163,184,0.6)',
                        }}
                      >
                        {a.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={solveTSP}
                disabled={isRunning || cities.length < 2}
                className="btn-primary"
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, color: 'white', fontWeight: 800, fontSize: '0.88rem',
                  cursor: (isRunning || cities.length < 2) ? 'not-allowed' : 'pointer', opacity: (isRunning || cities.length < 2) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeOpacity="0.3"/>
                      <path d="M21 12a9 9 0 01-9-9" strokeLinecap="round"/>
                    </svg>
                    Computing...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                    Run Solver
                  </>
                )}
              </button>

              <button
                onClick={solveAll}
                disabled={isRunning || cities.length < 2}
                className="btn-emerald"
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, color: 'white', fontWeight: 800, fontSize: '0.88rem',
                  cursor: (isRunning || cities.length < 2) ? 'not-allowed' : 'pointer', opacity: (isRunning || cities.length < 2) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
                Run All & Compare
              </button>
            </div>
          </div>

          {/* Results Summary Box */}
          {results && !allResults && (
            <div className="glass-card animate-fade-in" style={{ padding: 24, borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.03)' }}>
              <h4 style={{ color: '#60a5fa', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Solver Results</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Tour Cost</div>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>{results.cost} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'rgba(148,163,184,0.5)' }}>px</span></div>
                </div>
                <div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Solve Time</div>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: '1.25rem' }}>{results.executionTime.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'rgba(148,163,184,0.5)' }}>ms</span></div>
                </div>
              </div>

              <div>
                <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: 4 }}>Tour Sequence</div>
                <div style={{ color: '#93c5fd', fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-all', fontFamily: "'Space Grotesk',sans-serif" }}>
                  {results.path.map(idx => cities[idx]?.label).join(' → ')}
                </div>
              </div>
            </div>
          )}

          {/* Comparison Results */}
          {allResults && (
            <div className="glass-card animate-fade-in" style={{ padding: 24, borderLeft: '3px solid #10b981', background: 'rgba(16,185,129,0.03)' }}>
              <h4 style={{ color: '#34d399', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 14 }}>Algorithm Comparison</h4>
              
              {allResults.map((r, i) => {
                const isWinner = r === allResults.reduce((b, x) => x.cost < b.cost ? x : b, allResults[0])
                return (
                  <div key={r.name} style={{
                    padding: '10px 12px', borderRadius: 10, marginBottom: 8,
                    background: isWinner ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)',
                    border: isWinner ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.04)',
                    animation: `fadeUp 0.3s ease ${i * 0.1}s both`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.accent || '#3b82f6' }} />
                        <span style={{ color: 'white', fontSize: '0.78rem', fontWeight: 700 }}>{r.name}</span>
                        {isWinner && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: 8, background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>BEST</span>
                        )}
                      </div>
                      <span style={{ color: 'white', fontWeight: 800, fontSize: '0.9rem' }}>{r.cost} <span style={{ fontSize: '0.65rem', fontWeight: 400, color: 'rgba(148,163,184,0.5)' }}>px</span></span>
                    </div>
                    <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.68rem' }}>
                      {r.executionTime.toFixed(3)} ms · {r.path.map(idx => cities[idx]?.label || '?').join('→')}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Real-time Distance Matrix List */}
          <div className="glass-card" style={{ padding: 24, flexGrow: 1, display: 'flex', flexDirection: 'column', maxHeight: 220 }}>
            <h4 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Euclidean Matrix (px)</h4>
            
            {cities.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'rgba(148,163,184,0.3)', fontSize: '0.8rem' }}>
                Add cities to view distances
              </div>
            ) : (
              <div style={{ overflowX: 'auto', flexGrow: 1 }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 26 }} />
                      {cities.map(c => (
                        <th key={c.id} style={{ color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, textAlign: 'center', minWidth: 32 }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map((cRow, i) => (
                      <tr key={cRow.id}>
                        <td style={{ color: '#60a5fa', fontSize: '0.68rem', fontWeight: 700, textAlign: 'center', paddingRight: 4 }}>{cRow.label}</td>
                        {cities.map((cCol, j) => {
                          const dist = matrix[i]?.[j] || 0
                          const isDiagonal = i === j
                          const inSolvedRoute = results !== null && (
                            results.path.some((val, idx) => {
                              if (idx === results.path.length - 1) return false
                              const nextVal = results.path[idx + 1]
                              return (val === i && nextVal === j) || (val === j && nextVal === i)
                            })
                          )

                          return (
                            <td
                              key={cCol.id}
                              style={{
                                color: isDiagonal ? 'rgba(148,163,184,0.2)' : inSolvedRoute ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                                background: isDiagonal ? 'transparent' : inSolvedRoute ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                                border: inSolvedRoute ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.03)',
                                fontSize: '0.68rem',
                                padding: '4px',
                                textAlign: 'center',
                                borderRadius: 4,
                                minWidth: 32,
                                fontWeight: inSolvedRoute ? '800' : '400',
                                transition: 'all 0.25s'
                              }}
                            >
                              {isDiagonal ? '—' : dist}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
