// ---------------------------------------------------------------------------
// Risk / domain helpers shared across the app
// ---------------------------------------------------------------------------

export const RISK_COLORS = {
  low: '#22c55e',
  moderate: '#eab308',
  high: '#f97316',
  very_high: '#ef4444',
}

export const RISK_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High',
}

export const RISK_ORDER = ['low', 'moderate', 'high', 'very_high']

export function riskCategory(risk) {
  if (risk < 0.3) return 'low'
  if (risk < 0.5) return 'moderate'
  if (risk < 0.7) return 'high'
  return 'very_high'
}

export function riskColor(risk) {
  return RISK_COLORS[riskCategory(risk)]
}

// Continuous green -> yellow -> orange -> red ramp for heat / gauges
export function riskRamp(t) {
  const stops = [
    [0.0, [34, 197, 94]],
    [0.35, [234, 179, 8]],
    [0.6, [249, 115, 22]],
    [1.0, [239, 68, 68]],
  ]
  t = Math.max(0, Math.min(1, t))
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1]
      const [p1, c1] = stops[i]
      const f = (t - p0) / (p1 - p0 || 1)
      const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
  return 'rgb(239,68,68)'
}

export const SEVERITY_COLORS = {
  Fatal: '#ef4444',
  Grievous: '#f97316',
  Minor: '#eab308',
  'Property Damage': '#38bdf8',
}
export const SEVERITY_ORDER = ['Fatal', 'Grievous', 'Minor', 'Property Damage']

export const ACCIDENT_TYPES = [
  'Two-wheeler',
  'Rear-end',
  'Side-impact',
  'Pedestrian',
  'Single-vehicle',
  'Rollover',
  'Head-on',
]

export const WEATHERS = ['Clear', 'Rain', 'Fog', 'Overcast']
export const LIGHTING = ['Daylight', 'Dawn/Dusk', 'Dark - lit', 'Dark - unlit']

export const ROAD_CLASS_COLORS = {
  highway: '#a78bfa',
  arterial: '#60a5fa',
  collector: '#38bdf8',
  residential: '#64748b',
}
export const ROAD_CLASS_WEIGHT = { highway: 6, arterial: 5, collector: 4, residential: 3 }

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const POI_COLORS = {
  school: '#f472b6',
  hospital: '#ef4444',
  market: '#f59e0b',
  mall: '#a78bfa',
  college: '#38bdf8',
  transit_hub: '#22c55e',
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`
export const num = (x) => (x == null ? '-' : Number(x).toLocaleString('en-US'))
export const f2 = (x) => (x == null ? '-' : Number(x).toFixed(2))
export const f3 = (x) => (x == null ? '-' : Number(x).toFixed(3))

export function hourLabel(h) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}${ampm}`
}

export function formatDate(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${hourLabel(d.getHours())}`
}

export function titleCase(s) {
  return String(s || '')
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// Clamp helper for the dual-range sliders
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
