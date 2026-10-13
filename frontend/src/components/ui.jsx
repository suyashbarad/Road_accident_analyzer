import React from 'react'
import { riskColor } from '../lib/risk'

/* ------------------------------------------------------------------ Card */
export function Card({ title, subtitle, icon, right, children, className = '', bodyClass = 'p-4' }) {
  return (
    <section className={`glass rounded-2xl shadow-card overflow-hidden ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-brand-300 shrink-0">{icon}</span>}
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold tracking-tight text-slate-100 truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          {right}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ Stat */
export function Stat({ label, value, sub, icon, accent = '#7cc0ff', className = '' }) {
  return (
    <div className={`glass rounded-xl px-3.5 py-3 flex items-start gap-3 ${className}`}>
      {icon && (
        <span
          className="grid place-items-center h-9 w-9 rounded-lg shrink-0"
          style={{ background: `${accent}1f`, color: accent }}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 truncate">{label}</div>
        <div className="text-xl font-bold tabular leading-tight text-slate-50">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 truncate">{sub}</div>}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Badge */
export function Badge({ children, color = '#7cc0ff', className = '', solid = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${className}`}
      style={
        solid
          ? { background: color, color: '#060913' }
          : { background: `${color}1f`, color, border: `1px solid ${color}44` }
      }
    >
      {children}
    </span>
  )
}

/* ----------------------------------------------------------------- Chip */
export function Chip({ active, onClick, children, color = '#2f8bff', title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all border"
      style={
        active
          ? { background: `${color}26`, borderColor: `${color}88`, color: '#eaf2ff' }
          : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)', color: '#8ea2bd' }
      }
    >
      {children}
    </button>
  )
}

/* ---------------------------------------------------------------- Toggle */
export function Toggle({ checked, onChange, label, hint, color = '#2f8bff' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 py-1.5 group"
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] text-slate-200 group-hover:text-white truncate">{label}</span>
        {hint && <span className="block text-[10.5px] text-slate-500 truncate">{hint}</span>}
      </span>
      <span
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
        style={{ background: checked ? color : 'rgba(255,255,255,0.14)' }}
      >
        <span
          className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow"
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(3px)' }}
        />
      </span>
    </button>
  )
}

/* ------------------------------------------------------------- DualRange */
export function DualRange({ min, max, step = 1, value, onChange, format = (v) => v }) {
  const [lo, hi] = value
  const span = max - min || 1
  const loPct = ((lo - min) / span) * 100
  const hiPct = ((hi - min) / span) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
        <span className="tabular text-slate-200 font-medium">{format(lo)}</span>
        <span className="tabular text-slate-200 font-medium">{format(hi)}</span>
      </div>
      <div className="dual-range">
        <div className="dr-track" />
        <div className="dr-fill" style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => onChange([Math.min(+e.target.value, hi), hi])}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(+e.target.value, lo)])}
        />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Gauge */
export function Gauge({ value, size = 132, label = 'Risk score', sub }) {
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  const pctv = Math.max(0, Math.min(1, value))
  const color = riskColor(value)
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.09)" strokeWidth="10" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pctv)}
          style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s', filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
        <div className="text-3xl font-extrabold tabular" style={{ color }}>
          {Math.round(value * 100)}
        </div>
        <div className="text-[10.5px] font-semibold" style={{ color }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- MiniBar */
export function MiniBar({ value, max = 1, color = '#2f8bff', height = 6 }) {
  return (
    <div className="w-full rounded-full bg-white/8 overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.max(0, Math.min(1, value / (max || 1))) * 100}%`, background: color }}
      />
    </div>
  )
}

/* -------------------------------------------------------------- KeyVal */
export function KeyVal({ k, v, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b border-white/5 last:border-0">
      <span className="text-[11.5px] text-slate-400">{k}</span>
      <span className={`text-[12px] font-medium text-slate-100 ${mono ? 'font-mono' : ''}`}>{v}</span>
    </div>
  )
}

/* ------------------------------------------------------------- Spinner */
export function Spinner({ label = 'Loading model outputs…' }) {
  return (
    <div className="h-full w-full grid place-items-center">
      <div className="text-center">
        <div className="mx-auto h-11 w-11 rounded-full border-2 border-white/12 border-t-brand-400 animate-spin" />
        <p className="mt-4 text-sm text-slate-400">{label}</p>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- SectionTitle */
export function SectionTitle({ children, right, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-3 ${className}`}>
      <h2 className="text-sm font-semibold tracking-tight text-slate-200">{children}</h2>
      {right}
    </div>
  )
}

/* ------------------------------------------------------------- EmptyMsg */
export function EmptyMsg({ children }) {
  return <div className="text-[12px] text-slate-500 italic py-6 text-center">{children}</div>
}
