import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Activity, Skull, Moon, CloudRain, AlertTriangle, Gauge } from 'lucide-react'
import { useData } from '../data/DataContext'
import { Card, Stat } from '../components/ui'
import { ChartTooltip, AXIS, GRID } from '../components/charts'
import FilterPanel from '../components/FilterPanel'
import { aggregate, riskHistogram } from '../lib/stats'
import { SEVERITY_COLORS, ROAD_CLASS_COLORS, RISK_COLORS, RISK_ORDER, titleCase, num } from '../lib/risk'

const WEATHER_COLORS = { Clear: '#38bdf8', Rain: '#2f8bff', Fog: '#94a3b8', Overcast: '#64748b' }
const LIGHT_COLORS = { Daylight: '#fbbf24', 'Dawn/Dusk': '#f97316', 'Dark - lit': '#60a5fa', 'Dark - unlit': '#6366f1' }

function Donut({ data, colorFor, centerLabel }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <div className="flex items-center gap-3">
      <div className="h-40 w-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={colorFor(d.name)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: colorFor(d.name) }} />
            <span className="text-[11.5px] text-slate-300 truncate">{d.name}</span>
            <span className="ml-auto text-[11.5px] tabular text-slate-400">{num(d.value)}</span>
            <span className="text-[11px] tabular text-slate-500 w-10 text-right">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
        {centerLabel && <div className="text-[10px] text-slate-500 pt-1">{centerLabel}</div>}
      </div>
    </div>
  )
}

export default function AnalyticsView() {
  const { filteredAccidents, segments, hotspots } = useData()
  const agg = useMemo(() => aggregate(filteredAccidents), [filteredAccidents])
  const hist = useMemo(() => riskHistogram(segments, 10), [segments])

  const avgRisk = segments.length ? segments.reduce((s, x) => s + x.risk, 0) / segments.length : 0
  const scatter = useMemo(
    () => segments.map((s) => ({ x: s.hist_count, y: +(s.risk * 100).toFixed(1), cat: s.category, name: s.name })),
    [segments],
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <FilterPanel />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Accidents (filtered)" value={num(agg.total)} icon={<Activity size={17} />} accent="#2f8bff" sub="2022 – 2024" />
        <Stat label="Fatalities" value={num(agg.fatal)} icon={<Skull size={17} />} accent="#ef4444" sub={`${((agg.fatal / (agg.total || 1)) * 100).toFixed(1)}% of total`} />
        <Stat label="Grievous" value={num(agg.grievous)} icon={<AlertTriangle size={17} />} accent="#f97316" />
        <Stat label="Night-time" value={num(agg.night)} icon={<Moon size={17} />} accent="#6366f1" sub={`${((agg.night / (agg.total || 1)) * 100).toFixed(0)}% after dark`} />
        <Stat label="Monsoon" value={num(agg.monsoon)} icon={<CloudRain size={17} />} accent="#38bdf8" sub="Jun – Sep" />
        <Stat label="Mean predicted risk" value={`${(avgRisk * 100).toFixed(0)}%`} icon={<Gauge size={17} />} accent="#a78bfa" sub={`${hotspots.predicted.length} risk zones`} />
      </div>

      {/* hour of day */}
      <Card title="Accidents by hour of day" subtitle="Temporal pattern — rush-hour and night-time peaks" icon={<Activity size={15} />}>
        <div className="h-56">
          <ResponsiveContainer>
            <ComposedChart data={agg.byHour} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" interval={1} tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
              <YAxis tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="count" name="Accidents" fill="#2f8bff" radius={[3, 3, 0, 0]} />
              <Line dataKey="fatal" name="Fatal" stroke="#ef4444" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="By day of week" icon={<Activity size={15} />}>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={agg.byWeekday} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={{ fill: '#7c8db0', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="Accidents" radius={[4, 4, 0, 0]}>
                  {agg.byWeekday.map((d, i) => (
                    <Cell key={i} fill={i >= 4 ? '#a78bfa' : '#2f8bff'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="By month" subtitle="Monsoon surge (Jun–Sep)" icon={<CloudRain size={15} />}>
          <div className="h-48">
            <ResponsiveContainer>
              <AreaChart data={agg.byMonth} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="mgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area dataKey="count" name="Accidents" stroke="#38bdf8" strokeWidth={2} fill="url(#mgrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Severity distribution" icon={<Skull size={15} />}>
          <Donut data={agg.bySeverity} colorFor={(n) => SEVERITY_COLORS[n] || '#64748b'} />
        </Card>
        <Card title="Accident type" icon={<Activity size={15} />}>
          <div className="h-48">
            <ResponsiveContainer>
              <BarChart data={agg.byType} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis type="number" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={92} tick={{ fill: '#94a3b8', fontSize: 10.5 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Accidents" fill="#a78bfa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Weather" icon={<CloudRain size={15} />}>
          <Donut data={agg.byWeather} colorFor={(n) => WEATHER_COLORS[n] || '#64748b'} />
        </Card>
        <Card title="Lighting condition" icon={<Moon size={15} />}>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={agg.byLighting} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" tick={{ fill: '#7c8db0', fontSize: 9 }} interval={0} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Accidents" radius={[4, 4, 0, 0]}>
                  {agg.byLighting.map((d, i) => (
                    <Cell key={i} fill={LIGHT_COLORS[d.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="By road class" icon={<Activity size={15} />}>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={agg.byRoadClass} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="name" tick={{ fill: '#7c8db0', fontSize: 9.5 }} interval={0} axisLine={{ stroke: '#334155' }} tickLine={false} tickFormatter={(v) => titleCase(v)} />
                <YAxis tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="value" name="Accidents" radius={[4, 4, 0, 0]}>
                  {agg.byRoadClass.map((d, i) => (
                    <Cell key={i} fill={ROAD_CLASS_COLORS[d.name] || '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Predicted risk distribution" subtitle="Model output across all road segments" icon={<Gauge size={15} />}>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" tick={{ fill: '#7c8db0', fontSize: 9 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" name="Segments" radius={[4, 4, 0, 0]}>
                  {hist.map((d, i) => {
                    const mid = (d.lo + d.hi) / 2
                    const cat = mid < 0.3 ? 'low' : mid < 0.5 ? 'moderate' : mid < 0.7 ? 'high' : 'very_high'
                    return <Cell key={i} fill={RISK_COLORS[cat]} />
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="History vs. prediction" subtitle="Historical accidents (x) against predicted risk % (y)" icon={<Activity size={15} />}>
          <div className="h-52">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid {...GRID} strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Historical" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} label={{ value: 'historical accidents', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Risk %" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <ZAxis range={[28, 28]} />
                <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#475569' }} />
                <Scatter data={scatter}>
                  {scatter.map((d, i) => (
                    <Cell key={i} fill={RISK_COLORS[d.cat]} fillOpacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 text-[10.5px] text-slate-500 px-1 pb-2">
        {RISK_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[k] }} /> {titleCase(k)}
          </span>
        ))}
        <span className="ml-auto">Charts respect the active spatio-temporal filters.</span>
      </div>
    </div>
  )
}
