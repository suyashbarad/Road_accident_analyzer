import { useMemo } from 'react'
import {
  BookOpen, Target, Workflow, Database, Layers, BrainCircuit, FlaskConical,
  Lightbulb, Flame, BarChart3, Cpu, AlertTriangle, Users, Terminal, Telescope,
  CheckCircle2, Map as MapIcon,
} from 'lucide-react'
import { useData } from '../data/DataContext'
import { Card, Badge, Stat } from '../components/ui'
import { GROUP_LABELS, GROUP_COLORS, groupOf } from '../lib/features'
import { pct, num, titleCase } from '../lib/risk'

const OBJECTIVES = [
  'Predict spatio-temporal accident risk for every road segment one year ahead.',
  'Detect historical black-spots and emerging high-risk zones on an interactive map.',
  'Explain every score with SHAP so planners trust and act on the model.',
  'Validate rigorously with time-aware and spatially-blocked hold-out experiments.',
  'Recommend risk-aware routes that trade a little time for a lot less danger.',
]

const PIPELINE = [
  { icon: Database, title: 'Ingest & synthesise', text: 'Road network, POIs and 3 years of accident records over a real city grid.' },
  { icon: Layers, title: 'Feature engineering', text: '30 leakage-safe features across 5 families (history, road, traffic, context, environment).' },
  { icon: BrainCircuit, title: 'Model & validate', text: 'Logistic Regression, Random Forest and Gradient Boosting under time-aware CV.' },
  { icon: Lightbulb, title: 'Explain (SHAP)', text: 'Global importance + per-segment attributions for transparency.' },
  { icon: Flame, title: 'Hotspot detection', text: 'Grid density for history, DBSCAN for predicted zones, matched into confirmed / emerging.' },
  { icon: MapIcon, title: 'Serve & visualise', text: 'JSON export + optional FastAPI, rendered on a Leaflet risk dashboard.' },
]

const METRICS = [
  ['ROC-AUC', 'Probability ranking quality across all thresholds — the headline metric here.'],
  ['PR-AUC', 'Precision-recall area; more honest than ROC under class imbalance.'],
  ['Recall', 'Share of truly high-risk segments the model catches (missed = false negatives).'],
  ['F1', 'Harmonic mean of precision and recall at the operating threshold.'],
  ['Brier', 'Calibration error of the predicted probabilities (lower is better).'],
]

const STACK = {
  'ML / backend': ['Python', 'pandas', 'NumPy', 'scikit-learn', 'SHAP', 'FastAPI', 'Uvicorn'],
  'Geospatial': ['Haversine math', 'grid density clustering', 'DBSCAN', 'Dijkstra routing', 'GeoJSON'],
  'Frontend': ['React 18', 'Vite', 'Tailwind CSS', 'Leaflet', 'Recharts', 'simpleheat', 'lucide-react'],
}

const TEAM = [
  ['Data & geospatial engineering', 'Network build, POIs, synthetic accident generator, feature store.'],
  ['ML modelling & evaluation', 'Model zoo, time-aware / spatial CV, experiment design A–G.'],
  ['Explainability & hotspots', 'SHAP pipeline, density + DBSCAN clustering, confirmed/emerging logic.'],
  ['Frontend & geovisualisation', 'Leaflet dashboard, analytics, route planner, deployment.'],
]

const LIMITS = [
  'Accident records are synthetically generated from a realistic latent-risk surface; the schema is drop-in for real police / OSM feeds.',
  'Risk is segment-level and annualised for the test year — not a per-trip real-time score.',
  'The risk-aware route cost uses a heuristic penalty (8× risk); it is tunable and calibratable to local policy.',
  'Class imbalance is handled via thresholds and PR-AUC reporting; production needs a scheduled retraining cadence.',
]

const FUTURE = [
  'Live ingestion into PostgreSQL + PostGIS with streaming refresh of risk tiles.',
  'Deep spatio-temporal models (graph neural nets / ConvLSTM) benchmarked against the tree baselines.',
  'Weather-API coupling for short-term (hourly) risk now-casting during monsoon peaks.',
  'A what-if simulator to estimate how lighting / signals / resurfacing shift predicted risk.',
]

const REPRO = [
  '# 1 · Python environment',
  'python3 -m venv .venv && source .venv/bin/activate',
  'pip install -r backend/requirements.txt',
  '',
  '# 2 · Train models + export JSON bundle',
  'cd backend && python run_pipeline.py',
  '',
  '# 3 · Run the dashboard',
  'cd ../frontend && npm install && npm run dev',
  '',
  '# optional · live inference API (FastAPI)',
  'cd backend && uvicorn app:app --reload',
]

export default function MethodView() {
  const { meta, models, experiments, feature_importance, hotspots } = useData()
  const c = meta?.counts || {}
  const comparison = models?.comparison || {}
  const best = models?.best_model
  const abc = experiments?.ABC_feature_study || {}
  const ablation = experiments?.ablation || {}
  const spatial = experiments?.F_spatial || {}
  const gModel = experiments?.G_time_aware?.[best] || {}
  const cv = gModel?.cv || {}
  const top = (feature_importance?.importance || []).slice(0, 6)

  const groupCounts = useMemo(() => {
    const acc = {}
    for (const f of feature_importance?.importance || []) {
      const g = groupOf(f.feature)
      acc[g] = (acc[g] || 0) + 1
    }
    return acc
  }, [feature_importance])

  const bestRoc = comparison[best]?.roc_auc
  const abcKeys = ['A', 'B', 'C'].filter((k) => abc[k])
  const maxAb = Math.max(0.001, ...Object.values(ablation).map((a) => Math.abs(a.delta_roc_auc || 0)))

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-5">
      {/* ---------------- hero ---------------- */}
      <header className="glass rounded-2xl p-5 md:p-6 shadow-card relative overflow-hidden">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <Badge color="#a78bfa">
            <BookOpen size={11} /> AIES · Research project
          </Badge>
          <h1 className="mt-2.5 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-50 leading-tight">
            Explainable AI for <span className="text-gradient">Spatio-Temporal Road Accident Risk</span> &amp; Geospatial Hotspot Mapping
          </h1>
          <p className="mt-2 text-[13px] text-slate-300 max-w-3xl leading-relaxed">
            A transparent machine-learning pipeline that forecasts which road segments are likely to become accident
            black-spots, explains <em>why</em> with SHAP, and surfaces the result on an interactive risk map — built for{' '}
            {meta?.city}, {meta?.country} as a reproducible decision-support tool for road-safety planners.
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <Stat label="Segments" value={num(c.segments)} icon={<Layers size={16} />} accent="#60a5fa" />
            <Stat label="Accidents" value={num(c.accidents)} icon={<AlertTriangle size={16} />} accent="#f59e0b" />
            <Stat label="Features" value={num(meta?.n_features)} icon={<Cpu size={16} />} accent="#a78bfa" />
            <Stat label="High-risk" value={num(c.high_risk_segments)} icon={<Flame size={16} />} accent="#ef4444" sub={`${meta?.test_year} test`} />
            <Stat label="Hotspots" value={num(c.historical_hotspots)} icon={<MapIcon size={16} />} accent="#22c55e" sub={`${c.predicted_hotspots} predicted`} />
            <Stat label="Best ROC-AUC" value={bestRoc ? pct(bestRoc, 1) : '—'} icon={<BarChart3 size={16} />} accent="#38bdf8" sub={best} />
          </div>
        </div>
      </header>

      {/* ---------------- objectives + pipeline ---------------- */}
      <div className="grid lg:grid-cols-5 gap-4">
        <Card title="Objectives" icon={<Target size={15} />} className="lg:col-span-2" bodyClass="p-4">
          <ul className="space-y-2.5">
            {OBJECTIVES.map((o, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] text-slate-300 leading-relaxed">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="System architecture" subtitle="End-to-end, reproducible pipeline" icon={<Workflow size={15} />} className="lg:col-span-3">
          <div className="grid sm:grid-cols-2 gap-2.5">
            {PIPELINE.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/8 bg-white/3 p-3 flex gap-3">
                <span className="grid place-items-center h-9 w-9 rounded-lg bg-brand-500/15 text-brand-300 shrink-0">
                  <s.icon size={17} />
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold text-slate-100 flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 tabular">{i + 1}</span> {s.title}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- data + features ---------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Study area & data" icon={<Database size={15} />}>
          <p className="text-[12px] text-slate-300 leading-relaxed">
            A {num(c.nodes)}-junction road network ({num(c.segments)} segments) is generated over the bounding box of{' '}
            {meta?.city}, with {num(c.pois)} points of interest (schools, hospitals, markets, transit hubs).{' '}
            {num(c.accidents)} accidents are simulated across {meta?.train_years?.[0]}–{meta?.test_year} using
            spatio-temporal patterns — rush-hour peaks, a monsoon seasonal surge, night-time and weather effects — from a
            latent risk surface that the model must learn to recover.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/4 py-2">
              <div className="text-[10px] text-slate-500">Train window</div>
              <div className="text-[13px] font-bold text-slate-100 tabular">{meta?.train_years?.join('–')}</div>
            </div>
            <div className="rounded-lg bg-white/4 py-2">
              <div className="text-[10px] text-slate-500">Test year</div>
              <div className="text-[13px] font-bold text-slate-100 tabular">{meta?.test_year}</div>
            </div>
            <div className="rounded-lg bg-white/4 py-2">
              <div className="text-[10px] text-slate-500">High-risk rule</div>
              <div className="text-[13px] font-bold text-slate-100 tabular">≥ {meta?.high_risk_threshold_count} acc.</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
            The target is <b>leakage-safe</b>: features use only the training window; the label is whether a segment
            became high-risk in the held-out test year.
          </p>
        </Card>

        <Card title="Feature families" subtitle={`${meta?.n_features} engineered predictors`} icon={<Layers size={15} />}>
          <div className="space-y-2.5">
            {Object.entries(GROUP_LABELS).map(([g, label]) => (
              <div key={g} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: GROUP_COLORS[g] }} />
                <span className="text-[12.5px] text-slate-200 flex-1">{label}</span>
                <span className="text-[11px] text-slate-500 tabular">{groupCounts[g] || 0} features</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="text-[11px] text-slate-400 mb-1.5">Top learned drivers (mean |SHAP|)</div>
            <div className="space-y-1.5">
              {top.map((f) => (
                <div key={f.feature} className="flex items-center gap-2">
                  <span className="text-[11.5px] text-slate-300 w-40 truncate">{f.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/6 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(f.importance / top[0].importance) * 100}%`, background: GROUP_COLORS[groupOf(f.feature)] }} />
                  </div>
                  <span className="text-[11px] text-slate-400 tabular w-10 text-right">{pct(f.importance, 1)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ---------------- models ---------------- */}
      <Card title="Model comparison" subtitle="Time-aware hold-out on the test year" icon={<BrainCircuit size={15} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-slate-500 text-[11px] uppercase tracking-wide">
                <th className="text-left font-medium py-2 pr-3">Model</th>
                <th className="text-right font-medium py-2 px-2">Accuracy</th>
                <th className="text-right font-medium py-2 px-2">Precision</th>
                <th className="text-right font-medium py-2 px-2">Recall</th>
                <th className="text-right font-medium py-2 px-2">F1</th>
                <th className="text-right font-medium py-2 px-2">ROC-AUC</th>
                <th className="text-right font-medium py-2 px-2">PR-AUC</th>
                <th className="text-right font-medium py-2 pl-2">Brier</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(comparison).map(([name, m]) => (
                <tr key={name} className={`border-t border-white/6 ${name === best ? 'bg-emerald-500/8' : ''}`}>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2 font-medium text-slate-100">
                      {name}
                      {name === best && <Badge color="#22c55e">best</Badge>}
                    </span>
                  </td>
                  <td className="text-right tabular py-2 px-2 text-slate-300">{pct(m.accuracy)}</td>
                  <td className="text-right tabular py-2 px-2 text-slate-300">{pct(m.precision)}</td>
                  <td className="text-right tabular py-2 px-2 text-slate-300">{pct(m.recall)}</td>
                  <td className="text-right tabular py-2 px-2 text-slate-300">{pct(m.f1)}</td>
                  <td className="text-right tabular py-2 px-2 font-semibold text-brand-300">{pct(m.roc_auc)}</td>
                  <td className="text-right tabular py-2 px-2 text-slate-300">{pct(m.pr_auc)}</td>
                  <td className="text-right tabular py-2 pl-2 text-slate-400">{m.brier?.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Deployed model: <b className="text-slate-300">{models?.deployed_model}</b> — chosen for the best ROC-AUC /
          PR-AUC with stable cross-validation (ROC-AUC {cv?.roc_auc ? `${pct(cv.roc_auc.mean, 1)} ± ${pct(cv.roc_auc.std, 1)}` : '—'}).
        </p>
      </Card>

      {/* ---------------- experiments ---------------- */}
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <FlaskConical size={16} className="text-violet-300" />
          <h2 className="text-[15px] font-bold text-slate-100">Controlled experiments</h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {/* ABC feature study */}
          <Card title="A · B · C — feature-group ladder" subtitle="Does each feature family add signal?" icon={<Layers size={15} />}>
            <div className="space-y-3">
              {abcKeys.map((k) => {
                const e = abc[k]
                const roc = e.metrics.roc_auc
                return (
                  <div key={k}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="text-slate-200">
                        <b className="text-brand-300">{k}</b> · {e.groups.map(titleCase).join(' + ')}
                      </span>
                      <span className="tabular text-slate-300">{e.n_features}f · {pct(roc)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/6 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-400" style={{ width: `${roc * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              ROC-AUC climbs {abcKeys.length ? `${pct(abc[abcKeys[0]].metrics.roc_auc)} → ${pct(abc[abcKeys[abcKeys.length - 1]].metrics.roc_auc)}` : ''} as
              traffic, context and environment features are added on top of pure accident history.
            </p>
          </Card>

          {/* ablation */}
          <Card title="Ablation — remove one family" subtitle="Δ ROC-AUC vs. the full model" icon={<FlaskConical size={15} />}>
            <div className="space-y-2">
              {Object.entries(ablation).map(([g, a]) => {
                const d = a.delta_roc_auc || 0
                const w = (Math.abs(d) / maxAb) * 50
                const pos = d >= 0
                return (
                  <div key={g} className="flex items-center gap-2 text-[12px]">
                    <span className="w-24 text-slate-300 truncate">{GROUP_LABELS[g] || titleCase(g)}</span>
                    <div className="flex-1 relative h-4 rounded bg-white/4">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
                      <div
                        className="absolute top-0.5 bottom-0.5 rounded"
                        style={{ background: pos ? '#f97316' : GROUP_COLORS[g], left: pos ? '50%' : `${50 - w}%`, width: `${w}%` }}
                      />
                    </div>
                    <span className="w-14 text-right tabular" style={{ color: pos ? '#fdba74' : '#93c5fd' }}>
                      {pos ? '+' : ''}{(d * 100).toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Removing road or traffic features hurts most (blue, left), confirming they carry real predictive signal
              beyond accident counts.
            </p>
          </Card>

          {/* spatial validation */}
          <Card title="F — spatially-blocked validation" subtitle="Train and test on disjoint halves of the city" icon={<MapIcon size={15} />}>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Train segments" value={num(spatial.train_segments)} accent="#60a5fa" />
              <Stat label="Test segments" value={num(spatial.test_segments)} accent="#a78bfa" />
              <Stat label="Spatial ROC-AUC" value={spatial.metrics ? pct(spatial.metrics.roc_auc) : '—'} accent="#22c55e" />
              <Stat label="Recall" value={spatial.metrics ? pct(spatial.metrics.recall) : '—'} accent="#f59e0b" />
            </div>
            {spatial.confusion && (
              <Confusion cm={spatial.confusion} />
            )}
            <p className="text-[11px] text-slate-500 mt-3">
              Performance holds up when the model never sees the test neighbourhood during training — evidence it learns
              transferable risk patterns, not memorised locations.
            </p>
          </Card>

          {/* time-aware + CV */}
          <Card title="G — time-aware split & stability" subtitle={`Predicting ${meta?.test_year} from ${meta?.train_years?.join('–')}`} icon={<Telescope size={15} />}>
            <div className="grid grid-cols-2 gap-2.5">
              {cv.roc_auc && <Stat label="ROC-AUC (CV)" value={pct(cv.roc_auc.mean)} sub={`± ${pct(cv.roc_auc.std)}`} accent="#38bdf8" />}
              {cv.pr_auc && <Stat label="PR-AUC (CV)" value={pct(cv.pr_auc.mean)} sub={`± ${pct(cv.pr_auc.std)}`} accent="#22c55e" />}
              {cv.f1 && <Stat label="F1 (CV)" value={pct(cv.f1.mean)} sub={`± ${pct(cv.f1.std)}`} accent="#a78bfa" />}
              {cv.recall && <Stat label="Recall (CV)" value={pct(cv.recall.mean)} sub={`± ${pct(cv.recall.std)}`} accent="#f59e0b" />}
            </div>
            {gModel.confusion && <Confusion cm={gModel.confusion} />}
            <p className="text-[11px] text-slate-500 mt-3">
              Cross-validation over the training years shows low variance — the deployed model is stable, not a lucky
              split.
            </p>
          </Card>
        </div>
      </div>

      {/* ---------------- hotspots + explainability ---------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Hotspot methodology" icon={<Flame size={15} />}>
          <ul className="space-y-2.5 text-[12.5px] text-slate-300 leading-relaxed">
            <li className="flex gap-2.5"><Badge color="#f59e0b">Historical</Badge><span>Grid-density clustering of recorded accidents into connected cells (min count threshold) → {num(hotspots?.historical?.length)} black-spots.</span></li>
            <li className="flex gap-2.5"><Badge color="#a78bfa">Predicted</Badge><span>DBSCAN over segments the model flags high-risk for {meta?.test_year} → {num(hotspots?.predicted?.length)} zones.</span></li>
            <li className="flex gap-2.5"><Badge color="#22c55e">Matched</Badge><span>Predicted zones within ~1.4 km of a historical cluster are <b>confirmed</b>; the rest are <b>emerging</b> — early warnings before accidents happen.</span></li>
          </ul>
        </Card>

        <Card title="Why explainable (XAI)" icon={<Lightbulb size={15} />}>
          <p className="text-[12.5px] text-slate-300 leading-relaxed">
            A black-box risk score is not actionable for a city planner. SHAP decomposes each segment's probability into
            additive per-feature contributions, so the map can answer <em>“why is this road dangerous?”</em> — e.g. high
            traffic volume, a poor historical severity index, weak lighting or a nearby school. The same attributions
            power the per-segment panel, the global beeswarm and the route warnings.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {top.slice(0, 4).map((f) => (
              <Badge key={f.feature} color={GROUP_COLORS[groupOf(f.feature)]}>{f.label}</Badge>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- metrics glossary + stack ---------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Evaluation metrics" icon={<BarChart3 size={15} />} bodyClass="p-4">
          <div className="space-y-2">
            {METRICS.map(([k, v]) => (
              <div key={k} className="flex gap-2.5">
                <span className="text-[11.5px] font-semibold text-brand-300 w-16 shrink-0">{k}</span>
                <span className="text-[12px] text-slate-400 leading-relaxed">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Tech stack" icon={<Cpu size={15} />} bodyClass="p-4">
          <div className="space-y-3">
            {Object.entries(STACK).map(([k, items]) => (
              <div key={k}>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">{k}</div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- limitations + future + team ---------------- */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Limitations" icon={<AlertTriangle size={15} />} bodyClass="p-4">
          <ul className="space-y-2">
            {LIMITS.map((l, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] text-slate-400 leading-relaxed">
                <span className="text-amber-400 shrink-0">•</span>{l}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Future work" icon={<Telescope size={15} />} bodyClass="p-4">
          <ul className="space-y-2">
            {FUTURE.map((l, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] text-slate-400 leading-relaxed">
                <span className="text-violet-400 shrink-0">•</span>{l}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Team roles" icon={<Users size={15} />} bodyClass="p-4">
          <ul className="space-y-2.5">
            {TEAM.map(([role, desc], i) => (
              <li key={i}>
                <div className="text-[12px] font-semibold text-slate-200">Member {i + 1} · {role}</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">{desc}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* ---------------- reproducibility ---------------- */}
      <Card title="Reproducibility" subtitle="From a clean clone to a running dashboard" icon={<Terminal size={15} />}>
        <pre className="rounded-xl bg-black/45 border border-white/10 p-3.5 overflow-x-auto text-[11.5px] leading-relaxed font-mono text-slate-300">
{REPRO.map((line, i) => (
  <div key={i} className={line.startsWith('#') ? 'text-brand-300' : line ? 'text-slate-200' : 'h-1'}>{line || ' '}</div>
))}
        </pre>
        <p className="text-[11px] text-slate-500 mt-3">
          The frontend loads the JSON bundle the pipeline writes to <code className="font-mono text-brand-300">frontend/public/data/</code>,
          so the dashboard works fully offline. Starting the FastAPI service additionally enables live re-scoring.
        </p>
      </Card>

      <footer className="text-center text-[11px] text-slate-600 py-2">
        RiskSense AI · explainable spatio-temporal road-accident risk · generated {meta?.generated_at ? new Date(meta.generated_at).toLocaleDateString() : ''}
      </footer>
    </div>
  )
}

function Confusion({ cm }) {
  const total = cm.tn + cm.fp + cm.fn + cm.tp || 1
  const cell = (label, v, color) => (
    <div className="rounded-lg py-2 text-center" style={{ background: `${color}18`, border: `1px solid ${color}33` }}>
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="text-[15px] font-bold tabular" style={{ color }}>{v}</div>
    </div>
  )
  return (
    <div className="mt-3">
      <div className="text-[11px] text-slate-400 mb-1.5">Confusion matrix · {num(total)} test segments</div>
      <div className="grid grid-cols-2 gap-2">
        {cell('True neg', cm.tn, '#22c55e')}
        {cell('False pos', cm.fp, '#f59e0b')}
        {cell('False neg', cm.fn, '#ef4444')}
        {cell('True pos', cm.tp, '#38bdf8')}
      </div>
    </div>
  )
}
