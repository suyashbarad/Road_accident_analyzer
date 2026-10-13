import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { heatLayer } from '../../lib/heatLayer'
import {
  riskColor,
  riskRamp,
  SEVERITY_COLORS,
  ROAD_CLASS_WEIGHT,
  POI_COLORS,
  RISK_LABELS,
  titleCase,
} from '../../lib/risk'

const BASEMAPS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
}

const SEV_RADIUS = { Fatal: 5.5, Grievous: 4.4, Minor: 3.4, 'Property Damage': 3 }

export default function MapCanvas({
  segments = [],
  accidents = [],
  pois = [],
  hotspots = { historical: [], predicted: [] },
  nodes = [],
  layers = {},
  basemap = 'dark',
  center = [18.5204, 73.8567],
  zoom = 13,
  selectedId = null,
  onSelect = () => {},
  focus = null,
  routes = [],
  markers = [],
  showNodes = false,
  onNodeClick = null,
  onMapClick = null,
  minRisk = 0,
  className = '',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const accRenderer = useRef(null)
  const tileRef = useRef(null)
  const groups = useRef({})
  const heat = useRef({ hist: null, pred: null })
  const mounted = useRef(false)
  // Keep the latest click callbacks in a ref so the once-bound Leaflet
  // listeners never go stale (important for the Route planner view).
  const cbRef = useRef({ onMapClick, onNodeClick })
  useEffect(() => {
    cbRef.current = { onMapClick, onNodeClick }
  })

  /* ------------------------------ mount ------------------------------ */
  useEffect(() => {
    if (mounted.current || !containerRef.current) return
    mounted.current = true
    const map = L.map(containerRef.current, {
      center,
      zoom,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
    })
    mapRef.current = map

    // custom panes for correct z-order
    map.createPane('heatPane')
    map.getPane('heatPane').style.zIndex = 350
    map.getPane('heatPane').style.pointerEvents = 'none'
    map.createPane('routePane')
    map.getPane('routePane').style.zIndex = 450
    map.createPane('hotspotPane')
    map.getPane('hotspotPane').style.zIndex = 420

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map)

    accRenderer.current = L.canvas({ padding: 0.5 })

    const g = groups.current
    g.seg = L.layerGroup().addTo(map)
    g.sel = L.layerGroup().addTo(map)
    g.acc = L.layerGroup().addTo(map)
    g.histHs = L.layerGroup().addTo(map)
    g.predHs = L.layerGroup().addTo(map)
    g.poi = L.layerGroup().addTo(map)
    g.route = L.layerGroup({ pane: 'routePane' }).addTo(map)
    g.node = L.layerGroup().addTo(map)
    g.marker = L.layerGroup().addTo(map)

    heat.current.hist = heatLayer([], { pane: 'heatPane', radius: 24, blur: 16, opacity: 0.85 })
    heat.current.pred = heatLayer([], {
      pane: 'heatPane',
      radius: 34,
      blur: 24,
      opacity: 0.7,
      gradient: { 0.2: 'rgba(34,197,94,0.0)', 0.45: '#eab308', 0.7: '#f97316', 1.0: '#ef4444' },
    })

    map.on('click', (e) => cbRef.current.onMapClick?.(e.latlng.lat, e.latlng.lng))

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(containerRef.current)
    setTimeout(() => map.invalidateSize(), 60)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      mounted.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------------ basemap ---------------------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const cfg = BASEMAPS[basemap] || BASEMAPS.dark
    if (tileRef.current) map.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
      crossOrigin: true,
    }).addTo(map)
    tileRef.current.bringToBack()
  }, [basemap])

  /* --------------------------- risk segments ------------------------- */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.seg
    if (!map || !g) return
    g.clearLayers()
    if (!layers.riskSegments) return
    for (const s of segments) {
      const dim = minRisk > 0 && s.risk < minRisk
      const color = riskColor(s.risk)
      const weight = ROAD_CLASS_WEIGHT[s.road_class] || 4
      // neon halo for dangerous segments
      if (s.risk >= 0.5 && !dim) {
        L.polyline(s.coords, {
          color,
          weight: weight + 7,
          opacity: 0.16,
          lineCap: 'round',
          interactive: false,
        }).addTo(g)
      }
      const line = L.polyline(s.coords, {
        color: dim ? '#334155' : color,
        weight,
        opacity: dim ? 0.3 : 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      })
      line.bindTooltip(
        `<div style="font-weight:600">${s.name}</div>
         <div style="opacity:.8">${titleCase(s.road_class)} · ${s.length_km.toFixed(2)} km</div>
         <div style="margin-top:3px;color:${color};font-weight:700">
           Risk ${Math.round(s.risk * 100)}% · ${RISK_LABELS[s.category]}</div>`,
        { className: 'risk-tip', sticky: true, direction: 'top' },
      )
      line.on('click', () => onSelect(s.id))
      line.addTo(g)
    }
  }, [segments, layers.riskSegments, minRisk, onSelect])

  /* ---------------------------- selection ---------------------------- */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.sel
    if (!map || !g) return
    g.clearLayers()
    if (!selectedId) return
    const s = segments.find((x) => x.id === selectedId)
    if (!s) return
    const color = riskColor(s.risk)
    L.polyline(s.coords, { color: '#ffffff', weight: 11, opacity: 0.9, lineCap: 'round' }).addTo(g)
    L.polyline(s.coords, { color, weight: 7, opacity: 1, lineCap: 'round' }).addTo(g)
    const pulse = L.circleMarker([s.mid_lat, s.mid_lon], {
      radius: 8,
      color: '#fff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    }).addTo(g)
    pulse.bindTooltip(
      `<div style="font-weight:700">${s.name}</div><div style="color:${color}">Risk ${Math.round(s.risk * 100)}%</div>`,
      { className: 'risk-tip', direction: 'top', offset: [0, -6] },
    )
  }, [selectedId, segments])

  /* --------------------- accidents + historical heat ------------------ */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.acc
    if (!map || !g) return
    g.clearLayers()

    const pts = []
    for (const a of accidents) pts.push([a.lat, a.lon, 0.55])
    if (heat.current.hist) {
      heat.current.hist.setData(pts)
      if (layers.histHeat) {
        if (!map.hasLayer(heat.current.hist)) heat.current.hist.addTo(map)
        heat.current.hist._redraw && heat.current.hist._redraw()
      } else if (map.hasLayer(heat.current.hist)) {
        map.removeLayer(heat.current.hist)
      }
    }

    if (!layers.accidentPoints) return
    const renderer = accRenderer.current
    for (const a of accidents) {
      const m = L.circleMarker([a.lat, a.lon], {
        renderer,
        radius: SEV_RADIUS[a.severity] || 3.2,
        color: 'rgba(6,9,19,0.6)',
        weight: 0.6,
        fillColor: SEVERITY_COLORS[a.severity] || '#94a3b8',
        fillOpacity: 0.85,
      })
      m.bindTooltip(
        `<div style="font-weight:600">${a.severity} · ${a.type}</div>
         <div style="opacity:.8">${new Date(a.ts).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
         <div style="opacity:.7">${a.weather} · ${a.lighting}</div>`,
        { className: 'risk-tip', direction: 'top' },
      )
      m.on('click', () => onSelect(a.seg_id))
      m.addTo(g)
    }
  }, [accidents, layers.accidentPoints, layers.histHeat, onSelect])

  /* ------------------------- predicted risk heat ---------------------- */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !heat.current.pred) return
    const pts = segments.map((s) => [s.mid_lat, s.mid_lon, Math.max(0.15, s.risk)])
    heat.current.pred.setData(pts)
    if (layers.predHeat) {
      if (!map.hasLayer(heat.current.pred)) heat.current.pred.addTo(map)
      heat.current.pred._redraw && heat.current.pred._redraw()
    } else if (map.hasLayer(heat.current.pred)) {
      map.removeLayer(heat.current.pred)
    }
  }, [segments, layers.predHeat])

  /* ----------------------------- hotspots ----------------------------- */
  useEffect(() => {
    const map = mapRef.current
    const gh = groups.current.histHs
    const gp = groups.current.predHs
    if (!map || !gh || !gp) return
    gh.clearLayers()
    gp.clearLayers()

    if (layers.histHotspots) {
      for (const h of hotspots.historical) {
        const c = L.circle([h.lat, h.lon], {
          pane: 'hotspotPane',
          radius: Math.max(180, h.radius_km * 1000),
          color: '#f59e0b',
          weight: 1.5,
          dashArray: '4 4',
          fillColor: '#f59e0b',
          fillOpacity: 0.08 + 0.12 * h.intensity,
        })
        c.bindTooltip(
          `<div style="font-weight:700;color:#f59e0b">Historical hotspot #${h.rank}</div>
           <div>${h.count} accidents · ${h.fatal} fatal</div>
           <div style="opacity:.8">Dominant: ${h.dominant_type}</div>`,
          { className: 'risk-tip', sticky: true },
        )
        c.addTo(gh)
      }
    }

    if (layers.predHotspots) {
      for (const z of hotspots.predicted) {
        const color = riskColor(z.max_risk)
        const c = L.circle([z.lat, z.lon], {
          pane: 'hotspotPane',
          radius: Math.max(220, z.radius_km * 1000),
          color: z.status === 'emerging' ? '#a78bfa' : color,
          weight: 2,
          fillColor: z.status === 'emerging' ? '#a78bfa' : color,
          fillOpacity: 0.12,
        })
        c.bindTooltip(
          `<div style="font-weight:700;color:${color}">Predicted zone #${z.rank} · ${RISK_LABELS[z.category]}</div>
           <div>Peak risk ${Math.round(z.max_risk * 100)}% · ${z.n_segments} segments</div>
           <div style="opacity:.85">${z.status === 'confirmed' ? '✓ Confirmed by history' : '✦ Emerging hotspot'}</div>`,
          { className: 'risk-tip', sticky: true },
        )
        c.addTo(gp)
        // centre label
        L.marker([z.lat, z.lon], {
          pane: 'hotspotPane',
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<div style="transform:translate(-50%,-50%);font:700 10px Inter,sans-serif;color:#fff;background:${
              z.status === 'emerging' ? '#7c3aed' : color
            };padding:2px 6px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.5)">P${z.rank}</div>`,
            iconSize: [0, 0],
          }),
        }).addTo(gp)
      }
    }
  }, [hotspots, layers.histHotspots, layers.predHotspots])

  /* -------------------------------- POIs ------------------------------ */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.poi
    if (!map || !g) return
    g.clearLayers()
    if (!layers.pois) return
    const glyph = { school: '🎓', hospital: '🏥', market: '🛒', mall: '🏬', college: '📚', transit_hub: '🚉' }
    for (const p of pois) {
      const color = POI_COLORS[p.type] || '#94a3b8'
      const m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-50%);display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:${color}22;border:1.5px solid ${color};font-size:11px;box-shadow:0 3px 10px rgba(0,0,0,.5)">${
            glyph[p.type] || '📍'
          }</div>`,
          iconSize: [0, 0],
        }),
      })
      m.bindTooltip(`<div style="font-weight:600">${p.name}</div><div style="opacity:.8">${titleCase(p.type)}</div>`, {
        className: 'risk-tip',
        direction: 'top',
        offset: [0, -10],
      })
      m.addTo(g)
    }
  }, [pois, layers.pois])

  /* ------------------------------- routes ----------------------------- */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.route
    if (!map || !g) return
    g.clearLayers()
    for (const r of routes || []) {
      if (!r?.coords?.length) continue
      L.polyline(r.coords, {
        pane: 'routePane',
        color: r.color || '#22d3ee',
        weight: 7,
        opacity: 0.28,
        lineCap: 'round',
      }).addTo(g)
      L.polyline(r.coords, {
        pane: 'routePane',
        color: r.color || '#22d3ee',
        weight: 4,
        opacity: 0.95,
        dashArray: r.dash || null,
        lineCap: 'round',
      }).addTo(g)
    }
  }, [routes])

  /* ------------------------------- nodes ------------------------------ */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.node
    if (!map || !g) return
    g.clearLayers()
    if (!showNodes) return
    for (const n of nodes) {
      const m = L.circleMarker([n.lat, n.lon], {
        radius: n.is_junction ? 4.5 : 3,
        color: '#0a0f1e',
        weight: 1,
        fillColor: '#7cc0ff',
        fillOpacity: 0.9,
      })
      m.bindTooltip(`${n.id}${n.is_junction ? ' · junction' : ''}`, { className: 'risk-tip', direction: 'top' })
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); cbRef.current.onNodeClick?.(n) })
      m.addTo(g)
    }
  }, [nodes, showNodes])

  /* --------------------------- A/B markers ---------------------------- */
  useEffect(() => {
    const map = mapRef.current
    const g = groups.current.marker
    if (!map || !g) return
    g.clearLayers()
    for (const m of markers || []) {
      const el = L.marker([m.lat, m.lon], {
        zIndexOffset: 1000,
        icon: L.divIcon({
          className: '',
          html: `<div style="transform:translate(-50%,-100%);display:grid;place-items:center;width:26px;height:26px;border-radius:999px 999px 999px 3px;background:${m.color};color:#060913;font:800 12px Inter,sans-serif;border:2px solid #fff;box-shadow:0 5px 14px rgba(0,0,0,.55)">${m.label}</div>`,
          iconSize: [0, 0],
        }),
      })
      if (m.tooltip) el.bindTooltip(m.tooltip, { className: 'risk-tip', direction: 'top', offset: [0, -24] })
      el.addTo(g)
    }
  }, [markers])

  /* ------------------------------- focus ------------------------------ */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.flyTo([focus.lat, focus.lon], focus.zoom ?? 15, { duration: 0.8 })
  }, [focus])

  return <div ref={containerRef} className={`w-full h-full ${className}`} />
}
