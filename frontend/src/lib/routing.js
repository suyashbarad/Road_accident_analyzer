// ---------------------------------------------------------------------------
// Graph routing: shortest-path vs. risk-aware "safest" path (Dijkstra).
// The road network graph is exported by the ML pipeline (graph.json).
// ---------------------------------------------------------------------------

export function buildAdjacency(graph) {
  const adj = new Map()
  for (const n of graph.nodes) adj.set(n.id, [])
  for (const e of graph.edges) {
    if (adj.has(e.n0)) adj.get(e.n0).push({ to: e.n1, edge: e })
    if (adj.has(e.n1)) adj.get(e.n1).push({ to: e.n0, edge: e })
  }
  return adj
}

// Edge cost per mode. "safest" blends distance with predicted risk so the
// alternative route stays sensible (not an absurd detour) but avoids danger.
function costFor(mode) {
  if (mode === 'safest') return (e) => e.length_km * (1 + 8 * e.risk)
  return (e) => e.length_km
}

export function dijkstra(graph, adj, startId, endId, mode = 'shortest') {
  if (!startId || !endId || startId === endId) return null
  const cost = costFor(mode)
  const dist = new Map()
  const prev = new Map()
  const visited = new Set()
  for (const n of graph.nodes) dist.set(n.id, Infinity)
  if (!dist.has(startId) || !dist.has(endId)) return null
  dist.set(startId, 0)

  while (true) {
    let u = null
    let best = Infinity
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d
        u = id
      }
    }
    if (u == null || u === endId) break
    visited.add(u)
    for (const { to, edge } of adj.get(u) || []) {
      if (visited.has(to)) continue
      const nd = dist.get(u) + cost(edge)
      if (nd < dist.get(to)) {
        dist.set(to, nd)
        prev.set(to, { node: u, edge })
      }
    }
  }

  if (!prev.has(endId)) return null
  const edges = []
  const nodes = [endId]
  let cur = endId
  while (cur !== startId) {
    const p = prev.get(cur)
    if (!p) return null
    edges.unshift(p.edge)
    nodes.unshift(p.node)
    cur = p.node
  }
  return { nodes, edges, cost: dist.get(endId) }
}

export function nearestNode(graph, lat, lon) {
  let best = null
  let bestD = Infinity
  for (const n of graph.nodes) {
    const d = (n.lat - lat) ** 2 + (n.lon - lon) ** 2
    if (d < bestD) {
      bestD = d
      best = n
    }
  }
  return best
}

const SPEED_BY_CLASS = { highway: 78, arterial: 60, collector: 46, residential: 32 }

/**
 * Summarise a route: distance, travel time, cumulative risk exposure, the worst
 * segment, and how many segments fall in each risk band.
 */
export function routeStats(route, segmentById) {
  if (!route) return null
  let distance = 0
  let exposure = 0
  let maxRisk = 0
  let highRisk = 0
  let timeH = 0
  const coords = []
  let prevNode = route.nodes[0]

  for (const e of route.edges) {
    const seg = segmentById.get(e.id)
    distance += e.length_km
    exposure += e.length_km * e.risk
    timeH += e.length_km / (SPEED_BY_CLASS[e.road_class] || 45)
    if (e.risk > maxRisk) maxRisk = e.risk
    if (e.risk >= 0.7) highRisk++
    if (seg) {
      // coords run n0 -> n1; reverse when we enter the segment from n1
      const path = seg.n1 === prevNode ? [...seg.coords].reverse() : seg.coords
      for (const c of path) coords.push(c)
    }
    prevNode = e.n0 === prevNode ? e.n1 : e.n0
  }

  return {
    distance,
    exposure,
    avgRisk: distance > 0 ? exposure / distance : 0,
    maxRisk,
    highRisk,
    minutes: Math.round(timeH * 60),
    coords,
    nSegments: route.edges.length,
  }
}

