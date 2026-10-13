import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { Lightbulb, Info } from 'lucide-react'
import { useData } from '../data/DataContext'
import { Card, Badge } from '../components/ui'
import { ChartTooltip, GRID } from '../components/charts'
import { groupColor, GROUP_COLORS, GROUP_LABELS, groupOf } from '../lib/features'
import { riskRamp } from '../lib/risk'

// blue (low value) -> red (high value), like a classic SHAP beeswarm
function valueColor(t) {
  t = Math.max(0, Math.min(1, t))
  const lo = [59, 130, 246]
  const hi = [239, 68, 68]
  const c = lo.map((v, i) => Math.round(v + (hi[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

function Beeswarm({ shap, topFeatures, width = 760, rowH = 24 }) {
  const { matrix, feature_values, names } = shap
  const n = matrix.length
  const pad = { left: 150, right: 16, top: 22, bottom: 24 }
  const plotW = width - pad.left - pad.right
  const cx = pad.left + plotW / 2
  const H = pad.top + pad.bottom + topFeatures.length * rowH

  const maxAbs = useMemo(() => {
    let m = 1e-6
    for (const fi of topFeatures) for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(matrix[i][fi]))
    return m
  }, [topFeatures, matrix, n])

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${width} ${H}`} className="overflow-visible">
      {/* axis */}
      <line x1={cx} y1={pad.top - 6} x2={cx} y2={H - pad.bottom + 4} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <text x={cx} y={12} fill="#64748b" fontSize="10" textAnchor="middle">SHAP value → impact on predicted risk</text>
      <text x={pad.left + 4} y={H - 6} fill="#60a5fa" fontSize="10">← lowers risk</text>
      <text x={width - pad.right} y={H - 6} fill="#f87171" fontSize="10" textAnchor="end">raises risk →</text>

      {topFeatures.map((fi, r) => {
        const rowY = pad.top + r * rowH + rowH / 2
        // min/max of feature value for colour scaling
        let vmin = Infinity
        let vmax = -Infinity
        for (let i = 0; i < n; i++) {
          const v = feature_values[i][fi]
          if (v < vmin) vmin = v
          if (v > vmax) vmax = v
        }
        const span = vmax - vmin || 1
        // order samples by value for the vertical jitter
        const order = [...Array(n).keys()].sort((a, b) => feature_values[a][fi] - feature_values[b][fi])
        return (
          <g key={fi}>
            <text x={pad.left - 10} y={rowY + 3.5} fill="#cbd5e1" fontSize="10.5" textAnchor="end">
              {names[fi].length > 22 ? names[fi].slice(0, 21) + '…' : names[fi]}
            </text>
            {order.map((i, rank) => {
              const sv = matrix[i][fi]
              const x = cx + (sv / maxAbs) * (plotW / 2)
              const y = rowY + (rank / (n - 1 || 1) - 0.5) * (rowH - 7)
              const t = (feature_values[i][fi] - vmin) / span
              return (
                <circle key={i} cx={x} cy={y} r={2.4} fill={valueColor(t)} fillOpacity={0.72}>
                  <title>{`${names[fi]}\nvalue: ${feature_values[i][fi]}\nSHAP: ${sv.toFixed(3)}`}</title>
                </circle>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

export default function ExplainView() {
  const { feature_importance, shap, meta } = useData()
  const importance = feature_importance.importance
  const labels = shap.labels
  const [depFeature, setDepFeature] = useState(0)

  const nameToIdx = useMemo(() => {
    const m = {}
    shap.names.forEach((n, i) => (m[n] = i))
    return m
  }, [shap.names])

  const topFeatures = useMemo(
    () => importance.slice(0, 12).map((f) => nameToIdx[f.feature]).filter((i) => i != null),
    [importance, nameToIdx],
  )

  const barData = useMemo(
    () =>
      importance.slice(0, 15).map((f) => ({
        label: f.label,
        feature: f.feature,
        importance: +(f.importance * 100).toFixed(2),
        group: groupOf(f.feature),
      })),
    [importance],
  )

  // group-level contribution
  const byGroup = useMemo(() => {
    const acc = {}
    for (const f of importance) {
      const g = groupOf(f.feature)
      acc[g] = (acc[g] || 0) + f.importance
    }
    const total = Object.values(acc).reduce((a, b) => a + b, 0) || 1
    return Object.entries(acc)
      .map(([g, v]) => ({ group: g, share: v / total }))
      .sort((a, b) => b.share - a.share)
  }, [importance])

  const depData = useMemo(() => {
    const fi = nameToIdx[importance[depFeature]?.feature]
    if (fi == null) return []
    let vmin = Infinity
    let vmax = -Infinity
    for (const row of shap.feature_values) {
      vmin = Math.min(vmin, row[fi])
      vmax = Math.max(vmax, row[fi])
    }
    const span = vmax - vmin || 1
    return shap.matrix.map((row, i) => ({
      x: shap.feature_values[i][fi],
      y: +row[fi].toFixed(4),
      t: (shap.feature_values[i][fi] - vmin) / span,
    }))
  }, [importance, depFeature, nameToIdx, shap])

  const currentFeature = importance[depFeature]

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-50 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-300" /> Explainable AI (SHAP)
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5 max-w-2xl">
            Every risk score is decomposed into per-feature contributions using SHAP on the deployed{' '}
            {meta?.best_model} model. Base rate (expected value) ={' '}
            <span className="text-slate-200 font-medium">{((shap.expected_value || 0) * 100).toFixed(1)}%</span>.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(GROUP_LABELS).map(([g, l]) => (
            <Badge key={g} color={GROUP_COLORS[g]}>
              {l}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Global feature importance" subtitle="Mean |SHAP| across all segments" className="lg:col-span-2" icon={<Lightbulb size={15} />}>
          <div className="h-[26rem]">
            <ResponsiveContainer>
              <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid {...GRID} horizontal={false} />
                <XAxis type="number" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="label" width={150} tick={{ fill: '#94a3b8', fontSize: 10.5 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip unit="%" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="importance" name="Importance" radius={[0, 4, 4, 0]}>
                  {barData.map((d, i) => (
                    <Cell key={i} fill={GROUP_COLORS[d.group]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Contribution by feature family" icon={<Info size={15} />}>
          <div className="space-y-3">
            {byGroup.map(({ group, share }) => (
              <div key={group}>
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span className="text-slate-300">{GROUP_LABELS[group]}</span>
                  <span className="tabular text-slate-400">{(share * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/6 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: GROUP_COLORS[group] }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
            Traffic exposure and accident history dominate, confirming that <em>where</em> and <em>how much</em> a road
            has been used drives future risk more than static geometry alone.
          </p>
        </Card>
      </div>

      <Card
        title="SHAP beeswarm"
        subtitle="Each dot is a road segment — colour shows the feature value (blue low → red high), horizontal position shows its push on risk"
        icon={<Lightbulb size={15} />}
      >
        <Beeswarm shap={{ ...shap, names: labels }} topFeatures={topFeatures} />
      </Card>

      <Card
        title="Dependence plot"
        subtitle="How one feature's value relates to its SHAP contribution"
        icon={<Info size={15} />}
        right={
          <select
            value={depFeature}
            onChange={(e) => setDepFeature(+e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg text-[11.5px] text-slate-200 px-2 py-1 outline-none focus:border-brand-400/60"
          >
            {importance.slice(0, 15).map((f, i) => (
              <option key={f.feature} value={i} className="bg-ink-900">
                {f.label}
              </option>
            ))}
          </select>
        }
      >
        <div className="h-64">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 10, right: 16, left: -12, bottom: 8 }}>
              <CartesianGrid {...GRID} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name={currentFeature?.label}
                tick={{ fill: '#7c8db0', fontSize: 10 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
              />
              <YAxis type="number" dataKey="y" name="SHAP" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
              <ZAxis range={[26, 26]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="glass rounded-lg px-3 py-2 border border-white/10 shadow-glow text-[11px]">
                      <div className="text-slate-400">{currentFeature?.label}</div>
                      <div className="text-slate-100 tabular">value: {payload[0].payload.x.toFixed(2)}</div>
                      <div className="tabular" style={{ color: payload[0].payload.y >= 0 ? '#fca5a5' : '#86efac' }}>
                        SHAP: {payload[0].payload.y >= 0 ? '+' : ''}
                        {payload[0].payload.y.toFixed(3)}
                      </div>
                    </div>
                  ) : null
                }
              />
              <Scatter data={depData}>
                {depData.map((d, i) => (
                  <Cell key={i} fill={riskRamp(d.t)} fillOpacity={0.85} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          Points above zero push the segment towards <span className="text-rose-300">higher</span> risk; below zero
          towards <span className="text-emerald-300">lower</span> risk. Open any segment on the Explore map to see its
          own local explanation.
        </p>
      </Card>
    </div>
  )
}
