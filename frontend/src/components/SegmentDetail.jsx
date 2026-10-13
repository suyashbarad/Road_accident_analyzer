import { useMemo } from 'react'
import { X, Crosshair, Route as RouteIcon, Flame, ArrowUpRight, ArrowDownRight, Gauge } from 'lucide-react'
import { useData } from '../data/DataContext'
import { Gauge as RiskGauge, Badge, KeyVal, MiniBar } from './ui'
import { RISK_COLORS, RISK_LABELS, SEVERITY_COLORS, SEVERITY_ORDER, num, f2, titleCase } from '../lib/risk'

function explanation(factors) {
  const ups = factors.filter((f) => f.direction === 'increase').map((f) => f.label.toLowerCase())
  if (!ups.length) return 'Risk is moderated by locally protective factors on this segment.'
  if (ups.length === 1) return `Elevated risk driven mainly by high ${ups[0]}.`
  return `Elevated risk driven by high ${ups.slice(0, -1).join(', ')} and ${ups[ups.length - 1]}.`
}

export default function SegmentDetail() {
  const { selectedSegment: s, setSelectedId, accidents, hotspots, requestFocus, navigate } = useData()

  const segAccidents = useMemo(() => (s ? accidents.filter((a) => a.seg_id === s.id) : []), [accidents, s])
  const sevBreak = useMemo(() => {
    const m = {}
    for (const a of segAccidents) m[a.severity] = (m[a.severity] || 0) + 1
    return m
  }, [segAccidents])

  const zone = useMemo(() => {
    if (!s) return null
    return hotspots.predicted.find((z) => z.segment_ids?.includes(s.id)) || null
  }, [hotspots, s])

  if (!s) return null
  const color = RISK_COLORS[s.category]
  const factors = s.factors || []
  const maxAbs = Math.max(0.0001, ...factors.map((f) => Math.abs(f.shap)))

  return (
    <div className="glass rounded-2xl shadow-glow w-[23rem] max-w-[92vw] h-full flex flex-col overflow-hidden animate-fadeUp">
      {/* header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-white/8 relative" style={{ background: `linear-gradient(180deg, ${color}18, transparent)` }}>
        <button
          onClick={() => setSelectedId(null)}
          className="absolute right-3 top-3 text-slate-400 hover:text-white transition p-1 rounded-md hover:bg-white/8"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Badge color={color}>{RISK_LABELS[s.category]} risk</Badge>
          <Badge color="#64748b">{titleCase(s.road_class)}</Badge>
        </div>
        <h2 className="text-[15px] font-bold text-slate-50 leading-tight pr-6">{s.name}</h2>
        <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">{s.id}</p>
      </div>

      <div className="overflow-y-auto px-4 py-3.5 space-y-4 flex-1">
        {/* gauge */}
        <div className="flex items-center gap-4">
          <RiskGauge value={s.risk} sub={RISK_LABELS[s.category]} size={124} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-slate-500">
              <Gauge size={12} /> Predicted for 2024
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Historical (≤2023)</span>
                <span className="tabular font-semibold text-slate-200">{s.hist_count}</span>
              </div>
              <MiniBar value={s.hist_count} max={Math.max(s.hist_count, s.future_count, 1)} color="#60a5fa" />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>Future window (2024)</span>
                <span className="tabular font-semibold text-slate-200">{s.future_count}</span>
              </div>
              <MiniBar value={s.future_count} max={Math.max(s.hist_count, s.future_count, 1)} color={color} />
            </div>
          </div>
        </div>

        {/* explanation */}
        <div className="rounded-xl border p-3" style={{ borderColor: `${color}44`, background: `${color}0f` }}>
          <div className="text-[10.5px] uppercase tracking-wider font-bold mb-1" style={{ color }}>
            Why this risk? (SHAP)
          </div>
          <p className="text-[12.5px] text-slate-200 leading-snug">{explanation(factors)}</p>
        </div>

        {/* contributing factors */}
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            Top contributing factors
          </div>
          <div className="space-y-2">
            {factors.map((f, i) => {
              const w = (Math.abs(f.shap) / maxAbs) * 50
              const inc = f.direction === 'increase'
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300 truncate pr-2">{f.label}</span>
                    <span className="tabular text-slate-400 shrink-0">{f.value}</span>
                  </div>
                  <div className="relative h-2.5 rounded bg-white/5">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                    <div
                      className="absolute top-0 bottom-0 rounded-full transition-all"
                      style={
                        inc
                          ? { left: '50%', width: `${w}%`, background: 'linear-gradient(90deg,#f97316,#ef4444)' }
                          : { right: '50%', width: `${w}%`, background: 'linear-gradient(90deg,#16a34a,#22c55e)' }
                      }
                    />
                    <span
                      className="absolute -top-0.5 text-[9px] font-bold flex items-center gap-0.5"
                      style={{ [inc ? 'left' : 'right']: `calc(50% + ${w}% + 4px)`, color: inc ? '#fca5a5' : '#86efac' }}
                    >
                      {inc ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                      {Math.abs(f.shap).toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
            {!factors.length && <p className="text-[11px] text-slate-500">No attribution available.</p>}
          </div>
        </div>

        {/* road attributes */}
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Road profile</div>
          <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-1">
            <KeyVal k="Lanes" v={s.lanes} />
            <KeyVal k="Speed limit" v={`${s.speed_limit} km/h`} />
            <KeyVal k="Traffic (AADT)" v={`${num(s.aadt)} veh/day`} />
            <KeyVal k="Congestion index" v={f2(s.congestion_index)} />
            <KeyVal k="Street lighting" v={`${Math.round(s.lighting * 100)}%`} />
            <KeyVal k="Signalised" v={s.has_signal ? 'Yes' : 'No'} />
            <KeyVal k="Length" v={`${f2(s.length_km)} km`} />
            <KeyVal k="Curvature" v={f2(s.curvature)} />
          </div>
        </div>

        {/* historical severity on this segment */}
        {segAccidents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Recorded accidents</span>
              <span className="text-[11px] tabular text-slate-300 font-semibold">{segAccidents.length}</span>
            </div>
            <div className="flex gap-1.5">
              {SEVERITY_ORDER.map((sev) => {
                const c = sevBreak[sev] || 0
                const p = segAccidents.length ? c / segAccidents.length : 0
                return (
                  <div key={sev} className="flex-1 text-center">
                    <div className="h-12 rounded-lg bg-white/5 flex items-end overflow-hidden">
                      <div className="w-full rounded-lg transition-all" style={{ height: `${Math.max(4, p * 100)}%`, background: SEVERITY_COLORS[sev] }} />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1 tabular">{c}</div>
                    <div className="text-[8.5px] text-slate-500 leading-tight">{sev.split(' ')[0]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="px-4 py-3 border-t border-white/8 grid grid-cols-3 gap-2">
        <button
          onClick={() => requestFocus(s.mid_lat, s.mid_lon, 16)}
          className="flex flex-col items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-white/4 hover:bg-white/8 border border-white/8 rounded-lg py-2 transition"
        >
          <Crosshair size={15} /> Center
        </button>
        <button
          onClick={() => navigate('routes')}
          className="flex flex-col items-center gap-1 text-[10px] text-slate-300 hover:text-white bg-white/4 hover:bg-white/8 border border-white/8 rounded-lg py-2 transition"
        >
          <RouteIcon size={15} /> Routes
        </button>
        <button
          onClick={() => zone && navigate('hotspots', { lat: zone.lat, lon: zone.lon, zoom: 15 })}
          disabled={!zone}
          className="flex flex-col items-center gap-1 text-[10px] bg-white/4 border border-white/8 rounded-lg py-2 transition disabled:opacity-40 enabled:hover:text-white enabled:hover:bg-white/8 text-slate-300"
        >
          <Flame size={15} /> {zone ? `Zone #${zone.rank}` : 'No zone'}
        </button>
      </div>
    </div>
  )
}
