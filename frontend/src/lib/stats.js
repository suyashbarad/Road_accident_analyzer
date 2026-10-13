// ---------------------------------------------------------------------------
// Aggregation helpers - recompute analytics from the (filtered) accident list
// ---------------------------------------------------------------------------
import { DAY_NAMES, MONTH_NAMES, SEVERITY_ORDER, ACCIDENT_TYPES, WEATHERS, LIGHTING, hourLabel } from './risk'

export function aggregate(accidents) {
  const byHour = Array.from({ length: 24 }, (_, h) => ({ key: h, label: hourLabel(h), count: 0, fatal: 0 }))
  const byWeekday = DAY_NAMES.map((d, i) => ({ key: i, label: d, count: 0, fatal: 0 }))
  const byMonth = MONTH_NAMES.map((m, i) => ({ key: i + 1, label: m, count: 0, fatal: 0 }))
  const bySeverity = {}
  const byType = {}
  const byWeather = {}
  const byLighting = {}
  const byRoadClass = {}

  let fatal = 0
  let grievous = 0
  let night = 0
  let monsoon = 0
  let weekend = 0

  for (const a of accidents) {
    byHour[a.hour].count++
    byWeekday[a.weekday].count++
    byMonth[a.month - 1].count++
    bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1
    byType[a.type] = (byType[a.type] || 0) + 1
    byWeather[a.weather] = (byWeather[a.weather] || 0) + 1
    byLighting[a.lighting] = (byLighting[a.lighting] || 0) + 1
    byRoadClass[a.road_class] = (byRoadClass[a.road_class] || 0) + 1
    if (a.severity === 'Fatal') {
      fatal++
      byHour[a.hour].fatal++
      byWeekday[a.weekday].fatal++
      byMonth[a.month - 1].fatal++
    }
    if (a.severity === 'Grievous') grievous++
    if (a.is_night) night++
    if (a.is_monsoon) monsoon++
    if (a.is_weekend) weekend++
  }

  return {
    total: accidents.length,
    fatal,
    grievous,
    night,
    monsoon,
    weekend,
    byHour,
    byWeekday,
    byMonth,
    bySeverity: SEVERITY_ORDER.filter((s) => bySeverity[s]).map((s) => ({ name: s, value: bySeverity[s] })),
    byType: ACCIDENT_TYPES.filter((t) => byType[t])
      .map((t) => ({ name: t, value: byType[t] }))
      .sort((a, b) => b.value - a.value),
    byWeather: WEATHERS.filter((w) => byWeather[w]).map((w) => ({ name: w, value: byWeather[w] })),
    byLighting: LIGHTING.filter((l) => byLighting[l]).map((l) => ({ name: l, value: byLighting[l] })),
    byRoadClass: Object.entries(byRoadClass).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  }
}

// Risk distribution across segments (for the histogram / donut)
export function riskHistogram(segments, bins = 10) {
  const out = Array.from({ length: bins }, (_, i) => ({
    label: `${Math.round((i / bins) * 100)}-${Math.round(((i + 1) / bins) * 100)}%`,
    lo: i / bins,
    hi: (i + 1) / bins,
    count: 0,
  }))
  for (const s of segments) {
    const idx = Math.min(bins - 1, Math.floor(s.risk * bins))
    out[idx].count++
  }
  return out
}
