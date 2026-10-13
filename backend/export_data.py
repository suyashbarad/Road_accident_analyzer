"""
Frontend Data Exporter
======================
Serialises every artefact the web application needs into static JSON files
under ``frontend/public/data``.  The React app loads these directly, so the
visualisation always reflects the *real* trained-model output (not mock data).
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import numpy as np

import config as C
from analysis import FEATURE_LABELS, risk_category


def _write(out_dir, name, obj):
    path = os.path.join(out_dir, name)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    return path


def export_all(out_dir, *, nodes, segments, accidents, pois, rows, y, extras,
               risk, results, shap, historical_hotspots, predicted_hotspots, rf):
    os.makedirs(out_dir, exist_ok=True)
    written = []

    seg_by_id = {s["id"]: s for s in segments}
    n_high = int((risk >= C.RISK_THRESHOLDS["high"]).sum())

    # ---- segments (map layer + detail panel) ----
    seg_out = []
    for i, s in enumerate(segments):
        r = float(risk[i])
        seg_out.append({
            "id": s["id"],
            "name": s["name"],
            "road_class": s["road_class"],
            "coords": s["coords"],
            "mid_lat": s["mid_lat"],
            "mid_lon": s["mid_lon"],
            "n0": s["n0"],
            "n1": s["n1"],
            "length_km": s["length_km"],
            "lanes": s["lanes"],
            "speed_limit": s["speed_limit"],
            "aadt": s["aadt"],
            "congestion_index": s["congestion_index"],
            "lighting": s["lighting"],
            "has_signal": s["has_signal"],
            "surface_condition": s["surface_condition"],
            "curvature": s["curvature"],
            "risk": round(r, 4),
            "category": risk_category(r),
            "hist_count": rows[i]["hist_count"],
            "future_count": extras["test_count"][i],
            "is_high_risk": bool(y[i]),
            "factors": shap["per_segment"][i],
        })
    written.append(_write(out_dir, "segments.json", seg_out))

    # ---- graph (for min-risk routing in the browser) ----
    graph = {
        "nodes": [{"id": n["id"], "lat": n["lat"], "lon": n["lon"],
                   "is_junction": n.get("is_junction", 0)} for n in nodes],
        "edges": [{"id": s["id"], "n0": s["n0"], "n1": s["n1"],
                   "length_km": s["length_km"],
                   "risk": round(float(risk[i]), 4),
                   "road_class": s["road_class"]} for i, s in enumerate(segments)],
    }
    written.append(_write(out_dir, "graph.json", graph))

    # ---- accidents (markers / heatmap / interactive charts) ----
    acc_out = [{
        "id": a["id"], "lat": a["lat"], "lon": a["lon"], "ts": a["ts"],
        "year": a["year"], "month": a["month"], "day": a["day"], "hour": a["hour"],
        "weekday": a["weekday"], "severity": a["severity"], "type": a["type"],
        "weather": a["weather"], "lighting": a["lighting"], "is_night": a["is_night"],
        "is_rush": a["is_rush"], "is_monsoon": a["is_monsoon"], "is_weekend": a["is_weekend"],
        "seg_id": a["seg_id"], "road_class": a["road_class"],
        "road_condition": a["road_condition"],
    } for a in accidents]
    written.append(_write(out_dir, "accidents.json", acc_out))

    # ---- POIs ----
    written.append(_write(out_dir, "pois.json", pois))

    # ---- hotspots ----
    written.append(_write(out_dir, "hotspots.json", {
        "historical": historical_hotspots,
        "predicted": predicted_hotspots,
    }))

    # ---- models / experiments ----
    written.append(_write(out_dir, "models.json", {
        "comparison": results["D_model_comparison"],
        "best_model": results["best_model"],
        "deployed_model": "Random Forest",
    }))
    written.append(_write(out_dir, "experiments.json", {
        "ABC_feature_study": results["ABC_feature_study"],
        "F_spatial": results["F_spatial"],
        "ablation": results["ablation"],
        "G_time_aware": {results["best_model"]: results["G_time_aware"][results["best_model"]]},
    }))

    # ---- explainability ----
    written.append(_write(out_dir, "feature_importance.json", {
        "importance": shap["importance"],
        "labels": FEATURE_LABELS,
    }))
    written.append(_write(out_dir, "shap.json", {
        "names": shap["names"],
        "labels": [FEATURE_LABELS.get(n, n) for n in shap["names"]],
        "expected_value": shap["expected_value"],
        "matrix": shap["matrix"],
        "feature_values": shap["feature_values"],
    }))

    # ---- meta ----
    meta = {
        "city": C.CITY_NAME,
        "country": C.COUNTRY,
        "center": list(C.CENTER),
        "bbox": C.BBOX,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "counts": {
            "segments": len(segments),
            "nodes": len(nodes),
            "accidents": len(accidents),
            "pois": len(pois),
            "high_risk_segments": n_high,
            "historical_hotspots": len(historical_hotspots),
            "predicted_hotspots": len(predicted_hotspots),
        },
        "train_years": list(C.TRAIN_YEARS),
        "test_year": C.TEST_YEAR,
        "high_risk_threshold_count": extras["threshold"],
        "n_features": len(shap["names"]),
        "best_model": results["best_model"],
        "risk_categories": [
            {"key": "low", "label": "Low", "color": C.RISK_COLORS["low"], "max": C.RISK_THRESHOLDS["low"]},
            {"key": "moderate", "label": "Moderate", "color": C.RISK_COLORS["moderate"], "max": C.RISK_THRESHOLDS["moderate"]},
            {"key": "high", "label": "High", "color": C.RISK_COLORS["high"], "max": C.RISK_THRESHOLDS["high"]},
            {"key": "very_high", "label": "Very High", "color": C.RISK_COLORS["very_high"], "max": 1.0},
        ],
        "feature_labels": FEATURE_LABELS,
    }
    written.append(_write(out_dir, "meta.json", meta))

    return written
