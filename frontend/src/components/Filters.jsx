import { useData } from '../data/DataContext'
import { Chip, DualRange, Toggle } from './ui'
import {
  SEVERITY_ORDER,
  SEVERITY_COLORS,
  ACCIDENT_TYPES,
  WEATHERS,
  LIGHTING,
  DAY_NAMES,
  MONTH_NAMES,
  hourLabel,
} from '../lib/risk'

const ROAD_CLASSES = [
  { key: 'highway', color: '#a78bfa' },
  { key: 'arterial', color: '#60a5fa' },
  { key: 'collector', color: '#38bdf8' },
  { key: 'residential', color: '#94a3b8' },
]

function Group({ title, children, action }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

const HOUR_PRESETS = {
  All: [0, 23],
  Night: [19, 5],
  'AM rush': [7, 11],
  'PM rush': [17, 21],
}

export default function Filters() {
  const { filters, updateFilter, toggleInArray, resetFilters, filteredAccidents, accidents } = useData()

  const setHourPreset = (key) => {
    const [a, b] = HOUR_PRESETS[key]
    if (key === 'Night') {
      // night spans midnight -> use a flag-friendly range 19..23 plus 0..5 handled by onlyNight
      updateFilter({ hours: [0, 23], onlyNight: true })
    } else {
      updateFilter({ hours: [a, b], onlyNight: false })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-semibold text-slate-200">Filters</div>
          <div className="text-[10.5px] text-slate-500">
            <span className="text-brand-300 font-semibold tabular">{filteredAccidents.length.toLocaleString()}</span> of{' '}
            {accidents.length.toLocaleString()} accidents match
          </div>
        </div>
        <button
          onClick={resetFilters}
          className="text-[10.5px] font-medium text-slate-400 hover:text-white border border-white/10 rounded-md px-2 py-1 transition"
        >
          Reset
        </button>
      </div>

      <Group title="Year">
        <DualRange
          min={2022}
          max={2024}
          value={filters.years}
          onChange={(years) => updateFilter({ years })}
          format={(v) => v}
        />
      </Group>

      <Group title="Month">
        <DualRange
          min={1}
          max={12}
          value={filters.months}
          onChange={(months) => updateFilter({ months })}
          format={(v) => MONTH_NAMES[v - 1]}
        />
      </Group>

      <Group
        title="Time of day"
        action={
          <div className="flex gap-1">
            {Object.keys(HOUR_PRESETS).map((k) => (
              <button
                key={k}
                onClick={() => setHourPreset(k)}
                className="text-[9.5px] px-1.5 py-0.5 rounded border border-white/10 text-slate-400 hover:text-white hover:border-brand-400/50 transition"
              >
                {k}
              </button>
            ))}
          </div>
        }
      >
        <DualRange
          min={0}
          max={23}
          value={filters.hours}
          onChange={(hours) => updateFilter({ hours })}
          format={(v) => hourLabel(v)}
        />
        <div className="mt-2">
          <Toggle
            checked={filters.onlyNight}
            onChange={(onlyNight) => updateFilter({ onlyNight })}
            label="Night-time only"
            hint="19:00 – 05:00"
          />
        </div>
      </Group>

      <Group title="Day of week">
        <div className="flex flex-wrap gap-1.5">
          {DAY_NAMES.map((d, i) => (
            <Chip key={d} active={filters.weekdays.includes(i)} onClick={() => toggleInArray('weekdays', i)} color="#2f8bff">
              {d}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Severity">
        <div className="flex flex-wrap gap-1.5">
          {SEVERITY_ORDER.map((s) => (
            <Chip
              key={s}
              active={filters.severities.includes(s)}
              onClick={() => toggleInArray('severities', s)}
              color={SEVERITY_COLORS[s]}
            >
              <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ background: SEVERITY_COLORS[s] }} />
              {s}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Accident type">
        <div className="flex flex-wrap gap-1.5">
          {ACCIDENT_TYPES.map((t) => (
            <Chip key={t} active={filters.types.includes(t)} onClick={() => toggleInArray('types', t)} color="#a78bfa">
              {t}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Weather">
        <div className="flex flex-wrap gap-1.5">
          {WEATHERS.map((w) => (
            <Chip key={w} active={filters.weathers.includes(w)} onClick={() => toggleInArray('weathers', w)} color="#38bdf8">
              {w}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Lighting">
        <div className="flex flex-wrap gap-1.5">
          {LIGHTING.map((l) => (
            <Chip key={l} active={filters.lighting.includes(l)} onClick={() => toggleInArray('lighting', l)} color="#eab308">
              {l}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Road class">
        <div className="flex flex-wrap gap-1.5">
          {ROAD_CLASSES.map((r) => (
            <Chip
              key={r.key}
              active={filters.roadClasses.includes(r.key)}
              onClick={() => toggleInArray('roadClasses', r.key)}
              color={r.color}
            >
              {r.key[0].toUpperCase() + r.key.slice(1)}
            </Chip>
          ))}
        </div>
      </Group>
    </div>
  )
}
