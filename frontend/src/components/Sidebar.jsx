import { useState } from 'react'
import {
  Layers,
  Map as MapIcon,
  Flame,
  Radar,
  AlertTriangle,
  Landmark,
  Crosshair,
  ChevronDown,
  Activity,
  SlidersHorizontal,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import { Toggle } from './ui'
import Filters from './Filters'
import { RISK_COLORS, RISK_LABELS, RISK_ORDER, num } from '../lib/risk'

const BASEMAPS = [
  { key: 'dark', label: 'Dark' },
  { key: 'streets', label: 'Streets' },
  { key: 'light', label: 'Light' },
  { key: 'satellite', label: 'Satellite' },
]

function Section({ title, icon, children, defaultOpen = true, right }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-white/6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-white/3 transition"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
          <span className="text-brand-300">{icon}</span>
          {title}
        </span>
        <span className="flex items-center gap-2">
          {right}
          <ChevronDown size={15} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="px-3.5 pb-3.5 pt-0.5">{children}</div>}
    </div>
  )
}

const LAYER_DEFS = [
  { key: 'riskSegments', label: 'Predicted road risk', hint: 'Colour-coded segments', icon: <Activity size={14} />, color: '#2f8bff' },
  { key: 'predHeat', label: 'Predicted risk heat', hint: 'Model risk surface', icon: <Radar size={14} />, color: '#f97316' },
  { key: 'histHeat', label: 'Accident density heat', hint: 'Historical points', icon: <Flame size={14} />, color: '#ef4444' },
  { key: 'accidentPoints', label: 'Accident markers', hint: 'Filtered records', icon: <Crosshair size={14} />, color: '#eab308' },
  { key: 'histHotspots', label: 'Historical hotspots', hint: 'Density clusters', icon: <Flame size={14} />, color: '#f59e0b' },
  { key: 'predHotspots', label: 'Predicted hotspots', hint: 'Risk zones', icon: <AlertTriangle size={14} />, color: '#a78bfa' },
  { key: 'pois', label: 'Points of interest', hint: 'Schools, hospitals…', icon: <Landmark size={14} />, color: '#22c55e' },
]

export default function Sidebar({ layers, setLayers, basemap, setBasemap, minRisk, setMinRisk }) {
  const { segments, hotspots, meta, navigate } = useData()

  const catCounts = RISK_ORDER.reduce((acc, k) => ({ ...acc, [k]: 0 }), {})
  for (const s of segments) catCounts[s.category] = (catCounts[s.category] || 0) + 1

  const toggle = (key) => setLayers((l) => ({ ...l, [key]: !l[key] }))

  return (
    <aside className="w-[19rem] shrink-0 h-full overflow-y-auto glass border-r border-white/6">
      <div className="px-3.5 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <MapIcon size={15} className="text-brand-300" />
          <h2 className="text-[13px] font-bold tracking-tight text-slate-100">Map Controls</h2>
        </div>
        <p className="text-[10.5px] text-slate-500 mt-0.5">
          {meta ? `${meta.city}, ${meta.country}` : 'Study area'} · {num(segments.length)} road segments ·{' '}
          {num(meta?.counts?.accidents || 0)} accidents
        </p>
      </div>

      {/* ---------------- Layers ---------------- */}
      <Section title="Map layers" icon={<Layers size={14} />}>
        <div className="space-y-0.5">
          {LAYER_DEFS.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span style={{ color: d.color }} className="shrink-0">
                {d.icon}
              </span>
              <Toggle checked={!!layers[d.key]} onChange={() => toggle(d.key)} label={d.label} hint={d.hint} color={d.color} />
            </div>
          ))}
        </div>
      </Section>

      {/* ---------------- Basemap ---------------- */}
      <Section title="Basemap" icon={<MapIcon size={14} />}>
        <div className="grid grid-cols-4 gap-1.5">
          {BASEMAPS.map((b) => (
            <button
              key={b.key}
              onClick={() => setBasemap(b.key)}
              className={`text-[10.5px] font-medium rounded-lg py-1.5 border transition ${
                basemap === b.key
                  ? 'bg-brand-500/20 border-brand-400/60 text-white'
                  : 'bg-white/3 border-white/8 text-slate-400 hover:text-white'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10.5px] text-slate-400 mb-1.5">
            <span className="font-bold uppercase tracking-wider text-slate-500">Emphasise risk ≥</span>
            <span className="tabular text-slate-200 font-semibold">{Math.round(minRisk * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.95}
            step={0.05}
            value={minRisk}
            onChange={(e) => setMinRisk(+e.target.value)}
            className="range-track w-full"
          />
          <p className="text-[10px] text-slate-500 mt-1">Dims lower-risk roads to spotlight danger zones.</p>
        </div>
      </Section>

      {/* ---------------- Legend ---------------- */}
      <Section title="Risk legend" icon={<Radar size={14} />}>
        <div className="space-y-1.5">
          {RISK_ORDER.map((k) => (
            <div key={k} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[11.5px] text-slate-300">
                <span
                  className="h-2.5 w-6 rounded-full"
                  style={{ background: RISK_COLORS[k], boxShadow: `0 0 8px ${RISK_COLORS[k]}88` }}
                />
                {RISK_LABELS[k]}
              </span>
              <span className="text-[11px] tabular text-slate-400">{catCounts[k] || 0}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2.5 border-t border-white/6 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-amber-500" /> Historical
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-violet-400" /> Emerging
          </div>
        </div>
      </Section>

      {/* ---------------- Filters ---------------- */}
      <Section title="Spatio-temporal filters" icon={<SlidersHorizontal size={14} />} defaultOpen={false}>
        <Filters />
      </Section>

      {/* ---------------- Hotspots ---------------- */}
      <Section title="Jump to hotspot" icon={<Flame size={14} />} defaultOpen={false}>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {hotspots.predicted.slice(0, 6).map((z) => (
            <button
              key={z.id}
              onClick={() => navigate('map', { lat: z.lat, lon: z.lon, zoom: 15 })}
              className="w-full text-left rounded-lg border border-white/8 bg-white/3 hover:bg-white/6 px-2.5 py-1.5 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-200">
                  {z.status === 'emerging' ? '✦ Emerging' : '✓ Confirmed'} zone #{z.rank}
                </span>
                <span className="text-[11px] font-bold tabular" style={{ color: RISK_COLORS[z.category] }}>
                  {Math.round(z.max_risk * 100)}%
                </span>
              </div>
              <div className="text-[10px] text-slate-500">{z.n_segments} high-risk segments</div>
            </button>
          ))}
          {hotspots.historical.slice(0, 4).map((h) => (
            <button
              key={h.id}
              onClick={() => navigate('map', { lat: h.lat, lon: h.lon, zoom: 15 })}
              className="w-full text-left rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 px-2.5 py-1.5 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-amber-200">Historical #{h.rank}</span>
                <span className="text-[11px] font-bold tabular text-amber-300">{h.count}</span>
              </div>
              <div className="text-[10px] text-amber-200/50">{h.fatal} fatal · {h.dominant_type}</div>
            </button>
          ))}
        </div>
      </Section>
    </aside>
  )
}
