# RiskSense AI — Explainable Spatio-Temporal Road Accident Risk Prediction & Geospatial Hotspot Mapping

An end-to-end, research-grade web application that forecasts **which road segments will become accident
black-spots**, explains **why** with SHAP, detects **historical vs. emerging hotspots**, and recommends
**risk-aware routes** — all rendered on an interactive Leaflet dashboard.

Built as the AIES course project: *"Explainable AI-Based Spatio-Temporal Road Accident Risk Prediction and
Geospatial Hotspot Mapping."* Study area: **Pune, Maharashtra, India**.

---

## Highlights

| | |
|---|---|
| **Best model** | Random Forest — **ROC-AUC 0.961**, PR-AUC 0.938, Accuracy 0.901, F1 0.845 |
| **Validation** | Time-aware split (train 2022–23 → test 2024) + spatially-blocked hold-out (ROC-AUC 0.961) |
| **Explainability** | SHAP global importance, beeswarm, dependence plots, per-segment attributions |
| **Hotspots** | 22 historical density clusters vs. 8 predicted zones → confirmed / emerging |
| **Scale** | 152 road segments · 81 junctions · 4,600 accidents · 18 POIs · 30 features |

## Features

**Interactive risk map (Explore)**
- Colour-coded road segments by predicted risk (low → very high) with neon halos on dangerous roads
- Predicted-risk surface heat + historical accident-density heat (toggleable)
- Accident point markers (severity-sized/coloured) with tooltips
- Historical hotspot rings + predicted/emerging zone markers
- Points of interest (schools, hospitals, markets, transit hubs)
- 4 basemaps (dark / streets / light / satellite), layer panel, risk-emphasis slider, legend
- Click any segment → right drawer with risk gauge + top SHAP factors + road profile
- Global search across roads and places

**Analytics** — temporal (hour/day/month), severity, type, weather and road-class breakdowns with charts.

**Models** — LR vs. Random Forest vs. Gradient Boosting: metric table, ROC & PR curves, confusion matrices, CV stability.

**Explainability** — SHAP global importance, feature-family contribution, beeswarm, dependence plots.

**Hotspots** — historical vs. predicted comparison, confirmed/emerging flags, jump-to-map.

**Route risk planner** — Dijkstra *fastest* vs. risk-aware *safest* path; distance/time/avg-risk/exposure
comparison, per-segment risk profile ribbon, worst-stretch drill-down, high-risk warnings.

**Method** — in-app research documentation: objectives, architecture, data, feature families, model
comparison, experiments A–G, ablation, spatial validation, metrics glossary, tech stack, team, reproducibility.

---

## Architecture

```
 backend/ (Python)                          frontend/ (React + Vite)
 ─────────────────────                      ────────────────────────────
 generator.py   road net + POIs + accidents
 features.py    30 leakage-safe features
 train.py       LR / RF / GB + experiments A–G
 analysis.py    SHAP + hotspot detection
 export_data.py ──► frontend/public/data/*.json ──► DataContext (static mode)
 run_pipeline.py  orchestrator                    │
      │                                            ▼
      └─► artifacts/model.joblib ──► app.py (FastAPI) ──► /api/* (live mode)
```

The frontend loads the **JSON bundle** the pipeline writes, so it works fully offline ("Static model").
Starting the FastAPI service additionally enables **live re-scoring** ("API live" badge).

## Project structure

```
backend/
  config.py          study area, seeds, thresholds, model set
  generator.py       synthetic-but-realistic network / POIs / accidents
  features.py        feature engineering (leakage-safe)
  train.py           models + controlled experiments
  analysis.py        SHAP + hotspot detection/comparison
  export_data.py     writes frontend JSON bundle
  run_pipeline.py    end-to-end orchestrator
  app.py             FastAPI live-inference service
  artifacts/         model.joblib (locally generated)
frontend/
  public/data/       JSON bundle produced by the pipeline
  src/views/         Explore, Analytics, Models, Explain, Hotspots, Routes, Method
  src/components/    Header, Sidebar, SegmentDetail, MapCanvas, charts, ui
  src/lib/           risk, routing (Dijkstra), heatLayer, stats, features
```

---

## Quickstart

### 0 · Prerequisites
- Python 3.11+ and Node 18+

### 1 · Python environment + training
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
python run_pipeline.py        # trains models, runs experiments, writes JSON + artefact
```
This writes `frontend/public/data/*.json` (consumed by the UI) and `backend/artifacts/model.joblib`.

### 2 · Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

### 3 · (Optional) live-inference API
```bash
cd backend
uvicorn app:app --reload --port 8000
```
The Vite dev server proxies `/api → :8000`; the header badge switches to **API live**.

### Production build
```bash
cd frontend && npm run build   # outputs frontend/dist
```

---

## Methodology (summary)

- **Leakage-safe target:** features use only the training window (2022–23); the label is whether a segment
  became high-risk in the held-out test year (2024, ≥ 13 accidents).
- **Feature families (30):** historical accidents (11), road/geospatial (10), traffic exposure (2),
  surrounding POI context (5), environment (2).
- **Experiments:** A→B→C feature-group ladder (ROC-AUC 0.930 → 0.947 → 0.961); D model comparison;
  ablation per family; F spatially-blocked validation; G time-aware split with cross-validation.
- **Hotspots:** historical = grid-density connected components; predicted = DBSCAN over high-risk segments;
  zones within ~1.4 km of a historical cluster are *confirmed*, others *emerging*.
- **Routing:** Dijkstra with `cost = length` (fastest) vs. `cost = length·(1 + 8·risk)` (safest).

## API reference (live mode)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | liveness + model metadata |
| GET | `/api/summary` | counts + risk distribution |
| GET | `/api/segments` | all segments with risk + category |
| GET | `/api/segments/{id}` | one segment + SHAP factors + explanation |
| GET | `/api/explain/{id}` | SHAP factors for a segment |
| POST | `/api/predict` | live score for a `segment_id` or arbitrary `features` dict |

## Notes

- **Synthetic data:** accidents are simulated from a realistic latent-risk surface over a real city grid.
  The schema is drop-in compatible with real police/OSM feeds — replace `generator.py` output with real
  records to run the same pipeline on real data.
- **Artefact provenance:** `backend/artifacts/model.joblib` is produced locally by `run_pipeline.py` and
  loaded with `joblib` only from that trusted path (never from untrusted/network sources).
- **Reproducibility:** `RANDOM_SEED = 42` everywhere; versions pinned in `backend/requirements.txt`.

## Team roles (4 members)

1. Data & geospatial engineering — network, POIs, generator, feature store
2. ML modelling & evaluation — model zoo, time-aware/spatial CV, experiments A–G
3. Explainability & hotspots — SHAP pipeline, clustering, confirmed/emerging logic
4. Frontend & geovisualisation — Leaflet dashboard, analytics, route planner, deployment
