"""
Explainability (SHAP) & Hotspot Analysis
========================================
* SHAP: uses TreeExplainer on the deployed Random Forest to produce
  - global feature importance (mean |SHAP|),
  - a full SHAP matrix (for beeswarm / summary plots in the UI),
  - per-segment top contributing factors + a plain-language explanation.
* Hotspots:
  - historical hotspots via DBSCAN (haversine) clustering of accident points,
  - predicted hotspots by clustering high-risk segments,
  - a comparison that flags each predicted zone as "confirmed" (overlaps a
    historical cluster) or "emerging" (newly predicted).
"""

from __future__ import annotations

import math
from collections import defaultdict

import numpy as np
from sklearn.cluster import DBSCAN

import config as C
from generator import haversine_km


FEATURE_LABELS = {
    "hist_count": "Historical accident count",
    "hist_rate_per_km": "Accidents per km (history)",
    "hist_severity_index": "Historical severity index",
    "hist_fatal": "Historical fatal accidents",
    "hist_night_ratio": "Night-time accident share",
    "hist_weekend_ratio": "Weekend accident share",
    "hist_monsoon_ratio": "Monsoon accident share",
    "hist_rush_ratio": "Rush-hour accident share",
    "hist_rain_ratio": "Rainy-weather accident share",
    "hist_type_diversity": "Accident-type diversity",
    "recent_trend": "Recent accident trend",
    "road_class_ord": "Road class",
    "lanes": "Number of lanes",
    "speed_limit": "Speed limit (km/h)",
    "length_km": "Segment length (km)",
    "curvature": "Road curvature",
    "lighting": "Street lighting quality",
    "surface_condition": "Road surface condition",
    "has_signal": "Signalised intersection",
    "junction_density": "Junction density",
    "night_index": "Night-time darkness index",
    "aadt_log": "Traffic volume (AADT)",
    "congestion_index": "Congestion index",
    "dist_to_school": "Distance to nearest school",
    "dist_to_hospital": "Distance to nearest hospital",
    "dist_to_market": "Distance to nearest market",
    "poi_density": "Nearby POI density",
    "pedestrian_volume": "Pedestrian exposure",
    "annual_rainfall": "Annual rainfall",
    "fog_days": "Fog days per year",
}

ROAD_CLASS_NAMES = {0: "Residential", 1: "Collector", 2: "Arterial", 3: "Highway"}


def risk_category(risk: float) -> str:
    if risk < C.RISK_THRESHOLDS["low"]:
        return "low"
    if risk < C.RISK_THRESHOLDS["moderate"]:
        return "moderate"
    if risk < C.RISK_THRESHOLDS["high"]:
        return "high"
    return "very_high"


def _format_value(name, value):
    v = float(value)
    if name == "road_class_ord":
        return ROAD_CLASS_NAMES.get(int(round(v)), "Unknown")
    if name == "has_signal":
        return "Yes" if v >= 0.5 else "No"
    if name.startswith("dist_to_"):
        return f"{v:.2f} km"
    if name == "aadt_log":
        return f"{int(round(10 ** v)):,} veh/day"
    if name in ("annual_rainfall",):
        return f"{v:.0f} mm"
    if name in ("fog_days",):
        return f"{v:.0f} days"
    if name.endswith("_ratio") or name in ("congestion_index", "lighting",
                                           "surface_condition", "pedestrian_volume",
                                           "night_index"):
        return f"{v * 100:.0f}%" if v <= 1.0 else f"{v:.2f}"
    if abs(v - round(v)) < 1e-6:
        return f"{int(round(v))}"
    return f"{v:.2f}"


# ---------------------------------------------------------------------------
# SHAP
# ---------------------------------------------------------------------------
def compute_shap(rf, X, names):
    import shap
    explainer = shap.TreeExplainer(rf)
    sv = explainer.shap_values(X)
    if isinstance(sv, list):            # binary -> take positive class
        sv = sv[1]
    sv = np.asarray(sv, dtype=float)
    if sv.ndim == 3:                    # (samples, features, classes) -> positive class
        sv = sv[:, :, 1]
    ev = explainer.expected_value
    if isinstance(ev, (list, np.ndarray)):
        ev = float(np.array(ev).ravel()[-1])

    global_importance = np.abs(sv).mean(axis=0)
    order = np.argsort(-global_importance)

    importance = [{
        "feature": names[i],
        "label": FEATURE_LABELS.get(names[i], names[i]),
        "importance": round(float(global_importance[i]), 5),
    } for i in order]

    # per-segment top contributing factors
    per_segment = []
    for r in range(X.shape[0]):
        contrib = sv[r]
        idx = np.argsort(-np.abs(contrib))[:5]
        factors = []
        for i in idx:
            if abs(contrib[i]) < 1e-6:
                continue
            factors.append({
                "feature": names[i],
                "label": FEATURE_LABELS.get(names[i], names[i]),
                "value": _format_value(names[i], X[r, i]),
                "raw_value": round(float(X[r, i]), 4),
                "shap": round(float(contrib[i]), 5),
                "direction": "increase" if contrib[i] > 0 else "decrease",
            })
        per_segment.append(factors)

    return {
        "expected_value": round(float(ev), 5),
        "importance": importance,
        "matrix": np.round(sv, 5).tolist(),
        "feature_values": np.round(X, 4).tolist(),
        "names": names,
        "per_segment": per_segment,
    }


def explain_sentence(factors):
    ups = [f["label"].lower() for f in factors if f["direction"] == "increase"][:3]
    if not ups:
        return "Risk is driven by a combination of locally protective factors."
    if len(ups) == 1:
        return f"Elevated risk mainly because of high {ups[0]}."
    return "Elevated risk because of high " + ", ".join(ups[:-1]) + f" and {ups[-1]}."


# ---------------------------------------------------------------------------
# Hotspot detection
# ---------------------------------------------------------------------------
def _severity_breakdown(points):
    sev = defaultdict(int)
    typ = defaultdict(int)
    for p in points:
        sev[p["severity"]] += 1
        typ[p["type"]] += 1
    dom_type = max(typ, key=typ.get) if typ else "-"
    return dict(sev), dom_type


def detect_historical_hotspots(accidents, cell_deg=0.0032, min_count=20):
    """
    Grid-based hotspot detection.  Accidents are binned into ~350 m cells; cells
    above `min_count` are treated as 'hot' and 8-connected hot cells are merged
    into hotspot zones.  This avoids the density-chaining artefact of DBSCAN that
    otherwise collapses an entire corridor into a single cluster.
    """
    if not accidents:
        return []
    min_lat, min_lon = C.BBOX["min_lat"], C.BBOX["min_lon"]
    cells = defaultdict(list)
    for a in accidents:
        ci = int((a["lat"] - min_lat) // cell_deg)
        cj = int((a["lon"] - min_lon) // cell_deg)
        cells[(ci, cj)].append(a)

    hot = {k: v for k, v in cells.items() if len(v) >= min_count}
    visited, comps = set(), []
    for k in hot:
        if k in visited:
            continue
        stack, comp = [k], []
        while stack:
            c = stack.pop()
            if c in visited or c not in hot:
                continue
            visited.add(c)
            comp.append(c)
            ci, cj = c
            for di in (-1, 0, 1):
                for dj in (-1, 0, 1):
                    nb = (ci + di, cj + dj)
                    if nb in hot and nb not in visited:
                        stack.append(nb)
        comps.append(comp)

    hotspots = []
    for comp in comps:
        pts = [a for c in comp for a in hot[c]]
        count = len(pts)
        clat = sum(p["lat"] for p in pts) / count
        clon = sum(p["lon"] for p in pts) / count
        radius = max(0.2, max(haversine_km(clat, clon, p["lat"], p["lon"]) for p in pts))
        sev, dom_type = _severity_breakdown(pts)
        hotspots.append({
            "id": f"H{len(hotspots)}",
            "lat": round(clat, 6),
            "lon": round(clon, 6),
            "radius_km": round(radius, 3),
            "count": count,
            "fatal": sev.get("Fatal", 0),
            "severity": sev,
            "dominant_type": dom_type,
            "years": sorted(set(p["year"] for p in pts)),
            "n_cells": len(comp),
        })
    hotspots.sort(key=lambda h: -h["count"])
    max_count = hotspots[0]["count"] if hotspots else 1
    for i, h in enumerate(hotspots):
        h["rank"] = i + 1
        h["intensity"] = round(min(1.0, h["count"] / max_count), 3)
    return hotspots


def detect_predicted_hotspots(segments, risk, threshold=0.5, eps_km=0.9, min_samples=2):
    hi = [(s, r) for s, r in zip(segments, risk) if r >= threshold]
    if not hi:
        return []
    coords = np.radians([[s["mid_lat"], s["mid_lon"]] for s, _ in hi])
    db = DBSCAN(eps=eps_km / 6371.0, min_samples=min_samples, metric="haversine").fit(coords)
    labels = db.labels_
    groups = defaultdict(list)
    for (s, r), lab in zip(hi, labels):
        if lab != -1:
            groups[lab].append((s, r))

    zones = []
    for lab, members in groups.items():
        clat = float(np.mean([s["mid_lat"] for s, _ in members]))
        clon = float(np.mean([s["mid_lon"] for s, _ in members]))
        radius = max(0.25, max(haversine_km(clat, clon, s["mid_lat"], s["mid_lon"]) for s, _ in members))
        avg_risk = float(np.mean([r for _, r in members]))
        max_risk = float(np.max([r for _, r in members]))
        zones.append({
            "id": f"Z{lab}",
            "lat": round(clat, 6),
            "lon": round(clon, 6),
            "radius_km": round(radius, 3),
            "avg_risk": round(avg_risk, 4),
            "max_risk": round(max_risk, 4),
            "n_segments": len(members),
            "segment_ids": [s["id"] for s, _ in members],
            "category": risk_category(max_risk),
        })
    zones.sort(key=lambda z: -z["max_risk"])
    for i, z in enumerate(zones):
        z["rank"] = i + 1
    return zones


def compare_hotspots(historical, predicted, match_km=1.4):
    """Flag each predicted zone as confirmed (near a historical cluster) or emerging."""
    for z in predicted:
        best, best_d = None, 1e9
        for h in historical:
            d = haversine_km(z["lat"], z["lon"], h["lat"], h["lon"])
            if d < best_d:
                best, best_d = h, d
        if best is not None and best_d <= match_km:
            z["status"] = "confirmed"
            z["matched_hotspot"] = best["id"]
            z["match_distance_km"] = round(best_d, 3)
            z["historical_count"] = best["count"]
        else:
            z["status"] = "emerging"
            z["matched_hotspot"] = None
            z["match_distance_km"] = round(best_d, 3) if best else None
            z["historical_count"] = 0
    return predicted
