import { useState } from 'react'

export default function AlgorithmsInfo() {
  const [activeTab, setActiveTab] = useState('hk')

  const info = {
    hk: {
      name: 'Held-Karp (Exact Dynamic Programming)',
      complexity: 'O(2ⁿ · n²)',
      space: 'O(2ⁿ · n)',
      type: 'Exact / Optimal Solution',
      theory: 'The Held-Karp algorithm uses dynamic programming (DP) and memoization to compute the absolute minimum cost TSP tour. Instead of testing all n! permutations (brute force), it breaks the problem down into subproblems based on sub-tours.',
      howItWorks: [
        'Define state DP(S, i) representing the minimum cost path that visits all vertices in set S exactly once, starting at vertex 0 and ending at vertex i.',
        'The recurrence relation is: DP(S, i) = min_{j ∈ S, j ≠ i} { DP(S \\ {i}, j) + dist(j, i) }.',
        'Use bitmask integers (where the k-th bit denotes if city k has been visited) to represent subset S efficiently in memory.',
        'Reconstruct the optimal path by backtracking through the stored parent choices at each DP index.'
      ],
      pseudocode: `function runHeldKarp(dist, n):
  // Initialize DP table of size [2^n][n] with Infinity
  DP = matrix(2^n, n, Infinity)
  Parent = matrix(2^n, n, -1)
  
  DP[1][0] = 0 // Start at city 0 (bitmask 1 = 000...0001)

  for mask from 1 to (2^n - 1):
    if not (mask & 1) continue // Must include start city
    for u from 0 to n-1:
      if not (mask & (1 << u)) continue
      if DP[mask][u] == Infinity: continue
      
      for v from 0 to n-1:
        if (mask & (1 << v)) continue // Already visited
        if dist[u][v] == 0: continue
        
        newMask = mask | (1 << v)
        newCost = DP[mask][u] + dist[u][v]
        if newCost < DP[newMask][v]:
          DP[newMask][v] = newCost
          Parent[newMask][v] = u

  // Find optimal return edge to starting city 0
  minCost = Infinity
  lastCity = -1
  fullMask = 2^n - 1
  for u from 1 to n-1:
    totalCost = DP[fullMask][u] + dist[u][0]
    if totalCost < minCost:
      minCost = totalCost
      lastCity = u

  return ReconstructPath(Parent, lastCity), minCost`,
      pros: ['Guaranteed to find the mathematically optimal tour.', 'Much faster than brute-force O(n!) for medium graphs.'],
      cons: ['Highly memory-intensive due to O(2ⁿ) states.', 'Unusable for graphs with more than 20–23 nodes due to RAM limits.']
    },
    bb: {
      name: 'Branch & Bound (Exact Search)',
      complexity: 'O(n!) worst case',
      space: 'O(n²)',
      type: 'Exact / Optimal Search',
      theory: 'Branch & Bound is a state-space search algorithm that prunes branches of a search tree which cannot possibly lead to an optimal solution. It uses a reduced cost matrix lower bound to estimate the minimum potential cost of completing any partial path.',
      howItWorks: [
        'Perform a Depth-First Search (DFS) traversal of the state-space tree starting at city 0.',
        'At each state, reduce the cost matrix by subtracting row minimums and column minimums. The sum of these values constitutes the node\'s Lower Bound (LB).',
        'When transitioning from city u to city v, restrict the matrix by making row u, column v, and entry (v, 0) infinite, and re-reduce.',
        'The child\'s Lower Bound is computed as: LB_child = LB_parent + reduced_dist(u, v) + reduction_cost_child.',
        'If LB_child is greater than or equal to the best completed tour cost found so far, prune the entire branch immediately.'
      ],
      pseudocode: `function solveB_and_B(dist, n):
  initialMatrix = prepareInfiniteDiag(dist)
  root = reduceMatrix(initialMatrix)
  search(0, [0], 1, root.reductionCost, root.reduced)

function search(curr, path, visitedMask, currentLB, currentMatrix):
  if path.length == n:
    actualCost = getActualCost(path)
    if actualCost < bestCost:
      bestCost = actualCost
      bestPath = path + [0]
    return

  destinations = getSortedUnvisitedNeighbors(curr, currentMatrix)
  for nextCity in destinations:
    nextMatrix = clone(currentMatrix)
    setRowInf(nextMatrix, curr)
    setColInf(nextMatrix, nextCity)
    nextMatrix[nextCity][0] = Infinity // Prevent early cycles

    reductionCost = reduce(nextMatrix)
    nextLB = currentLB + currentMatrix[curr][nextCity] + reductionCost

    if nextLB >= bestCost:
      continue // Prune branch

    search(nextCity, path + [nextCity], visitedMask | (1 << nextCity), nextLB, nextMatrix)`,
      pros: ['Guarantees mathematical optimality.', 'Prunes large subsets of solutions early via reduced matrix lower bounds, running much faster than brute force.'],
      cons: ['Worst-case complexity is O(n!) when pruning is ineffective (e.g. uniform edge weights).', 'Requires recursive matrix copies which increases memory usage to O(n²) compared to standard DFS.']
    },
    ch: {
      name: 'Christofides Algorithm (Approximation)',
      complexity: 'O(n³)',
      space: 'O(n²)',
      type: '1.5× Approximation (Metric TSP)',
      theory: 'The Christofides algorithm is an approximation algorithm that guarantees finding a tour with cost at most 1.5 times the optimal tour cost, assuming the distance matrix satisfies the triangle inequality (metric TSP). It elegantly combines spanning trees and graph matchings.',
      howItWorks: [
        'Find a Minimum Spanning Tree (MST) of the graph (e.g. using Prim\'s or Kruskal\'s algorithm).',
        'Identify vertices in the MST that have an odd degree (odd number of connected edges). Handshaking lemma guarantees there is an even number of odd vertices.',
        'Compute a Minimum-Weight Perfect Matching on these odd-degree vertices.',
        'Combine the MST edges and matching edges to form a Eulerian multigraph (all nodes now have even degrees).',
        'Find a Eulerian circuit (a path visiting every edge exactly once) using Hierholzer\'s algorithm.',
        'Shortcut repeated vertices in the Eulerian circuit to construct a Hamiltonian cycle (the final TSP tour).'
      ],
      pseudocode: `function runChristofides(dist):
  // 1. Minimum Spanning Tree
  mstEdges = primsMST(dist)

  // 2. Identify Odd-Degree Vertices
  oddVertices = getOddVertices(mstEdges)

  // 3. Minimum-Weight Perfect Matching
  matchingEdges = minWeightMatching(dist, oddVertices)

  // 4. Combine Edges into Multigraph
  multigraph = combine(mstEdges, matchingEdges)

  // 5. Find Eulerian Circuit
  eulerianTour = hierholzer(multigraph)

  // 6. Shortcut to Hamiltonian Cycle
  hamiltonianPath = []
  seen = set()
  for vertex in eulerianTour:
    if vertex not in seen:
      seen.add(vertex)
      hamiltonianPath.append(vertex)
  hamiltonianPath.append(hamiltonianPath[0]) // Close tour

  return hamiltonianPath, getPathCost(hamiltonianPath)`,
      pros: ['Extremely fast (polynomial time complexity) and scales to thousands of nodes.', 'Guarantees the tour is no worse than 50% longer than the absolute optimal path.'],
      cons: ['Requires the distance matrix to satisfy metric conditions (triangle inequality).', 'Does not guarantee finding the absolute mathematical optimum.']
    }
  }

  const active = info[activeTab]

  return (
    <div style={{ width: '100%', animation: 'fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) both' }}>
      
      {/* Tab selectors */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: 24, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { id: 'hk', label: 'Held-Karp' },
          { id: 'bb', label: 'Branch & Bound' },
          { id: 'ch', label: 'Christofides' },
        ].map(t => {
          const isSel = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0',
                color: isSel ? '#60a5fa' : 'rgba(148,163,184,0.6)',
                fontWeight: 700, fontSize: '0.9rem', position: 'relative',
                transition: 'color 0.25s', whiteSpace: 'nowrap',
                fontFamily: "'Space Grotesk',sans-serif",
              }}
            >
              {t.label}
              {isSel && (
                <span style={{
                  position: 'absolute', bottom: -1, left: 0, right: 0, height: 2,
                  background: '#60a5fa', boxShadow: '0 0 10px #60a5fa'
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Content layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', lgGridTemplateColumns: '7fr 5fr', gap: 24 }}>
        
        {/* Left Column: Theory and steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Overview Card */}
          <div className="glass-card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <h3 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '1.25rem' }}>{active.name}</h3>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                {active.type}
              </span>
            </div>
            
            <p style={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: 24 }}>
              {active.theory}
            </p>

            <h4 style={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, marginBottom: 14, fontFamily: "'Space Grotesk',sans-serif" }}>Step-by-Step Logic Flow</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {active.howItWorks.map((step, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                    color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: '0.72rem', fontWeight: 700, marginTop: 2
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.82rem', lineHeight: 1.55 }}>{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pros vs Cons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="glass-card" style={{ padding: 24, borderLeft: '3px solid #10b981', background: 'rgba(16,185,129,0.02)' }}>
              <h4 style={{ color: '#10b981', fontSize: '0.88rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ Advantages
              </h4>
              <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.pros.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
            <div className="glass-card" style={{ padding: 24, borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.02)' }}>
              <h4 style={{ color: '#ef4444', fontSize: '0.88rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                ⚠ Limitations
              </h4>
              <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.cons.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </div>

        </div>

        {/* Right Column: Code block & Complexity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Complexity Box */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h4 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Efficiency Profile</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Time Complexity</div>
                <div style={{ color: '#60a5fa', fontWeight: 800, fontSize: '1.1rem', marginTop: 4, fontFamily: 'monospace' }}>{active.complexity}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: '0.65rem', textTransform: 'uppercase' }}>Space Complexity</div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', marginTop: 4, fontFamily: 'monospace' }}>{active.space}</div>
              </div>
            </div>
          </div>

          {/* Pseudocode Box */}
          <div className="glass-card" style={{ padding: 24, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ color: 'white', fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '0.9rem', marginBottom: 12 }}>Pseudo-code Reference</h4>
            <div style={{
              background: '#040711', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10,
              padding: 14, flexGrow: 1, overflowY: 'auto', maxHeight: 380,
            }}>
              <pre style={{
                color: 'rgba(147,197,253,0.85)', fontSize: '0.72rem', fontFamily: 'monospace',
                lineHeight: 1.5, whiteSpace: 'pre'
              }}>
                {active.pseudocode}
              </pre>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
