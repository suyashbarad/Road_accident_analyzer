import { Component } from 'react'
import { useData } from './data/DataContext'
import Header from './components/Header'
import ExploreView from './views/ExploreView'
import AnalyticsView from './views/AnalyticsView'
import ModelsView from './views/ModelsView'
import ExplainView from './views/ExplainView'
import HotspotsView from './views/HotspotsView'
import RouteView from './views/RouteView'
import MethodView from './views/MethodView'
import { ShieldCheck, AlertTriangle, Terminal } from 'lucide-react'

function Splash() {
  return (
    <div className="h-full w-full grid place-items-center">
      <div className="text-center animate-fadeUp">
        <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-500/30 mb-5">
          <ShieldCheck size={26} className="text-white" />
        </div>
        <h1 className="text-lg font-extrabold tracking-tight">
          Risk<span className="text-gradient">Sense</span> AI
        </h1>
        <p className="text-[12.5px] text-slate-400 mt-1">Loading trained model outputs…</p>
        <div className="mx-auto mt-5 h-1 w-40 rounded-full bg-white/8 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-brand-400 to-violet-500 animate-[shimmer_1.2s_infinite]" />
        </div>
      </div>
    </div>
  )
}

function ErrorScreen({ error }) {
  return (
    <div className="h-full w-full grid place-items-center p-6">
      <div className="max-w-lg glass rounded-2xl p-6 shadow-glow">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-10 w-10 rounded-xl grid place-items-center bg-amber-500/15 text-amber-400">
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-slate-100">Model data not found</h2>
            <p className="text-[11.5px] text-slate-400">The frontend loads JSON produced by the ML pipeline.</p>
          </div>
        </div>
        <p className="text-[12.5px] text-slate-300 mb-3">
          Run the training pipeline once to generate <code className="font-mono text-brand-300">frontend/public/data/*.json</code>:
        </p>
        <div className="rounded-xl bg-black/40 border border-white/10 p-3 font-mono text-[12px] text-slate-200 flex items-center gap-2">
          <Terminal size={14} className="text-brand-300 shrink-0" />
          <span>cd backend && ../.venv/bin/python run_pipeline.py</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-3 break-words">Error: {error}</p>
      </div>
    </div>
  )
}

// Contains a runtime error in any single view so it can never blank the whole
// app again; navigating (key change) or "Try again" resets it.
class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('View crashed:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="h-full w-full grid place-items-center p-6">
          <div className="max-w-md glass rounded-2xl p-6 shadow-glow text-center">
            <span className="mx-auto h-11 w-11 rounded-xl grid place-items-center bg-rose-500/15 text-rose-400 mb-3">
              <AlertTriangle size={22} />
            </span>
            <h2 className="text-[15px] font-bold text-slate-100">This view hit an error</h2>
            <p className="text-[12px] text-slate-400 mt-1 mb-4 break-words">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-[12px] px-3.5 py-1.5 rounded-lg bg-brand-500/20 border border-brand-400/50 text-white hover:bg-brand-500/30 transition"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const { loading, error, view } = useData()

  if (loading) return <Splash />
  if (error) return <ErrorScreen error={error} />

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 relative">
        <ViewErrorBoundary key={view}>
          {view === 'map' && <ExploreView />}
          {view === 'analytics' && <AnalyticsView />}
          {view === 'models' && <ModelsView />}
          {view === 'explain' && <ExplainView />}
          {view === 'hotspots' && <HotspotsView />}
          {view === 'routes' && <RouteView />}
          {view === 'method' && <MethodView />}
        </ViewErrorBoundary>
      </main>
    </div>
  )
}
