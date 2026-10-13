"""
Pipeline Orchestrator
=====================
Runs the complete study end-to-end and writes both the frontend JSON bundle and
the backend model artefacts:

    python run_pipeline.py

Steps: generate data -> engineer features -> run experiments -> train deployed
model -> SHAP -> hotspots -> export.
"""

from __future__ import annotations

import os
import random
import time

import joblib
import numpy as np

import config as C
from generator import build_road_network, build_pois, compute_latent_risk, generate_accidents
from features import build_features, FEATURE_NAMES
from train import run_experiments, fit_deployed_model
from analysis import (
    compute_shap, detect_historical_hotspots,
    detect_predicted_hotspots, compare_hotspots,
)
from export_data import export_all

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
FRONTEND_DATA = os.path.join(PROJECT_ROOT, "frontend", "public", "data")
ARTIFACTS = os.path.join(BACKEND_DIR, "artifacts")


def main():
    t0 = time.time()
    random.seed(C.RANDOM_SEED)
    np.random.seed(C.RANDOM_SEED)
    rng = random.Random(C.RANDOM_SEED)

    print("=" * 64)
    print("  AI Road Accident Risk Prediction - training pipeline")
    print("=" * 64)

    print("[1/7] Building road network over %s, %s ..." % (C.CITY_NAME, C.COUNTRY))
    nodes, segments = build_road_network(rng)
    print("      %d intersections, %d road segments" % (len(nodes), len(segments)))

    print("[2/7] Placing points of interest ...")
    pois = build_pois(rng, nodes)

    print("[3/7] Simulating latent risk surface + %d accidents (%d-%d) ..."
          % (C.N_ACCIDENTS, C.START_YEAR, C.END_YEAR))
    latent = compute_latent_risk(segments, pois)
    accidents = generate_accidents(rng, segments, pois, latent)

    print("[4/7] Engineering %d leakage-safe features per segment ..." % len(FEATURE_NAMES))
    rows, y, extras = build_features(segments, accidents, pois, nodes)
    print("      target: %d/%d high-risk segments in %d (count >= %d)"
          % (int(y.sum()), len(y), C.TEST_YEAR, extras["threshold"]))

    print("[5/7] Running controlled experiments (A-G + ablation) ...")
    results = run_experiments(rows, y)
    best = results["best_model"]
    print("      best model by ROC-AUC: %s (%.3f)"
          % (best, results["D_model_comparison"][best]["roc_auc"]))

    print("[6/7] Training deployed Random Forest + SHAP explanations ...")
    rf, X, names, risk = fit_deployed_model(rows, y)
    shap_res = compute_shap(rf, X, names)
    top3 = ", ".join(f["label"] for f in shap_res["importance"][:3])
    print("      top SHAP drivers: %s" % top3)

    print("[7/7] Detecting hotspots + exporting frontend data ...")
    hist = detect_historical_hotspots(accidents)
    pred = detect_predicted_hotspots(segments, risk)
    pred = compare_hotspots(hist, pred)
    confirmed = sum(1 for z in pred if z["status"] == "confirmed")
    print("      %d historical clusters, %d predicted zones (%d confirmed, %d emerging)"
          % (len(hist), len(pred), confirmed, len(pred) - confirmed))

    os.makedirs(FRONTEND_DATA, exist_ok=True)
    os.makedirs(ARTIFACTS, exist_ok=True)
    written = export_all(
        FRONTEND_DATA, nodes=nodes, segments=segments, accidents=accidents,
        pois=pois, rows=rows, y=y, extras=extras, risk=risk, results=results,
        shap=shap_res, historical_hotspots=hist, predicted_hotspots=pred, rf=rf,
    )

    # ---- artefacts for the FastAPI live-inference server ----
    joblib.dump({
        "model": rf,
        "names": names,
        "rows": rows,
        "risk": risk.tolist(),
        "segments": [{k: s[k] for k in ("id", "name", "road_class", "mid_lat", "mid_lon")} for s in segments],
        "shap_per_segment": shap_res["per_segment"],
    }, os.path.join(ARTIFACTS, "model.joblib"))

    dt = time.time() - t0
    print("-" * 64)
    print("  Done in %.1fs. Wrote %d JSON files to frontend/public/data" % (dt, len(written)))
    print("  Model artefact: backend/artifacts/model.joblib")
    print("=" * 64)


if __name__ == "__main__":
    main()
