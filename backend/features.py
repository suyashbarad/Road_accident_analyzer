"""
Feature Engineering
===================
Builds one feature vector per road segment.  Critically, every *historical*
feature is derived ONLY from the training window (2022-2023); the target comes
from the held-out future window (2024).  This is what keeps the study
leakage-safe and time-aware.

Feature groups:
  historical  - past accident frequency / severity / temporal composition
  road        - geometry, class, lanes, speed, lighting, surface, junctions
  traffic     - exposure (AADT) and congestion
  context     - proximity to schools / hospitals / markets, pedestrian volume
  environment - rainfall, fog, night-time exposure
"""

from __future__ import annotations

import math
from collections import defaultdict

import numpy as np

import config as C
from generator import haversine_km


# Feature -> group mapping (used by the ablation / experiment studies)
FEATURE_GROUPS = {
    "hist_count": "historical",
    "hist_rate_per_km": "historical",
    "hist_severity_index": "historical",
    "hist_fatal": "historical",
    "hist_night_ratio": "historical",
    "hist_weekend_ratio": "historical",
    "hist_monsoon_ratio": "historical",
    "hist_rush_ratio": "historical",
    "hist_rain_ratio": "historical",
    "hist_type_diversity": "historical",
    "recent_trend": "historical",
    "road_class_ord": "road",
    "lanes": "road",
    "speed_limit": "road",
    "length_km": "road",
    "curvature": "road",
    "lighting": "road",
    "surface_condition": "road",
    "has_signal": "road",
    "junction_density": "road",
    "night_index": "road",
    "aadt_log": "traffic",
    "congestion_index": "traffic",
    "dist_to_school": "context",
    "dist_to_hospital": "context",
    "dist_to_market": "context",
    "poi_density": "context",
    "pedestrian_volume": "context",
    "annual_rainfall": "environment",
    "fog_days": "environment",
}

FEATURE_NAMES = list(FEATURE_GROUPS.keys())

SEVERITY_WEIGHT = {"Fatal": 1.0, "Grievous": 0.6, "Minor": 0.3, "Property Damage": 0.12}


def _group_features(groups):
    return [f for f in FEATURE_NAMES if FEATURE_GROUPS[f] in groups]


GROUP_SETS = {
    "A": ["historical"],                                   # baseline temporal
    "B": ["historical", "road"],                           # + road / geospatial
    "C": ["historical", "road", "traffic", "context", "environment"],  # full
}


def build_features(segments, accidents, pois, nodes):
    """Return (feature_rows, targets, extras) aligned with `segments` order."""
    # ---- index accidents by segment, split train / test windows ----
    train_acc = defaultdict(list)
    test_count = defaultdict(int)
    for a in accidents:
        if a["year"] in C.TRAIN_YEARS:
            train_acc[a["seg_id"]].append(a)
        elif a["year"] == C.TEST_YEAR:
            test_count[a["seg_id"]] += 1

    # ---- node degree for junction density ----
    node_deg = {n["id"]: n.get("degree", 2) for n in nodes}

    # ---- POIs by type ----
    poi_by_type = defaultdict(list)
    for p in pois:
        poi_by_type[p["type"]].append(p)

    rows = []
    y_counts = []
    for s in segments:
        lat, lon = s["mid_lat"], s["mid_lon"]
        accs = train_acc.get(s["id"], [])
        cnt = len(accs)
        length = max(s["length_km"], 0.05)

        # ---- historical (train window only) ----
        sev_index = sum(SEVERITY_WEIGHT.get(a["severity"], 0.2) for a in accs)
        fatal = sum(1 for a in accs if a["severity"] == "Fatal")
        night = sum(1 for a in accs if a["is_night"])
        weekend = sum(1 for a in accs if a["is_weekend"])
        monsoon = sum(1 for a in accs if a["is_monsoon"])
        rush = sum(1 for a in accs if a["is_rush"])
        rain = sum(1 for a in accs if a["weather"] == "Rain")
        types = len(set(a["type"] for a in accs))

        # recent trend: last 6 months of train window vs the 6 before it
        recent = sum(1 for a in accs if (a["year"] == 2023 and a["month"] >= 7))
        earlier = sum(1 for a in accs if (a["year"] == 2023 and a["month"] < 7)) or 1
        trend = recent / earlier

        denom = max(cnt, 1)

        # ---- context ----
        def nearest(ptype, cap=5.0):
            best = cap
            for p in poi_by_type.get(ptype, []):
                best = min(best, haversine_km(lat, lon, p["lat"], p["lon"]))
            return round(best, 4)

        d_school = nearest("school")
        d_hosp = nearest("hospital")
        d_market = nearest("market")
        poi_near = sum(1 for p in pois if haversine_km(lat, lon, p["lat"], p["lon"]) < 0.8)
        pedestrian = round(
            min(1.0, (math.exp(-d_school / 0.9) + math.exp(-d_market / 0.9)) / 2.0)
            * (0.6 + 0.4 * (s["road_class_ord"] / 3.0)) + 0.05 * poi_near, 4)

        # ---- environment (spatial gradient + noise, city monsoon climate) ----
        lat_norm = (lat - C.BBOX["min_lat"]) / (C.BBOX["max_lat"] - C.BBOX["min_lat"])
        annual_rainfall = round(720 + 180 * lat_norm + np.random.normal(0, 25), 2)
        fog_days = round(6 + 10 * (1 - lat_norm) + np.random.normal(0, 2), 2)

        # ---- junction density (neighbouring intersections) ----
        junction_density = round((node_deg.get(s["n0"], 2) + node_deg.get(s["n1"], 2)) / 2.0, 3)

        feat = {
            "_id": s["id"],
            "_lat": lat,
            "_lon": lon,
            "hist_count": cnt,
            "hist_rate_per_km": round(cnt / length, 3),
            "hist_severity_index": round(sev_index, 3),
            "hist_fatal": fatal,
            "hist_night_ratio": round(night / denom, 4),
            "hist_weekend_ratio": round(weekend / denom, 4),
            "hist_monsoon_ratio": round(monsoon / denom, 4),
            "hist_rush_ratio": round(rush / denom, 4),
            "hist_rain_ratio": round(rain / denom, 4),
            "hist_type_diversity": types,
            "recent_trend": round(min(trend, 4.0), 4),
            "road_class_ord": s["road_class_ord"],
            "lanes": s["lanes"],
            "speed_limit": s["speed_limit"],
            "length_km": s["length_km"],
            "curvature": s["curvature"],
            "lighting": s["lighting"],
            "surface_condition": s["surface_condition"],
            "has_signal": s["has_signal"],
            "junction_density": junction_density,
            "night_index": round(1.0 - s["lighting"], 4),
            "aadt_log": round(math.log10(max(s["aadt"], 100)), 4),
            "congestion_index": s["congestion_index"],
            "dist_to_school": d_school,
            "dist_to_hospital": d_hosp,
            "dist_to_market": d_market,
            "poi_density": poi_near,
            "pedestrian_volume": pedestrian,
            "annual_rainfall": annual_rainfall,
            "fog_days": fog_days,
        }
        rows.append(feat)
        y_counts.append(test_count.get(s["id"], 0))

    # ---- target: high-risk in the future window (binary) ----
    y_counts = np.array(y_counts)
    threshold = max(1, int(np.percentile(y_counts, C.HIGH_RISK_PERCENTILE)))
    y = (y_counts >= threshold).astype(int)

    extras = {"test_count": y_counts.tolist(), "threshold": int(threshold)}
    return rows, y, extras


def feature_matrix(rows, groups=None):
    """Return (X ndarray, names list) optionally restricted to feature groups."""
    names = FEATURE_NAMES if groups is None else _group_features(groups)
    X = np.array([[r[n] for n in names] for r in rows], dtype=float)
    return X, names
