// ─────────────────────────────────────────────────────────────────────────────
// TSP Algorithms for Minimum Cost Tour Finder
// ─────────────────────────────────────────────────────────────────────────────

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
    return result([0, 0], 0, t0, 'O(2ⁿ · n²)', 'O(2ⁿ · n)')
  }

  const STATES = 1 << n
  // Flat typed arrays for memory efficiency
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

  return result(path, minCost, t0, 'O(2ⁿ · n²)', 'O(2ⁿ · n)')
}

// ─────────────────────────────────────────────────────────────────────────────
// Branch & Bound  —  O(n!) worst case, significantly pruned
// ─────────────────────────────────────────────────────────────────────────────
export function runBranchAndBound(dist) {
  const n = dist.length
  const t0 = performance.now()

  // Start with nearest-neighbor upper bound for better pruning
  const nn = nearestNeighbor(dist, n)
  let bestCost = nn.cost
  let bestPath = [...nn.path]

  const visited = new Array(n).fill(false)
  visited[0] = true

  function dfs(curr, path, cost) {
    if (path.length === n) {
      const ret = dist[curr][0]
      if (!ret || ret <= 0) return
      const total = cost + ret
      if (total < bestCost) {
        bestCost = total
        bestPath = [...path, 0]
      }
      return
    }

    // Collect and sort candidates by distance (for better pruning)
    const candidates = []
    for (let v = 0; v < n; v++) {
      if (!visited[v] && dist[curr][v] > 0) {
        candidates.push(v)
      }
    }
    candidates.sort((a, b) => dist[curr][a] - dist[curr][b])

    for (const next of candidates) {
      const newCost = cost + dist[curr][next]
      if (newCost >= bestCost) break // Sorted — prune remaining too
      visited[next] = true
      dfs(next, [...path, next], newCost)
      visited[next] = false
    }
  }

  dfs(0, [0], 0)

  return result(bestPath, bestCost, t0, 'O(n!) worst, heavily pruned', 'O(n)')
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
    ...result(path, cost, t0, 'O(n³)', 'O(n²)'),
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

function result(path, cost, t0, timeC, spaceC) {
  return {
    path,
    cost,
    executionTime: performance.now() - t0,
    timeComplexity: timeC,
    spaceComplexity: spaceC,
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
