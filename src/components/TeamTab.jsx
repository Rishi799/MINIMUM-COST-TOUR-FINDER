export default function TeamTab() {
  const members = [
    {
      name: 'Rhea Parthiban',
      roll: '1RV24CI097',
      role: 'Algorithms Developer & Optimizer',
      desc: 'Designed the primary Held-Karp dynamic programming solver, managed memoization tables, and developed optimizations to handle larger node configurations.',
      initials: 'RP',
      color: '#3b82f6',
    },
    {
      name: 'Rishi Agarwal',
      roll: '1RV24CI099',
      role: 'Lead UI & Interactive Developer',
      desc: 'Built the interactive 2D coordinate SVG workspace, programmed drag-drop movement listeners, and constructed the benchmarks comparisons and charting systems.',
      initials: 'RA',
      color: '#10b981',
    },
    {
      name: 'Rangappagari John Niranjan',
      roll: '1RV24CI096',
      role: 'Analysis & Verification Engineer',
      desc: 'Implemented the Christofides 1.5x approximation steps, developed the Branch & Bound search tree logic, and validated algorithmic execution runtimes.',
      initials: 'RJ',
      color: '#8b5cf6',
    },
  ]

  return (
    <div style={{ width: '100%', animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
      
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: '1.5rem', marginBottom: 8 }}>
          B.Tech Computer Science &amp; Engineering (AI &amp; ML)
        </h2>
        <p style={{ color: 'rgba(100,116,139,1)', fontSize: '0.8rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
          Design &amp; Analysis of Algorithms (DAA) Laboratory Project Group — Minimum Cost Tour Finder Team
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
        {members.map((m, idx) => (
          <div
            key={idx}
            className="glass-card"
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s'
            }}
          >
            {/* Ambient subtle glow based on member color */}
            <div style={{
              position: 'absolute', top: -30, width: 90, height: 90, borderRadius: '50%',
              background: `radial-gradient(circle, ${m.color}25 0%, transparent 70%)`,
              pointerEvents: 'none'
            }} />

            {/* Initials Avatar */}
            <div
              style={{
                width: 60, height: 60, borderRadius: '50%',
                background: `linear-gradient(135deg, ${m.color}20, ${m.color}40)`,
                border: `1.5px solid ${m.color}60`,
                boxShadow: `0 0 15px ${m.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: '1.2rem',
                fontFamily: "'Space Grotesk',sans-serif",
                marginBottom: 16
              }}
            >
              {m.initials}
            </div>

            <h3 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>
              {m.name}
            </h3>
            <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.68rem', fontFamily: 'monospace', marginBottom: 12 }}>
              {m.roll}
            </div>

            <div
              style={{
                fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: `${m.color}15`, color: m.color, border: `1px solid ${m.color}35`,
                marginBottom: 16
              }}
            >
              {m.role}
            </div>

            <p style={{ color: 'rgba(148,163,184,0.65)', fontSize: '0.78rem', lineHeight: 1.6, flexGrow: 1 }}>
              {m.desc}
            </p>
          </div>
        ))}
      </div>

      <div className="glass-card" style={{ marginTop: 36, padding: 24, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)' }}>
        <p style={{ color: 'rgba(148,163,184,0.5)', fontSize: '0.75rem', lineHeight: 1.6 }}>
          Project supervised by the Department of Computer Science &amp; Engineering (AI &amp; ML). 
          All implementations are written in vanilla ECMAScript modules conforming to standard DAA curriculum verification specifications.
        </p>
      </div>

    </div>
  )
}
