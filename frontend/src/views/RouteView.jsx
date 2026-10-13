import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Route as RouteIcon, Navigation, ShieldCheck, Timer, Ruler, Gauge as GaugeIcon,
  AlertTriangle, ArrowLeftRight, Trash2, MapPin, Sparkles, Crosshair,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import MapCanvas from '../components/map/MapCanvas'
import { Card, Stat, Badge, EmptyMsg } from '../components/ui'
import { dijkstra, routeStats, nearestNode } from '../lib/routing'
import { riskColor, RISK_COLORS, RISK_LABELS, titleCase, num, f2 } from '../lib/risk'

const LAYERS = {
  riskSegments: true,
  predHeat: false,
  histHeat: false,
  accidentPoints: false,
  histHotspots: false,
  predHotspots: false,
  pois: false,
}

const SHORTEST_COLOR = '#38bdf8'
const SAFEST_COLOR = '#22c55e'

export default function RouteView() {
  const { graph, segments, segmentById, adjacency, meta, navigate } = useData()
  const [basemap, setBasemap] = useState('dark')
  const [start, setStart] = useState(null)
  const [end, setEnd] = useState(null)
  const [picking, setPicking] = useState(null) // 'start' | 'end' | null
  const [mode, setMode] = useState('safest') // recommended route shown solid

  /* seed a demo cross-city pair on first load so the view is never empty */
  useEffect(() => {
    if (!graph?.nodes?.length || start || end) return
    const b = meta?.bbox
    if (!b) return
    const s = nearestNode(graph, b.min_lat, b.min_lon)
    const e = nearestNode(graph, b.max_lat, b.max_lon)
    if (s && e && s.id !== e.id) {
      setStart(s)
      setEnd(e)
    }
  }, [graph, meta, start, end])

  const shortest = useMemo(
    () => (start && end ? dijkstra(graph, adjacency, start.id, end.id, 'shortest') : null),
    [graph, adjacency, start, end],
  )
  const safest = useMemo(
    () => (start && end ? dijkstra(graph, adjacency, start.id, end.id, 'safest') : null),
    [graph, adjacency, start, end],
  )
  const shortestStats = useMemo(() => routeStats(shortest, segmentById), [shortest, segmentById])
  const safestStats = useMemo(() => routeStats(safest, segmentById), [safest, segmentById])

  const recStats = mode === 'safest' ? safestStats : shortestStats
  const recRoute = mode === 'safest' ? safest : shortest

  // deltas of "safest" relative to "shortest"
  const riskDelta = shortestStats && safestStats ? shortestStats.avgRisk - safestStats.avgRisk : 0
  const distDelta = shortestStats && safestStats ? safestStats.distance - shortestStats.distance : 0
  const timeDelta = shortestStats && safestStats ? safestStats.minutes - shortestStats.minutes : 0

  const profile = useMemo(() => {
    if (!recRoute) return []
    return recRoute.edges.map((e) => {
      const seg = segmentById.get(e.id)
      return { id: e.id, name: seg?.name || e.id, risk: e.risk, length_km: e.length_km, road_class: e.road_class }
    })
  }, [recRoute, segmentById])

  const worst = useMemo(() => [...profile].sort((a, b) => b.risk - a.risk).slice(0, 4), [profile])

  const markers = useMemo(() => {
    const out = []
    if (start) out.push({ lat: start.lat, lon: start.lon, label: 'A', color: SAFEST_COLOR, tooltip: `Start · ${start.id}` })
    if (end) out.push({ lat: end.lat, lon: end.lon, label: 'B', color: '#ef4444', tooltip: `Destination · ${end.id}` })
    return out
  }, [start, end])

  const routes = useMemo(() => {
    const out = []
    if (shortestStats?.coords?.length)
      out.push({ coords: shortestStats.coords, color: SHORTEST_COLOR, dash: mode === 'shortest' ? null : '6 10' })
    if (safestStats?.coords?.length)
      out.push({ coords: safestStats.coords, color: SAFEST_COLOR, dash: mode === 'safest' ? null : '6 10' })
    return out
  }, [shortestStats, safestStats, mode])

  const assign = useCallback(
    (node) => {
      if (!node) return
      if (picking === 'start') {
        setStart(node)
        setPicking(null)
      } else if (picking === 'end') {
        setEnd(node)
        setPicking(null)
      } else if (!start) setStart(node)
      else if (!end && node.id !== start.id) setEnd(node)
    },
    [picking, start, end],
  )

  const onNodeClick = useCallback((n) => assign(n), [assign])
  const onMapClick = useCallback(
    (lat, lon) => {
      // only drop a pin when the user is explicitly arming A or B, to avoid
      // accidental endpoint changes while panning / inspecting roads
      if (!picking) return
      const n = nearestNode(graph, lat, lon)
      assign(n)
    },
    [picking, graph, assign],
  )

  const swap = () => {
    setStart(end)
    setEnd(start)
  }
  const clear = () => {
    setStart(null)
    setEnd(null)
    setPicking(null)
  }
  const demo = () => {
    const b = meta?.bbox
    if (!b || !graph?.nodes?.length) return
    setStart(nearestNode(graph, b.min_lat, b.min_lon))
    setEnd(nearestNode(graph, b.max_lat, b.max_lon))
  }

  const openSegment = (p) => {
    const s = segmentById.get(p.id)
    if (s) navigate('map', { select: s.id, lat: s.mid_lat, lon: s.mid_lon, zoom: 16 })
  }

  const ready = !!(start && end && recStats)
  const warn = recStats && recStats.maxRisk >= 0.7

  return (
    <div className="h-full flex">
      {/* ---------------- left panel ---------------- */}
      <div className="w-[24rem] shrink-0 h-full overflow-y-auto p-4 space-y-4 border-r border-white/6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-50 flex items-center gap-2">
            <RouteIcon size={18} className="text-brand-300" /> Route risk planner
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Compare the <span style={{ color: SHORTEST_COLOR }}>fastest</span> path against the model's{' '}
            <span style={{ color: SAFEST_COLOR }}>risk-aware safest</span> path over the same origin &amp; destination.
          </p>
        </div>

        {/* endpoints */}
        <Card title="Origin &amp; destination" icon={<MapPin size={15} />} bodyClass="p-3 space-y-2">
          <EndpointRow
            letter="A"
            color={SAFEST_COLOR}
            label="Start"
            node={start}
            armed={picking === 'start'}
            onArm={() => setPicking(picking === 'start' ? null : 'start')}
          />
          <EndpointRow
            letter="B"
            color="#ef4444"
            label="Destination"
            node={end}
            armed={picking === 'end'}
            onArm={() => setPicking(picking === 'end' ? null : 'end')}
          />
          <div className="flex gap-1.5 pt-1">
            <button onClick={swap} disabled={!start || !end} className="btn-mini flex-1" title="Swap A and B">
              <ArrowLeftRight size={11} /> Swap
            </button>
            <button onClick={demo} className="btn-mini flex-1" title="Load a cross-city demo route">
              <Sparkles size={11} /> Demo
            </button>
            <button onClick={clear} disabled={!start && !end} className="btn-mini flex-1" title="Clear">
              <Trash2 size={11} /> Clear
            </button>
          </div>
          <p className="text-[10.5px] text-slate-500 leading-relaxed">
            {picking ? (
              <span className="text-brand-300 flex items-center gap-1">
                <Crosshair size={11} className="animate-pulse" /> Now click the map or a junction to set {picking === 'start' ? 'A' : 'B'}…
              </span>
            ) : (
              <>Arm A or B, then click anywhere on the map — the nearest junction is used. Click a blue junction to fill the empty slot.</>
            )}
          </p>
        </Card>

        {/* mode selector */}
        <Card title="Routing strategy" icon={<Navigation size={15} />} bodyClass="p-2.5 grid grid-cols-2 gap-2">
          <ModeCard
            active={mode === 'shortest'}
            onClick={() => setMode('shortest')}
            color={SHORTEST_COLOR}
            icon={<Timer size={15} />}
            title="Fastest"
            stats={shortestStats}
          />
          <ModeCard
            active={mode === 'safest'}
            onClick={() => setMode('safest')}
            color={SAFEST_COLOR}
            icon={<ShieldCheck size={15} />}
            title="Safest"
            badge="Recommended"
            stats={safestStats}
          />
        </Card>

        {!ready ? (
          <Card>
            <EmptyMsg>Set an origin (A) and destination (B) to compare routes.</EmptyMsg>
          </Card>
        ) : (
          <>
            {/* verdict */}
            <div
              className="rounded-xl p-3 border"
              style={{
                background: warn ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                borderColor: warn ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)',
              }}
            >
              <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: warn ? '#fca5a5' : '#86efac' }}>
                {warn ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
                {warn ? 'High-risk stretch on this route' : 'Low-risk route selected'}
              </div>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Peak segment risk <b className="tabular">{Math.round(recStats.maxRisk * 100)}%</b> ·{' '}
                {recStats.highRisk} high-risk segment{recStats.highRisk === 1 ? '' : 's'} · average{' '}
                <b className="tabular">{Math.round(recStats.avgRisk * 100)}%</b>.
                {riskDelta > 0.01 && mode === 'safest' && (
                  <> The safest path cuts average risk by <b className="tabular">{Math.round(riskDelta * 100)} pts</b> for{' '}
                  <b className="tabular">+{f2(distDelta)} km</b> / <b className="tabular">+{timeDelta} min</b>.</>
                )}
              </p>
            </div>

            {/* headline stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Distance" value={`${f2(recStats.distance)} km`} icon={<Ruler size={16} />} accent={SHORTEST_COLOR} sub={`${recStats.nSegments} segments`} />
              <Stat label="Est. time" value={`${recStats.minutes} min`} icon={<Timer size={16} />} accent="#a78bfa" sub="by speed limits" />
              <Stat label="Avg risk" value={`${Math.round(recStats.avgRisk * 100)}%`} icon={<GaugeIcon size={16} />} accent={riskColor(recStats.avgRisk)} sub={RISK_LABELS[catOf(recStats.avgRisk)]} />
              <Stat label="Risk exposure" value={`${f2(recStats.exposure)}`} icon={<AlertTriangle size={16} />} accent="#f97316" sub="risk-weighted km" />
            </div>

            {/* risk profile */}
            <Card
              title="Risk profile along route"
              subtitle={`${mode === 'safest' ? 'Safest' : 'Fastest'} path · each bar is one road segment`}
              icon={<GaugeIcon size={15} />}
            >
              <div className="flex items-end gap-[3px] h-24">
                {profile.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openSegment(p)}
                    title={`${p.name}\nRisk ${Math.round(p.risk * 100)}% · ${f2(p.length_km)} km\nClick to open on map`}
                    className="flex-1 rounded-t-sm transition hover:brightness-125"
                    style={{ height: `${Math.max(7, p.risk * 100)}%`, background: riskColor(p.risk), minWidth: 4 }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                <span>Origin A</span>
                <span className="flex items-center gap-2">
                  {['low', 'moderate', 'high', 'very_high'].map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[c] }} />
                      {RISK_LABELS[c]}
                    </span>
                  ))}
                </span>
                <span>B</span>
              </div>
            </Card>

            {/* worst stretches */}
            <Card title="Worst stretches" subtitle="Highest-risk segments on this route" icon={<AlertTriangle size={15} />} bodyClass="p-2.5 space-y-1.5">
              {worst.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openSegment(p)}
                  className="w-full flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 hover:bg-white/7 p-2 transition text-left"
                >
                  <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: riskColor(p.risk) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-slate-100 truncate">{p.name}</span>
                    <span className="block text-[10px] text-slate-500">
                      {titleCase(p.road_class)} · {f2(p.length_km)} km
                    </span>
                  </span>
                  <span className="text-[13px] font-bold tabular shrink-0" style={{ color: riskColor(p.risk) }}>
                    {Math.round(p.risk * 100)}%
                  </span>
                </button>
              ))}
            </Card>
          </>
        )}
      </div>

      {/* ---------------- map ---------------- */}
      <div className="flex-1 relative min-w-0">
        <MapCanvas
          segments={segments}
          accidents={[]}
          pois={[]}
          nodes={graph.nodes}
          layers={LAYERS}
          basemap={basemap}
          center={meta.center}
          zoom={13}
          routes={routes}
          markers={markers}
          showNodes
          onNodeClick={onNodeClick}
          onMapClick={onMapClick}
        />

        {/* basemap toggle */}
        <div className="absolute top-3 left-3 z-[500] flex gap-1.5">
          {['dark', 'streets', 'satellite'].map((b) => (
            <button
              key={b}
              onClick={() => setBasemap(b)}
              className={`text-[10.5px] px-2.5 py-1.5 rounded-lg border backdrop-blur transition ${
                basemap === b ? 'bg-brand-500/25 border-brand-400/60 text-white' : 'bg-black/40 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {titleCase(b)}
            </button>
          ))}
        </div>

        {/* route legend */}
        {ready && (
          <div className="absolute top-3 right-3 z-[500] glass-soft rounded-xl px-3 py-2 text-[10.5px] text-slate-200 space-y-1.5 min-w-[10.5rem]">
            <LegendRow color={SAFEST_COLOR} dash={mode !== 'safest'} label="Safest" value={`${Math.round(safestStats.avgRisk * 100)}% avg`} />
            <LegendRow color={SHORTEST_COLOR} dash={mode !== 'shortest'} label="Fastest" value={`${num(Math.round(shortestStats.distance * 10)) / 10} km`} />
          </div>
        )}

        <div className="absolute bottom-4 left-3 z-[500] glass-soft rounded-xl px-3 py-2 text-[10.5px] text-slate-300 flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SAFEST_COLOR }} /> A · start</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> B · end</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-sky-300 bg-sky-300/30" /> junction (clickable)</span>
        </div>
      </div>
    </div>
  )
}

function catOf(risk) {
  if (risk < 0.3) return 'low'
  if (risk < 0.5) return 'moderate'
  if (risk < 0.7) return 'high'
  return 'very_high'
}

function EndpointRow({ letter, color, label, node, armed, onArm }) {
  return (
    <button
      onClick={onArm}
      className="w-full flex items-center gap-2.5 rounded-lg border p-2 transition text-left"
      style={{
        borderColor: armed ? color : 'rgba(255,255,255,0.1)',
        background: armed ? `${color}1a` : 'rgba(255,255,255,0.03)',
        boxShadow: armed ? `0 0 0 1px ${color}55` : 'none',
      }}
    >
      <span
        className="grid place-items-center h-7 w-7 rounded-full text-[12px] font-extrabold shrink-0"
        style={{ background: node ? color : 'rgba(255,255,255,0.1)', color: node ? '#060913' : '#8ea2bd' }}
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
        <span className="block text-[12.5px] font-medium text-slate-100 truncate">
          {node ? `Junction ${node.id}` : 'Click to choose…'}
        </span>
      </span>
      {armed && <Crosshair size={14} className="shrink-0 animate-pulse" style={{ color }} />}
    </button>
  )
}

function ModeCard({ active, onClick, color, icon, title, badge, stats }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border p-2.5 text-left transition"
      style={{
        borderColor: active ? color : 'rgba(255,255,255,0.1)',
        background: active ? `${color}14` : 'rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span className="text-[12.5px] font-semibold text-slate-100">{title}</span>
      </div>
      {badge && (
        <span className="mt-1 inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}22`, color }}>
          {badge}
        </span>
      )}
      <div className="mt-2 space-y-0.5 text-[10.5px] text-slate-400 tabular">
        <div className="flex justify-between"><span>Dist</span><span className="text-slate-200">{stats ? `${f2(stats.distance)} km` : '—'}</span></div>
        <div className="flex justify-between"><span>Time</span><span className="text-slate-200">{stats ? `${stats.minutes} min` : '—'}</span></div>
        <div className="flex justify-between"><span>Avg risk</span><span style={{ color: stats ? riskColor(stats.avgRisk) : undefined }}>{stats ? `${Math.round(stats.avgRisk * 100)}%` : '—'}</span></div>
      </div>
    </button>
  )
}

function LegendRow({ color, dash, label, value }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="8" className="shrink-0">
        <line x1="1" y1="4" x2="25" y2="4" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={dash ? '5 4' : null} opacity={dash ? 0.6 : 1} />
      </svg>
      <span className="flex-1 text-slate-300">{label}</span>
      <span className="tabular text-slate-100 font-medium">{value}</span>
    </div>
  )
}
