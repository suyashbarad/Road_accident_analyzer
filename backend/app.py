"""
FastAPI live-inference service
==============================
Serves the trained Random Forest + SHAP explanations over HTTP so the dashboard
can switch from "static model" (pre-computed JSON) to "API live" mode.

    cd backend && uvicorn app:app --reload --port 8000

The Vite dev server proxies /api -> http://localhost:8000, so the frontend's
/api/health probe and any live calls just work.

Endpoints
---------
GET  /api/health            liveness + model metadata (probed by the frontend)
GET  /api/summary           dataset counts + risk distribution
GET  /api/segments          every segment with risk score + category
GET  /api/segments/{id}     one segment incl. top SHAP factors + explanation
POST /api/predict           live score for a segment id OR an arbitrary feature dict
GET  /api/explain/{id}      SHAP factors for a segment
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config as C
from analysis import FEATURE_LABELS, risk_category, explain_sentence, _format_value

ARTIFACT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "model.joblib")

app = FastAPI(
    title="RiskSense AI - Road Accident Risk API",
    version="1.0.0",
    description="Explainable spatio-temporal road-accident risk prediction (live inference).",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATE: Dict[str, Any] = {}


def _load() -> Dict[str, Any]:
    """Load the model artefact once and pre-compute the design matrix + index."""
    if _STATE:
        return _STATE
    if not os.path.exists(ARTIFACT):
        raise HTTPException(
            status_code=503,
            detail="Model artefact missing. Run: cd backend && python run_pipeline.py",
        )
    art = joblib.load(ARTIFACT)
    names: List[str] = art["names"]
    rows: List[Dict[str, Any]] = art["rows"]
    X = np.array([[float(r[n]) for n in names] for r in rows], dtype=float)
    _STATE.update(
        model=art["model"],
        names=names,
        rows=rows,
        X=X,
        X_mean=X.mean(axis=0),
        risk=np.asarray(art["risk"], dtype=float),
        segments=art["segments"],
        shap_per_segment=art["shap_per_segment"],
        index_by_id={s["id"]: i for i, s in enumerate(art["segments"])},
    )
    return _STATE


def _explain_one(model, x: np.ndarray, names: List[str]) -> List[Dict[str, Any]]:
    """Top SHAP contributions for a single feature row (mirrors analysis.compute_shap)."""
    import shap

    sv = shap.TreeExplainer(model).shap_values(x)
    if isinstance(sv, list):
        sv = sv[1]
    sv = np.asarray(sv, dtype=float)
    if sv.ndim == 3:
        sv = sv[:, :, 1]
    contrib = sv[0]
    order = np.argsort(-np.abs(contrib))[:5]
    factors = []
    for i in order:
        if abs(contrib[i]) < 1e-6:
            continue
        factors.append({
            "feature": names[i],
            "label": FEATURE_LABELS.get(names[i], names[i]),
            "value": _format_value(names[i], x[0, i]),
            "raw_value": round(float(x[0, i]), 4),
            "shap": round(float(contrib[i]), 5),
            "direction": "increase" if contrib[i] > 0 else "decrease",
        })
    return factors


class PredictRequest(BaseModel):
    segment_id: Optional[str] = None
    features: Optional[Dict[str, float]] = None


@app.on_event("startup")
def _warm() -> None:
    try:
        _load()
    except Exception:  # artefact may not exist yet; endpoints will 503 gracefully
        pass


@app.get("/api/health")
def health() -> Dict[str, Any]:
    art = _load()
    return {
        "status": "ok",
        "model": "Random Forest",
        "city": C.CITY_NAME,
        "n_segments": len(art["segments"]),
        "n_features": len(art["names"]),
        "mode": "live",
    }


@app.get("/api/summary")
def summary() -> Dict[str, Any]:
    art = _load()
    risk = art["risk"]
    dist = {k: 0 for k in ("low", "moderate", "high", "very_high")}
    for r in risk:
        dist[risk_category(float(r))] += 1
    return {
        "city": C.CITY_NAME,
        "country": C.COUNTRY,
        "n_segments": len(art["segments"]),
        "n_features": len(art["names"]),
        "train_years": list(C.TRAIN_YEARS),
        "test_year": C.TEST_YEAR,
        "risk_distribution": dist,
        "high_risk": int(dist["high"] + dist["very_high"]),
    }


@app.get("/api/segments")
def segments() -> List[Dict[str, Any]]:
    art = _load()
    out = []
    for i, s in enumerate(art["segments"]):
        r = float(art["risk"][i])
        out.append({**s, "risk": round(r, 4), "category": risk_category(r)})
    return out


@app.get("/api/segments/{seg_id}")
def segment_detail(seg_id: str) -> Dict[str, Any]:
    art = _load()
    i = art["index_by_id"].get(seg_id)
    if i is None:
        raise HTTPException(404, f"Unknown segment {seg_id}")
    r = float(art["risk"][i])
    factors = art["shap_per_segment"][i]
    return {
        **art["segments"][i],
        "risk": round(r, 4),
        "category": risk_category(r),
        "factors": factors,
        "explanation": explain_sentence(factors),
    }


@app.get("/api/explain/{seg_id}")
def explain(seg_id: str) -> Dict[str, Any]:
    art = _load()
    i = art["index_by_id"].get(seg_id)
    if i is None:
        raise HTTPException(404, f"Unknown segment {seg_id}")
    factors = art["shap_per_segment"][i]
    return {"segment_id": seg_id, "factors": factors, "explanation": explain_sentence(factors)}


@app.post("/api/predict")
def predict(req: PredictRequest) -> Dict[str, Any]:
    art = _load()
    names = art["names"]
    if req.segment_id:
        i = art["index_by_id"].get(req.segment_id)
        if i is None:
            raise HTTPException(404, f"Unknown segment {req.segment_id}")
        x = art["X"][i : i + 1]
        seg = art["segments"][i]
    else:
        if not req.features:
            raise HTTPException(422, "Provide segment_id or a features dict")
        missing = [n for n in names if n not in req.features]
        x = np.array(
            [[float(req.features.get(n, art["X_mean"][j])) for j, n in enumerate(names)]],
            dtype=float,
        )
        seg = {"id": "custom", "name": "Custom feature vector", "road_class": None,
               "mid_lat": None, "mid_lon": None}
        if missing:
            seg["imputed_defaults"] = missing
    proba = float(art["model"].predict_proba(x)[0, 1])
    factors = _explain_one(art["model"], x, names)
    return {
        "segment": seg,
        "risk": round(proba, 4),
        "category": risk_category(proba),
        "factors": factors,
        "explanation": explain_sentence(factors),
    }
