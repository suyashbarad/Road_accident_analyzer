import { useMemo, useRef, useState, useEffect } from 'react'
import {
  Search,
  Map as MapIcon,
  BarChart3,
  Boxes,
  Lightbulb,
  Flame,
  Route as RouteIcon,
  BookOpen,
  ShieldCheck,
  Cpu,
  X,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import { RISK_COLORS, RISK_LABELS } from '../lib/risk'

const TABS = [
  { key: 'map', label: 'Explore', icon: MapIcon },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'models', label: 'Models', icon: Boxes },
  { key: 'explain', label: 'Explainability', icon: Lightbulb },
  { key: 'hotspots', label: 'Hotspots', icon: Flame },
  { key: 'routes', label: 'Routes', icon: RouteIcon },
  { key: 'method', label: 'Method', icon: BookOpen },
]

export default function Header() {
  const { view, setView, navigate, segments, pois, meta, apiOnline, filteredAccidents } = useData()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    const segs = segments
      .filter((s) => s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query))
      .slice(0, 5)
      .map((s) => ({ kind: 'Road', name: s.name, sub: `${RISK_LABELS[s.category]} risk · ${Math.round(s.risk * 100)}%`, color: RISK_COLORS[s.category], go: () => navigate('map', { select: s.id, lat: s.mid_lat, lon: s.mid_lon, zoom: 16 }) }))
    const ps = pois
      .filter((p) => p.name.toLowerCase().includes(query) || p.type.includes(query))
      .slice(0, 4)
      .map((p) => ({ kind: 'Place', name: p.name, sub: p.type.replace('_', ' '), color: '#22c55e', go: () => navigate('map', { lat: p.lat, lon: p.lon, zoom: 16 }) }))
    return [...segs, ...ps]
  }, [q, segments, pois, navigate])

  return (
    <header className="relative z-30 shrink-0">
      {/* top row */}
      <div className="flex items-center gap-4 px-4 h-14 glass border-b border-white/8">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-xl grid place-items-center bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/20">
            <ShieldCheck size={19} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">
              Risk<span className="text-gradient">Sense</span> AI
            </div>
            <div className="text-[9.5px] text-slate-400 -mt-0.5 hidden sm:block">
              Spatio-Temporal Accident Risk & Hotspot Mapping
            </div>
          </div>
        </div>

        {/* search */}
        <div className="relative flex-1 max-w-md ml-auto" ref={boxRef}>
          <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 focus-within:border-brand-400/60 transition">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              placeholder="Search roads, places, segments…"
              className="bg-transparent outline-none text-[12.5px] text-slate-100 placeholder:text-slate-500 w-full"
            />
            {q && (
              <button onClick={() => setQ('')} className="text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          {open && results.length > 0 && (
            <div className="absolute top-full mt-2 w-full glass rounded-xl border border-white/10 shadow-glow overflow-hidden">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    r.go()
                    setOpen(false)
                    setQ('')
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/6 transition text-left border-b border-white/5 last:border-0"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="min-w-0">
                    <span className="block text-[12.5px] text-slate-100 truncate">{r.name}</span>
                    <span className="block text-[10.5px] text-slate-500 capitalize truncate">
                      {r.kind} · {r.sub}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* status */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1.5 rounded-lg bg-white/4 border border-white/8 text-slate-300">
            <Cpu size={13} className="text-brand-300" />
            {meta?.best_model || 'Model'}
          </span>
          <span
            className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-1.5 rounded-lg border"
            style={{
              background: apiOnline ? 'rgba(34,197,94,.12)' : 'rgba(148,163,184,.1)',
              borderColor: apiOnline ? 'rgba(34,197,94,.4)' : 'rgba(255,255,255,.08)',
              color: apiOnline ? '#86efac' : '#94a3b8',
            }}
            title={apiOnline ? 'FastAPI live-inference backend connected' : 'Running on pre-computed model outputs (static mode)'}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: apiOnline ? '#22c55e' : '#64748b' }} />
            {apiOnline ? 'API live' : 'Static model'}
          </span>
        </div>
      </div>

      {/* nav tabs */}
      <nav className="flex items-center gap-1 px-3 h-11 glass-soft border-b border-white/8 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = view === t.key
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition ${
                active ? 'text-white bg-white/8' : 'text-slate-400 hover:text-slate-100 hover:bg-white/4'
              }`}
            >
              <Icon size={14} className={active ? 'text-brand-300' : ''} />
              {t.label}
              {active && <span className="absolute -bottom-[7px] left-2 right-2 h-0.5 rounded-full bg-brand-400" />}
            </button>
          )
        })}
        <div className="ml-auto hidden md:flex items-center gap-3 pr-2 text-[10.5px] text-slate-500 shrink-0">
          <span>
            <span className="text-brand-300 font-semibold tabular">{filteredAccidents.length.toLocaleString()}</span> accidents in view
          </span>
        </div>
      </nav>
    </header>
  )
}
