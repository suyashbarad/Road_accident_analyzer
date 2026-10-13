import { useState } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import Filters from './Filters'
import { useData } from '../data/DataContext'

/** A collapsible filter card so analytic views can adjust the shared filters. */
export default function FilterPanel() {
  const [open, setOpen] = useState(false)
  const { filteredAccidents, accidents } = useData()
  const changed = filteredAccidents.length !== accidents.length

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-white/3 transition"
      >
        <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-200">
          <SlidersHorizontal size={14} className="text-brand-300" />
          Filters
          {changed && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/40">
              {filteredAccidents.length.toLocaleString()} / {accidents.length.toLocaleString()}
            </span>
          )}
        </span>
        <ChevronDown size={15} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 max-h-[60vh] overflow-y-auto">
          <Filters />
        </div>
      )}
    </div>
  )
}
