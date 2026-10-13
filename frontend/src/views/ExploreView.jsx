import { useState } from 'react'
import { useData } from '../data/DataContext'
import Sidebar from '../components/Sidebar'
import SegmentDetail from '../components/SegmentDetail'
import MapCanvas from '../components/map/MapCanvas'
import { AlertTriangle, Flame, Skull, MousePointerClick } from 'lucide-react'

const DEFAULT_LAYERS = {
  riskSegments: true,
  predHeat: true,
  histHeat: false,
  accidentPoints: false,
  histHotspots: true,
  predHotspots: true,
  pois: true,
}

export default function ExploreView() {
  const {
    segments,
    filteredAccidents,
    pois,
    hotspots,
    graph,
    meta,
    selectedId,
    setSelectedId,
    focus,
  } = useData()

  const [layers, setLayers] = useState(DEFAULT_LAYERS)
  const [basemap, setBasemap] = useState('dark')
  const [minRisk, setMinRisk] = useState(0)

  const veryHigh = segments.filter((s) => s.category === 'very_high').length
  const fatalInView = filteredAccidents.filter((a) => a.severity === 'Fatal').length

  return (
    <div className="h-full flex">
      <Sidebar
        layers={layers}
        setLayers={setLayers}
        basemap={basemap}
        setBasemap={setBasemap}
        minRisk={minRisk}
        setMinRisk={setMinRisk}
      />

      <div className="flex-1 relative min-w-0">
        <MapCanvas
          segments={segments}
          accidents={filteredAccidents}
          pois={pois}
          hotspots={hotspots}
          nodes={graph.nodes}
          layers={layers}
          basemap={basemap}
          center={meta.center}
          zoom={13}
          selectedId={selectedId}
          onSelect={setSelectedId}
          focus={focus}
          minRisk={minRisk}
        />

        {/* floating KPI chips */}
        <div className="absolute top-3 left-3 z-[500] flex flex-wrap gap-2 pointer-events-none max-w-[70%]">
          <Kpi icon={<AlertTriangle size={13} />} color="#ef4444" label="Very-high risk" value={veryHigh} />
          <Kpi icon={<Flame size={13} />} color="#a78bfa" label="Predicted zones" value={hotspots.predicted.length} />
          <Kpi icon={<Skull size={13} />} color="#f59e0b" label="Fatalities in view" value={fatalInView} />
        </div>

        {/* hint */}
        {!selectedId && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[500] pointer-events-none">
            <div className="glass-soft rounded-full px-3.5 py-1.5 flex items-center gap-2 text-[11px] text-slate-300 shadow-card">
              <MousePointerClick size={13} className="text-brand-300" />
              Click any road segment for its AI risk score & SHAP explanation
            </div>
          </div>
        )}

        {/* detail drawer */}
        {selectedId && (
          <div className="absolute right-3 top-3 bottom-3 z-[600] flex">
            <SegmentDetail />
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon, color, label, value }) {
  return (
    <div className="glass rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-card">
      <span style={{ color }}>{icon}</span>
      <span className="text-[10.5px] text-slate-400">{label}</span>
      <span className="text-[13px] font-bold tabular text-slate-50">{value}</span>
    </div>
  )
}
