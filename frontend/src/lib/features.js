// Feature-group metadata mirrored from the backend (backend/features.py) so the
// explainability view can colour SHAP attributions by feature family.
export const FEATURE_GROUP = {
  hist_count: 'historical',
  hist_rate_per_km: 'historical',
  hist_severity_index: 'historical',
  hist_fatal: 'historical',
  hist_night_ratio: 'historical',
  hist_weekend_ratio: 'historical',
  hist_monsoon_ratio: 'historical',
  hist_rush_ratio: 'historical',
  hist_rain_ratio: 'historical',
  hist_type_diversity: 'historical',
  recent_trend: 'historical',
  road_class_ord: 'road',
  lanes: 'road',
  speed_limit: 'road',
  length_km: 'road',
  curvature: 'road',
  lighting: 'road',
  surface_condition: 'road',
  has_signal: 'road',
  junction_density: 'road',
  night_index: 'road',
  aadt_log: 'traffic',
  congestion_index: 'traffic',
  dist_to_school: 'context',
  dist_to_hospital: 'context',
  dist_to_market: 'context',
  poi_density: 'context',
  pedestrian_volume: 'context',
  annual_rainfall: 'environment',
  fog_days: 'environment',
}

export const GROUP_COLORS = {
  historical: '#2f8bff',
  road: '#a78bfa',
  traffic: '#22c55e',
  context: '#f59e0b',
  environment: '#38bdf8',
}

export const GROUP_LABELS = {
  historical: 'Historical accidents',
  road: 'Road / geospatial',
  traffic: 'Traffic exposure',
  context: 'Surroundings (POI)',
  environment: 'Environment',
}

export const groupOf = (feature) => FEATURE_GROUP[feature] || 'road'
export const groupColor = (feature) => GROUP_COLORS[groupOf(feature)]
