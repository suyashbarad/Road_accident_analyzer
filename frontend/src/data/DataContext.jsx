import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { SEVERITY_ORDER, ACCIDENT_TYPES, WEATHERS, LIGHTING } from '../lib/risk'
import { buildAdjacency } from '../lib/routing'

const DataCtx = createContext(null)
export const useData = () => useContext(DataCtx)

const FILES = [
  'meta',
  'segments',
  'accidents',
  'pois',
  'hotspots',
  'models',
  'experiments',
  'feature_importance',
  'shap',
  'graph',
]

const ROAD_CLASSES = ['highway', 'arterial', 'collector', 'residential']

export const DEFAULT_FILTERS = {
  years: [2022, 2024],
  months: [1, 12],
  hours: [0, 23],
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  severities: [...SEVERITY_ORDER],
  types: [...ACCIDENT_TYPES],
  weathers: [...WEATHERS],
  lighting: [...LIGHTING],
  roadClasses: [...ROAD_CLASSES],
  onlyNight: false,
  minRisk: 0,
}

function applyFilters(accidents, f) {
  const out = []
  for (let i = 0; i < accidents.length; i++) {
    const a = accidents[i]
    if (a.year < f.years[0] || a.year > f.years[1]) continue
    if (a.month < f.months[0] || a.month > f.months[1]) continue
    if (a.hour < f.hours[0] || a.hour > f.hours[1]) continue
    if (!f.weekdays.includes(a.weekday)) continue
    if (!f.severities.includes(a.severity)) continue
    if (!f.types.includes(a.type)) continue
    if (!f.weathers.includes(a.weather)) continue
    if (!f.lighting.includes(a.lighting)) continue
    if (!f.roadClasses.includes(a.road_class)) continue
    if (f.onlyNight && !a.is_night) continue
    out.push(a)
  }
  return out
}

export function DataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('map')
  const [focus, setFocus] = useState(null)
  const [apiOnline, setApiOnline] = useState(false)

  // ---- load the ML-generated JSON bundle ----
  useEffect(() => {
    let cancelled = false
    const base = import.meta.env.BASE_URL || '/'
    Promise.all(
      FILES.map((f) =>
        fetch(`${base}data/${f}.json`).then((r) => {
          if (!r.ok) throw new Error(`${f}.json -> HTTP ${r.status}`)
          return r.json()
        }),
      ),
    )
      .then((results) => {
        if (cancelled) return
        const data = {}
        FILES.forEach((f, i) => (data[f] = results[i]))
        setState({ loading: false, error: null, data })
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: String(err?.message || err), data: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- probe the optional FastAPI live-inference backend ----
  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    fetch('/api/health', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setApiOnline(!!j?.status))
      .catch(() => setApiOnline(false))
      .finally(() => clearTimeout(t))
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [])

  const derived = useMemo(() => {
    const d = state.data
    if (!d) return null
    const segmentById = new Map(d.segments.map((s) => [s.id, s]))
    const nodeById = new Map(d.graph.nodes.map((n) => [n.id, n]))
    const adjacency = buildAdjacency(d.graph)
    return { segmentById, nodeById, adjacency }
  }, [state.data])

  const filteredAccidents = useMemo(() => {
    if (!state.data) return []
    return applyFilters(state.data.accidents, filters)
  }, [state.data, filters])

  const updateFilter = useCallback((patch) => {
    setFilters((f) => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }))
  }, [])

  const toggleInArray = useCallback((key, value, universe) => {
    setFilters((f) => {
      const arr = f[key]
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      return { ...f, [key]: next.length ? next : [] }
      // (empty array = nothing selected; universe available for "select all")
    })
    void universe
  }, [])

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [])

  const selectedSegment = useMemo(() => {
    if (!derived || !selectedId) return null
    return derived.segmentById.get(selectedId) || null
  }, [derived, selectedId])

  // Navigate to a view and optionally fly the map somewhere / select a segment
  const navigate = useCallback((nextView, opts = {}) => {
    setView(nextView)
    if (opts.select !== undefined) setSelectedId(opts.select)
    if (opts.lat != null && opts.lon != null) {
      setFocus({ lat: opts.lat, lon: opts.lon, zoom: opts.zoom ?? 15, ts: Date.now() })
    }
  }, [])

  const requestFocus = useCallback((lat, lon, zoom = 15) => {
    setFocus({ lat, lon, zoom, ts: Date.now() })
  }, [])

  const value = useMemo(
    () => ({
      loading: state.loading,
      error: state.error,
      ...(state.data || {}),
      meta: state.data?.meta,
      segmentById: derived?.segmentById,
      nodeById: derived?.nodeById,
      adjacency: derived?.adjacency,
      filters,
      setFilters,
      updateFilter,
      toggleInArray,
      resetFilters,
      filteredAccidents,
      selectedId,
      setSelectedId,
      selectedSegment,
      view,
      setView,
      navigate,
      focus,
      requestFocus,
      apiOnline,
    }),
    [state, derived, filters, filteredAccidents, selectedId, selectedSegment, view, focus, apiOnline, navigate, requestFocus, updateFilter, toggleInArray, resetFilters],
  )

  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}
