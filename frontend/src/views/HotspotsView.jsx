import { useState } from 'react'
import { Flame, AlertTriangle, Sparkles, CheckCircle2, MapPin } from 'lucide-react'
import { useData } from '../data/DataContext'
import MapCanvas from '../components/map/MapCanvas'
import { Card, Stat, Badge } from '../components/ui'
import { RISK_COLORS, RISK_LABELS, SEVERITY_COLORS, SEVERITY_ORDER, titleCase, num } from '../lib/risk'

const LAYERS = {
  riskSegments: true,
  predHeat: false,
  histHeat: false,
  accidentPoints: false,
  histHotspots: true,
  predHotspots: true,
  pois: false,
}

function SeverityBar({ severity, total }) {
  return (
    <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-white/6">
      {SEVERITY_ORDER.map((s) => {
        const c = severity[s] || 0
        if (!c) return null
        return <div key={s} style={{ width: `${(c / (total || 1)) * 100}%`, background: SEVERITY_COLORS[s] }} />
      })}
    </div>
  )
}

export default function HotspotsView() {
  const { hotspots, segments, meta, graph, focus, navigate, segmentById } = useData()
  const [basemap, setBasemap] = useState('dark')

  const confirmed = hotspots.predicted.filter((z) => z.status === 'confirmed').length
  const emerging = hotspots.predicted.length - confirmed

  const topSegmentOf = (z) => {
    let best = null
    for (const id of z.segment_ids || []) {
      const s = segmentById.get(id)
      if (s && (!best || s.risk > best.risk)) best = s
    }
    return best
  }

  return (
    <div className="h-full flex">
      {/* lists */}
      <div className="w-[24rem] shrink-0 h-full overflow-y-auto p-4 space-y-4 border-r border-white/6">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-50 flex items-center gap-2">
            <Flame size={18} className="text-amber-400" /> Hotspot analysis
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Historical clusters (where accidents <em>did</em> happen) versus predicted zones (where the model expects{' '}
            <em>future</em> risk). Overlap = high-confidence; new = emerging.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="Historical" value={num(hotspots.historical.length)} icon={<Flame size={16} />} accent="#f59e0b" sub="density clusters" />
          <Stat label="Predicted" value={num(hotspots.predicted.length)} icon={<AlertTriangle size={16} />} accent="#a78bfa" sub="risk zones" />
          <Stat label="Confirmed" value={num(confirmed)} icon={<CheckCircle2 size={16} />} accent="#22c55e" sub="match history" />
          <Stat label="Emerging" value={num(emerging)} icon={<Sparkles size={16} />} accent="#7c3aed" sub="newly predicted" />
        </div>

        {/* predicted */}
        <Card title="Predicted risk zones" subtitle="From model output for 2024" bodyClass="p-2.5 space-y-2">
          {hotspots.predicted.map((z) => {
            const color = RISK_COLORS[z.category]
            const top = topSegmentOf(z)
            return (
              <div key={z.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5 hover:bg-white/6 transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-100">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.status === 'emerging' ? '#a78bfa' : color }} />
                    Zone #{z.rank}
                  </span>
                  <Badge color={z.status === 'emerging' ? '#a78bfa' : color}>
                    {z.status === 'emerging' ? '✦ Emerging' : '✓ Confirmed'}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div className="rounded-lg bg-white/4 py-1">
                    <div className="text-[9px] text-slate-500">Peak risk</div>
                    <div className="text-[13px] font-bold tabular" style={{ color }}>{Math.round(z.max_risk * 100)}%</div>
                  </div>
                  <div className="rounded-lg bg-white/4 py-1">
                    <div className="text-[9px] text-slate-500">Avg risk</div>
                    <div className="text-[13px] font-bold tabular text-slate-200">{Math.round(z.avg_risk * 100)}%</div>
                  </div>
                  <div className="rounded-lg bg-white/4 py-1">
                    <div className="text-[9px] text-slate-500">Segments</div>
                    <div className="text-[13px] font-bold tabular text-slate-200">{z.n_segments}</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1.5">
                  {z.status === 'confirmed'
                    ? `Near historical hotspot ${z.matched_hotspot} (${z.historical_count} accidents, ${z.match_distance_km} km)`
                    : `No historical cluster within ${z.match_distance_km ?? '—'} km — possible emerging risk`}
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => navigate('hotspots', { lat: z.lat, lon: z.lon, zoom: 15 })}
                    className="flex-1 text-[10.5px] py-1 rounded-lg border border-white/10 text-slate-300 hover:bg-white/8 transition flex items-center justify-center gap-1"
                  >
                    <MapPin size={11} /> Focus
                  </button>
                  {top && (
                    <button
                      onClick={() => navigate('map', { select: top.id, lat: top.mid_lat, lon: top.mid_lon, zoom: 16 })}
                      className="flex-1 text-[10.5px] py-1 rounded-lg border border-white/10 text-slate-300 hover:bg-white/8 transition"
                    >
                      Open worst road
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </Card>

        {/* historical */}
        <Card title="Historical hotspots" subtitle="Grid density clustering of recorded accidents" bodyClass="p-2.5 space-y-2">
          {hotspots.historical.slice(0, 12).map((h) => (
            <button
              key={h.id}
              onClick={() => navigate('hotspots', { lat: h.lat, lon: h.lon, zoom: 15 })}
              className="w-full text-left rounded-xl border border-amber-500/15 bg-amber-500/5 hover:bg-amber-500/10 p-2.5 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-amber-100">#{h.rank} · {h.count} accidents</span>
                <span className="text-[10.5px] text-amber-300/80">{h.fatal} fatal</span>
              </div>
              <div className="mt-1.5">
                <SeverityBar severity={h.severity} total={h.count} />
              </div>
              <div className="text-[10px] text-amber-200/60 mt-1">
                Dominant: {h.dominant_type} · radius {h.radius_km} km
              </div>
            </button>
          ))}
        </Card>
      </div>

      {/* map */}
      <div className="flex-1 relative min-w-0">
        <MapCanvas
          segments={segments}
          accidents={[]}
          pois={[]}
          hotspots={hotspots}
          nodes={graph.nodes}
          layers={LAYERS}
          basemap={basemap}
          center={meta.center}
          zoom={13}
          focus={focus}
          onSelect={() => {}}
        />
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
        <div className="absolute bottom-4 left-3 z-[500] glass-soft rounded-xl px-3 py-2 text-[10.5px] text-slate-300 space-y-1">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-amber-500" /> Historical hotspot</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-2 border-violet-400" /> Predicted / emerging zone</div>
          <div className="flex items-center gap-2"><span className="h-2.5 w-6 rounded-full" style={{ background: RISK_COLORS.very_high }} /> {RISK_LABELS.very_high} risk roads</div>
        </div>
      </div>
    </div>
  )
}
