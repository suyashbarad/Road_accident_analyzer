import { useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { Trophy, Boxes, Info } from 'lucide-react'
import { useData } from '../data/DataContext'
import { Card, Badge } from '../components/ui'
import { ChartTooltip, GRID } from '../components/charts'

const MODEL_COLORS = {
  'Logistic Regression': '#38bdf8',
  'Random Forest': '#22c55e',
  'Gradient Boosting': '#a78bfa',
}
const METRICS = [
  ['accuracy', 'Accuracy'],
  ['precision', 'Precision'],
  ['recall', 'Recall'],
  ['f1', 'F1-score'],
  ['roc_auc', 'ROC-AUC'],
  ['pr_auc', 'PR-AUC'],
  ['brier', 'Brier ↓'],
]

function toPoints(xs, ys) {
  return xs.map((x, i) => ({ x, y: ys[i] })).sort((a, b) => a.x - b.x)
}
function resample(pts, grid) {
  if (!pts.length) return grid.map((g) => ({ x: g, y: 0 }))
  return grid.map((gx) => {
    if (gx <= pts[0].x) return { x: gx, y: pts[0].y }
    if (gx >= pts[pts.length - 1].x) return { x: gx, y: pts[pts.length - 1].y }
    let i = 0
    while (i < pts.length - 1 && pts[i + 1].x < gx) i++
    const t = (gx - pts[i].x) / (pts[i + 1].x - pts[i].x || 1)
    return { x: gx, y: pts[i].y + t * (pts[i + 1].y - pts[i].y) }
  })
}

function Confusion({ c, color }) {
  const cell = (label, val, bg, txt) => (
    <div className="rounded-lg px-2 py-2 text-center" style={{ background: bg }}>
      <div className="text-[9.5px] uppercase tracking-wide" style={{ color: txt, opacity: 0.8 }}>{label}</div>
      <div className="text-lg font-bold tabular" style={{ color: txt }}>{val}</div>
    </div>
  )
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {cell('TN', c.tn, 'rgba(34,197,94,.12)', '#86efac')}
      {cell('FP', c.fp, 'rgba(239,68,68,.12)', '#fca5a5')}
      {cell('FN', c.fn, 'rgba(249,115,22,.12)', '#fdba74')}
      {cell('TP', c.tp, 'rgba(34,197,94,.18)', '#4ade80')}
      <span className="sr-only">{color}</span>
    </div>
  )
}

export default function ModelsView() {
  const { models } = useData()
  const comparison = models.comparison
  const best = models.best_model
  const names = Object.keys(comparison)

  const rocGrid = useMemo(() => Array.from({ length: 41 }, (_, i) => +(i / 40).toFixed(3)), [])
  const prGrid = rocGrid

  const roc = useMemo(() => {
    const rows = rocGrid.map((g) => ({ g, diagonal: g }))
    for (const n of names) {
      const m = comparison[n]
      const ys = resample(toPoints(m.roc_curve.fpr, m.roc_curve.tpr), rocGrid)
      ys.forEach((p, i) => (rows[i][n] = +p.y.toFixed(4)))
    }
    return rows
  }, [comparison, names, rocGrid])

  const pr = useMemo(() => {
    const rows = prGrid.map((g) => ({ g }))
    for (const n of names) {
      const m = comparison[n]
      const ys = resample(toPoints(m.pr_curve.recall, m.pr_curve.precision), prGrid)
      ys.forEach((p, i) => (rows[i][n] = +p.y.toFixed(4)))
    }
    return rows
  }, [comparison, names, prGrid])

  const radarData = useMemo(
    () =>
      ['accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'pr_auc'].map((k) => {
        const row = { metric: k.replace('_', '-').toUpperCase() }
        for (const n of names) row[n] = comparison[n][k]
        return row
      }),
    [comparison, names],
  )

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-50 flex items-center gap-2">
            <Boxes size={18} className="text-brand-300" /> Model comparison
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5 max-w-2xl">
            Three algorithms trained under a leakage-safe, time-aware protocol: features come from 2022–2023 and the
            target is whether a segment becomes <span className="text-slate-200 font-medium">high-risk in 2024</span>.
            Metrics are computed from out-of-fold (cross-validated) predictions.
          </p>
        </div>
        <Badge color={MODEL_COLORS[best]}>
          <Trophy size={11} /> Best: {best}
        </Badge>
      </div>

      {/* comparison table */}
      <Card title="Metrics" subtitle="Out-of-fold, 5-fold stratified cross-validation" bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-slate-400 border-b border-white/8">
                <th className="text-left font-medium px-4 py-2.5">Model</th>
                {METRICS.map(([k, label]) => (
                  <th key={k} className="text-right font-medium px-3 py-2.5 whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const m = comparison[n]
                const isBest = n === best
                return (
                  <tr key={n} className={`border-b border-white/5 ${isBest ? 'bg-emerald-500/6' : 'hover:bg-white/3'}`}>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium text-slate-100">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODEL_COLORS[n] }} />
                        {n}
                        {isBest && <Trophy size={12} className="text-emerald-400" />}
                      </span>
                    </td>
                    {METRICS.map(([k]) => {
                      const val = m[k]
                      const bestVal = Math.max(...names.map((x) => comparison[x][k]))
                      const worstVal = Math.min(...names.map((x) => comparison[x][k]))
                      const isTop = k === 'brier' ? val === worstVal : val === bestVal
                      return (
                        <td key={k} className={`px-3 py-2.5 text-right tabular ${isTop ? 'text-emerald-300 font-bold' : 'text-slate-300'}`}>
                          {val.toFixed(3)}
                          {m.cv?.[k] && (
                            <span className="block text-[9.5px] text-slate-500 font-normal">±{m.cv[k].std}</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="ROC curves" subtitle="True-positive vs false-positive rate" icon={<Boxes size={15} />}>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={roc} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid {...GRID} strokeDasharray="3 3" />
                <XAxis dataKey="g" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="diagonal" name="Random" stroke="#475569" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                {names.map((n) => (
                  <Line key={n} dataKey={n} stroke={MODEL_COLORS[n]} strokeWidth={2.4} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Precision–Recall curves" subtitle="Robust under class imbalance" icon={<Boxes size={15} />}>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={pr} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid {...GRID} strokeDasharray="3 3" />
                <XAxis dataKey="g" tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fill: '#7c8db0', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {names.map((n) => (
                  <Line key={n} dataKey={n} stroke={MODEL_COLORS[n]} strokeWidth={2.4} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Capability radar" icon={<Boxes size={15} />} className="lg:col-span-1">
          <div className="h-64">
            <ResponsiveContainer>
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 9.5 }} />
                <PolarRadiusAxis domain={[0, 1]} tick={{ fill: '#475569', fontSize: 8 }} axisLine={false} />
                {names.map((n) => (
                  <Radar key={n} name={n} dataKey={n} stroke={MODEL_COLORS[n]} fill={MODEL_COLORS[n]} fillOpacity={0.14} />
                ))}
                <Legend wrapperStyle={{ fontSize: 10.5 }} />
                <Tooltip content={<ChartTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {names.map((n) => (
          <Card key={n} title={`${n} — confusion matrix`} right={<Badge color={MODEL_COLORS[n]}>{comparison[n].f1.toFixed(2)} F1</Badge>}>
            <Confusion c={comparison[n].confusion} color={MODEL_COLORS[n]} />
            <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
              <div className="rounded-lg bg-white/4 px-2.5 py-1.5">
                <div className="text-slate-500">Sensitivity (TPR)</div>
                <div className="tabular text-slate-200 font-semibold">{comparison[n].recall.toFixed(3)}</div>
              </div>
              <div className="rounded-lg bg-white/4 px-2.5 py-1.5">
                <div className="text-slate-500">Specificity (TNR)</div>
                <div className="tabular text-slate-200 font-semibold">
                  {(comparison[n].confusion.tn / (comparison[n].confusion.tn + comparison[n].confusion.fp || 1)).toFixed(3)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="glass rounded-xl p-3.5 flex gap-3 items-start">
        <Info size={16} className="text-brand-300 shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-slate-400 leading-relaxed">
          Because high-risk segments are a minority class, we emphasise <span className="text-slate-200">Recall, F1 and
          PR-AUC</span> over raw accuracy. The low Brier score indicates the predicted probabilities are well calibrated,
          which matters because the map presents risk as a continuous 0–100% score. The deployed model is the{' '}
          <span className="text-slate-200">{models.deployed_model}</span> — chosen for both strong discrimination and
          native SHAP support, so the map score and its explanations come from one model.
        </p>
      </div>
    </div>
  )
}
