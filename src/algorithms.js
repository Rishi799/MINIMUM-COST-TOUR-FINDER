// ─────────────────────────────────────────────────────────────────────────────
// TSP Algorithms for Minimum Cost Tour Finder
// ─────────────────────────────────────────────────────────────────────────────

// Helper: check if matrix satisfies Metric TSP (Symmetric & Triangle Inequality)
export function checkMetricTSP(dist) {
  const n = dist.length
  
  // 1. Check Symmetry
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(dist[i][j] - dist[j][i]) > 1e-5) {
        return { isMetric: false, reason: 'Asymmetric matrix' }
      }
    }
  }

  // 2. Check Triangle Inequality: d(i, k) <= d(i, j) + d(j, k)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        if (i !== j && j !== k && i !== k) {
          if (dist[i][k] > dist[i][j] + dist[j][k]) {
            return {
              isMetric: false,
              reason: `Triangle inequality violated: d(${cityLabel(i)},${cityLabel(k)}) > d(${cityLabel(i)},${cityLabel(j)}) + d(${cityLabel(j)},${cityLabel(k)}) (${dist[i][k]} > ${dist[i][j]} + ${dist[j][k]})`
            }
          }
        }
      }
    }
  }

  return { isMetric: true }
}

// Nearest Neighbor heuristic (used as initial upper bound for B&B)
function nearestNeighbor(dist, n) {
  const visited = new Array(n).fill(false)
  const path = [0]
  visited[0] = true
  let cost = 0

  for (let step = 1; step < n; step++) {
    const curr = path[path.length - 1]
    let best = -1
    let bestDist = Infinity
    for (let v = 0; v < n; v++) {
      if (!visited[v] && dist[curr][v] > 0 && dist[curr][v] < bestDist) {
        bestDist = dist[curr][v]
        best = v
      }
    }
    if (best === -1) break
    visited[best] = true
    path.push(best)
    cost += bestDist
  }

  const returnCost = dist[path[path.length - 1]][0]
  cost += returnCost > 0 ? returnCost : 0
  path.push(0)
  return { path, cost }
}

// ─────────────────────────────────────────────────────────────────────────────
// Held-Karp (Exact DP)  —  O(2ⁿ · n²) time, O(2ⁿ · n) space
// ─────────────────────────────────────────────────────────────────────────────
export function runHeldKarp(dist) {
  const n = dist.length
  const t0 = performance.now()

  if (n === 1) {
    return result([0, 0], 0, t0, 'O(2ⁿ · n²)', 'O(2ⁿ · n)', checkMetricTSP(dist))
  }

  const STATES = 1 << n
  const dp = new Float64Array(STATES * n).fill(Infinity)
  const par = new Int16Array(STATES * n).fill(-1)
  const I = (mask, city) => mask * n + city

  dp[I(1, 0)] = 0 // Start at city 0

  for (let mask = 1; mask < STATES; mask++) {
    if (!(mask & 1)) continue // Must include city 0
    for (let u = 0; u < n; u++) {
      if (!(mask & (1 << u))) continue
      const dpU = dp[I(mask, u)]
      if (dpU === Infinity) continue
      for (let v = 0; v < n; v++) {
        if (mask & (1 << v)) continue
        const w = dist[u][v]
        if (!w || w <= 0) continue
        const newMask = mask | (1 << v)
        const newCost = dpU + w
        const ni = I(newMask, v)
        if (newCost < dp[ni]) {
          dp[ni] = newCost
          par[ni] = u
        }
      }
    }
  }

  const fullMask = STATES - 1
  let minCost = Infinity
  let lastCity = -1

  for (let u = 1; u < n; u++) {
    const dpVal = dp[I(fullMask, u)]
    if (dpVal === Infinity) continue
    const w = dist[u][0]
    if (!w || w <= 0) continue
    const total = dpVal + w
    if (total < minCost) {
      minCost = total
      lastCity = u
    }
  }

  if (lastCity === -1) return { error: 'No valid tour found. Check matrix values.' }

  // Reconstruct path
  const path = []
  let mask = fullMask
  let curr = lastCity
  while (curr !== -1) {
    path.unshift(curr)
    const prev = par[I(mask, curr)]
    mask ^= (1 << curr)
    curr = prev
  }
  path.push(0)

  return result(path, minCost, t0, 'O(2ⁿ · n²)', 'O(2ⁿ · n)', checkMetricTSP(dist))
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix Reduction Branch & Bound  —  O(n!) worst case, heavily pruned
// ─────────────────────────────────────────────────────────────────────────────
function reduceMatrix(matrix) {
  const n = matrix.length
  let reductionCost = 0
  
  // Clone matrix to avoid modifying parent states
  const reduced = matrix.map(row => [...row])

  // 1. Row reduction
  for (let i = 0; i < n; i++) {
    let minVal = Infinity
    for (let j = 0; j < n; j++) {
      if (reduced[i][j] < minVal) minVal = reduced[i][j]
    }
    if (minVal !== Infinity && minVal > 0) {
      reductionCost += minVal
      for (let j = 0; j < n; j++) {
        if (reduced[i][j] !== Infinity) reduced[i][j] -= minVal
      }
    }
  }

  // 2. Column reduction
  for (let j = 0; j < n; j++) {
    let minVal = Infinity
    for (let i = 0; i < n; i++) {
      if (reduced[i][j] < minVal) minVal = reduced[i][j]
    }
    if (minVal !== Infinity && minVal > 0) {
      reductionCost += minVal
      for (let i = 0; i < n; i++) {
        if (reduced[i][j] !== Infinity) reduced[i][j] -= minVal
      }
    }
  }

  return { reduced, reductionCost }
}

export function runBranchAndBound(dist) {
  const n = dist.length
  const t0 = performance.now()

  // Start with nearest-neighbor upper bound for better initial pruning
  const nn = nearestNeighbor(dist, n)
  let bestCost = nn.cost
  let bestPath = [...nn.path]

  // Setup initial infinite matrix: diag = Infinity
  const initialMatrix = dist.map((row, i) =>
    row.map((val, j) => (i === j || val <= 0) ? Infinity : val)
  )

  const root = reduceMatrix(initialMatrix)

  function search(curr, path, visitedMask, currentLB, currentMatrix) {
    if (path.length === n) {
      const retCost = dist[curr][0]
      if (retCost > 0) {
        const total = currentLB + currentMatrix[curr][0] // Since matrix holds remaining reduced cost
        const actualCost = calculateActualCost(dist, [...path, 0])
        if (actualCost < bestCost) {
          bestCost = actualCost
          bestPath = [...path, 0]
        }
      }
      return
    }

    // Sort next destinations by direct distance to visit promising paths first
    const destinations = []
    for (let v = 0; v < n; v++) {
      if (!(visitedMask & (1 << v)) && currentMatrix[curr][v] !== Infinity) {
        destinations.push({ city: v, cost: currentMatrix[curr][v] })
      }
    }
    destinations.sort((a, b) => a.cost - b.cost)

    for (const { city: next } of destinations) {
      // 1. Copy matrix and set row/col restrictions
      const nextMatrix = currentMatrix.map(row => [...row])
      
      // Set row curr to Infinity (cannot leave curr again)
      for (let j = 0; j < n; j++) nextMatrix[curr][j] = Infinity
      // Set col next to Infinity (cannot enter next again)
      for (let i = 0; i < n; i++) nextMatrix[i][next] = Infinity
      // Prevent returning to start city early
      nextMatrix[next][0] = Infinity

      // 2. Reduce the new matrix
      const { reduced, reductionCost } = reduceMatrix(nextMatrix)

      // 3. Compute child Lower Bound
      // LB = parent_LB + reduced_cost_to_next + reduction_cost_of_new_matrix
      const nextLB = currentLB + currentMatrix[curr][next] + reductionCost

      // Prune if estimated lower bound is worse than or equal to current best
      if (nextLB >= bestCost) continue

      search(next, [...path, next], visitedMask | (1 << next), nextLB, reduced)
    }
  }

  search(0, [0], 1, root.reductionCost, root.reduced)

  return result(bestPath, bestCost, t0, 'O(n!) worst, matrix-reduced search', 'O(n²)', checkMetricTSP(dist))
}

function calculateActualCost(dist, path) {
  let cost = 0
  for (let i = 0; i < path.length - 1; i++) {
    cost += dist[path[i]][path[i + 1]]
  }
  return cost
}

// ─────────────────────────────────────────────────────────────────────────────
// Christofides Algorithm  —  O(n³), ≤1.5× optimal approximation
// ─────────────────────────────────────────────────────────────────────────────
export function runChristofides(dist) {
  const n = dist.length
  const t0 = performance.now()

  // 1. Minimum Spanning Tree via Prim's
  const mstEdges = primMST(dist, n)

  // 2. Find odd-degree vertices in MST
  const deg = new Array(n).fill(0)
  mstEdges.forEach(([u, v]) => { deg[u]++; deg[v]++ })
  const oddV = []
  for (let i = 0; i < n; i++) if (deg[i] % 2 !== 0) oddV.push(i)

  // 3. Greedy minimum-weight perfect matching on odd-degree vertices
  const matching = greedyMatching(dist, oddV)

  // 4. Build multigraph: MST edges + matching edges
  const adj = Array.from({ length: n }, () => [])
  mstEdges.forEach(([u, v]) => { adj[u].push(v); adj[v].push(u) })
  matching.forEach(([u, v]) => { adj[u].push(v); adj[v].push(u) })

  // 5. Find Eulerian circuit (Hierholzer's algorithm)
  const euler = hierholzer(adj)

  // 6. Shortcut repeated vertices → Hamiltonian cycle
  const seen = new Set()
  const path = []
  for (const v of euler) {
    if (!seen.has(v)) { seen.add(v); path.push(v) }
  }
  path.push(path[0])

  let cost = 0
  for (let i = 0; i < path.length - 1; i++) cost += dist[path[i]][path[i + 1]]

  return {
    ...result(path, cost, t0, 'O(n³)', 'O(n²)', checkMetricTSP(dist)),
    isApproximate: true,
    approximationRatio: '≤ 1.5× optimal',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function primMST(dist, n) {
  const inMST = new Array(n).fill(false)
  const key = new Array(n).fill(Infinity)
  const parent = new Array(n).fill(-1)
  key[0] = 0
  const edges = []

  for (let iter = 0; iter < n; iter++) {
    let u = -1
    for (let v = 0; v < n; v++) {
      if (!inMST[v] && (u === -1 || key[v] < key[u])) u = v
    }
    inMST[u] = true
    if (parent[u] !== -1) edges.push([parent[u], u])
    for (let v = 0; v < n; v++) {
      if (!inMST[v] && dist[u][v] > 0 && dist[u][v] < key[v]) {
        key[v] = dist[u][v]
        parent[v] = u
      }
    }
  }
  return edges
}

function greedyMatching(dist, verts) {
  const pairs = []
  for (let i = 0; i < verts.length; i++)
    for (let j = i + 1; j < verts.length; j++)
      pairs.push([dist[verts[i]][verts[j]], verts[i], verts[j]])
  pairs.sort((a, b) => a[0] - b[0])

  const matched = new Set()
  const matching = []
  for (const [, u, v] of pairs) {
    if (!matched.has(u) && !matched.has(v)) {
      matching.push([u, v])
      matched.add(u)
      matched.add(v)
    }
  }
  return matching
}

function hierholzer(adjInput) {
  const adj = adjInput.map(l => [...l])
  const stack = [0]
  const circuit = []

  while (stack.length > 0) {
    const v = stack[stack.length - 1]
    if (adj[v].length > 0) {
      const u = adj[v].pop()
      const i = adj[u].lastIndexOf(v)
      if (i !== -1) adj[u].splice(i, 1)
      stack.push(u)
    } else {
      circuit.push(stack.pop())
    }
  }
  return circuit
}

function result(path, cost, t0, timeC, spaceC, metricCheck) {
  return {
    path,
    cost,
    executionTime: performance.now() - t0,
    timeComplexity: timeC,
    spaceComplexity: spaceC,
    metricCheck,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Random symmetric matrix generator
// ─────────────────────────────────────────────────────────────────────────────
export function generateRandomMatrix(n) {
  const m = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = Math.floor(Math.random() * 91) + 10 // 10–100
      m[i][j] = v
      m[j][i] = v
    }
  }
  return m
}

// City label helper
export const cityLabel = i =>
  i < 26 ? String.fromCharCode(65 + i) : `C${i + 1}`
