// Shared Recharts theming helpers for the dark UI
export const AXIS = { stroke: '#3b4a63', fontSize: 11, tick: { fill: '#7c8db0', fontSize: 11 } }
export const GRID = { stroke: 'rgba(255,255,255,0.06)', vertical: false }

export function ChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="glass rounded-lg px-3 py-2 shadow-glow border border-white/10">
      {label !== undefined && label !== null && (
        <div className="text-[11px] font-semibold text-slate-200 mb-1">{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill || p.stroke }} />
          <span className="text-slate-400">{p.name}</span>
          <span className="ml-auto tabular font-semibold text-slate-100">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  )
}

export const PIE_LABEL = {
  fill: '#cbd5e1',
  fontSize: 11,
}
