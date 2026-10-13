"""
Synthetic Data Generator
========================
Builds a realistic, fully reproducible spatio-temporal accident dataset for the
study area:

  1. A road network (nodes = intersections, edges = road segments) laid over a
     jittered grid so it looks organic on a real basemap.
  2. Points of interest (schools, hospitals, markets, ...) that drive pedestrian
     exposure.
  3. A latent ("ground-truth") risk surface combining road geometry, traffic,
     environment and context.  Accidents are then sampled proportionally to this
     latent risk * exposure, with realistic temporal / severity / weather
     patterns.

The latent risk is intentionally NOT exported as a model input -- it is only the
data-generating process, so the ML models have to genuinely learn it.
"""

from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

import config as C


# ---------------------------------------------------------------------------
# Small geo helpers
# ---------------------------------------------------------------------------
def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in kilometres."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def perpendicular_offset(p0, p1, dist_deg):
    """Return a point offset perpendicular to segment p0->p1 (for curvature)."""
    lat0, lon0 = p0
    lat1, lon1 = p1
    dlat, dlon = lat1 - lat0, lon1 - lon0
    norm = math.hypot(dlat, dlon) or 1e-9
    # unit perpendicular
    px, py = -dlon / norm, dlat / norm
    mid = ((lat0 + lat1) / 2 + px * dist_deg, (lon0 + lon1) / 2 + py * dist_deg)
    return mid


# ---------------------------------------------------------------------------
# Road network
# ---------------------------------------------------------------------------
def build_road_network(rng: random.Random):
    n = C.GRID_N
    lat_step = (C.BBOX["max_lat"] - C.BBOX["min_lat"]) / (n - 1)
    lon_step = (C.BBOX["max_lon"] - C.BBOX["min_lon"]) / (n - 1)

    nodes = {}
    for i in range(n):
        for j in range(n):
            lat = C.BBOX["min_lat"] + i * lat_step + rng.uniform(-C.GRID_JITTER, C.GRID_JITTER)
            lon = C.BBOX["min_lon"] + j * lon_step + rng.uniform(-C.GRID_JITTER, C.GRID_JITTER)
            nodes[(i, j)] = {
                "id": f"N{i}_{j}",
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "i": i,
                "j": j,
            }

    def road_class(i, j, i2, j2):
        """Assign a road class based on position (creates arterial corridors)."""
        mid = (n - 1) / 2
        # a diagonal expressway + the two central corridors
        if (i == j) or (i + j == n - 1):
            return "highway"
        if i in (int(mid), int(mid) + 1) or j in (int(mid), int(mid) + 1):
            return "arterial"
        dc = max(abs(i - mid), abs(j - mid))
        if dc <= 2:
            return "collector"
        return "residential"

    segments = []
    seg_index = 0

    def add_segment(a_key, b_key, cls):
        nonlocal seg_index
        a, b = nodes[a_key], nodes[b_key]
        p0 = (a["lat"], a["lon"])
        p1 = (b["lat"], b["lon"])
        length_km = haversine_km(*p0, *p1)
        # gentle curvature: offset the midpoint
        curv = rng.uniform(0.0, 0.35) if cls in ("collector", "residential") else rng.uniform(0.0, 0.15)
        off_deg = curv * length_km / 111.0
        mid = perpendicular_offset(p0, p1, off_deg * rng.choice([-1, 1]))
        coords = [list(p0), [round(mid[0], 6), round(mid[1], 6)], list(p1)]

        attr = C.ROAD_CLASS_ATTR[cls]
        lanes = rng.randint(*attr["lanes"])
        speed = rng.randint(*attr["speed"])
        aadt = int(rng.uniform(*attr["aadt"]))
        lighting = round(rng.uniform(*attr["light"]), 3)
        congestion = round(min(0.98, max(0.05, (aadt / 72000) * rng.uniform(0.7, 1.25))), 3)
        surface = round(rng.uniform(0.45, 1.0), 3)
        has_signal = 1 if (cls in ("highway", "arterial") and rng.random() < 0.55) else (1 if rng.random() < 0.18 else 0)

        seg = {
            "id": f"S{seg_index:04d}",
            "n0": a["id"],
            "n1": b["id"],
            "i0": a_key[0], "j0": a_key[1], "i1": b_key[0], "j1": b_key[1],
            "coords": coords,
            "length_km": round(length_km, 4),
            "road_class": cls,
            "road_class_ord": C.ROAD_CLASS_ORDER[cls],
            "lanes": lanes,
            "speed_limit": speed,
            "aadt": aadt,
            "congestion_index": congestion,
            "lighting": lighting,
            "surface_condition": surface,
            "has_signal": has_signal,
            "curvature": round(curv, 3),
            "mid_lat": coords[1][0],
            "mid_lon": coords[1][1],
            "name": None,  # filled later
        }
        segments.append(seg)
        seg_index += 1

    for i in range(n):
        for j in range(n):
            if j + 1 < n:
                add_segment((i, j), (i, j + 1), road_class(i, j, i, j + 1))
            if i + 1 < n:
                add_segment((i, j), (i + 1, j), road_class(i, j, i + 1, j))

    # a handful of diagonal connectors for realism
    for _ in range(8):
        i = rng.randint(0, n - 2)
        j = rng.randint(0, n - 2)
        add_segment((i, j), (i + 1, j + 1), road_class(i, j, i + 1, j + 1))

    # node degree -> junction flag
    degree = {}
    for s in segments:
        degree[s["n0"]] = degree.get(s["n0"], 0) + 1
        degree[s["n1"]] = degree.get(s["n1"], 0) + 1
    for key, nd in nodes.items():
        nd["degree"] = degree.get(nd["id"], 0)
        nd["is_junction"] = 1 if nd["degree"] >= 3 else 0

    # road names
    prefixes = ["FC", "Senapati Bapat", "Baner", "Kothrud", "Hadapsar", "Viman Nagar",
                "Aundh", "Wakad", "Shivaji", "Tilak", "MG", "Ring", "Nagar", "Sinhagad",
                "Katraj", "Balewadi", "Pashan", "Warje", "Yerwada", "Camp"]
    for idx, s in enumerate(segments):
        s["name"] = f"{prefixes[idx % len(prefixes)]} {s['road_class'].title()} Rd"

    node_list = list(nodes.values())
    return node_list, segments


# ---------------------------------------------------------------------------
# Points of interest
# ---------------------------------------------------------------------------
def build_pois(rng: random.Random, nodes):
    pois = []
    chosen = rng.sample(nodes, min(C.N_POIS, len(nodes)))
    names = {
        "school": ["St. Vincent School", "Symbiosis School", "Bishop's High School", "Jnana Prabha School"],
        "hospital": ["Sassoon Hospital", "Ruby Hall Clinic", "Jehangir Hospital", "Sahyadri Hospital"],
        "market": ["Market Yard", "Laxmi Road Market", "Camp Bazaar", "Mandai Market"],
        "mall": ["Phoenix Marketcity", "Amanora Mall", "Westend Mall", "Pavilion Mall"],
        "college": ["COEP", "Fergusson College", "BMCC", "PICT"],
        "transit_hub": ["Pune Station", "Shivajinagar Bus Depot", "Swargate ST Stand", "Hinjewadi Phase 1"],
    }
    counters = {k: 0 for k in names}
    for nd in chosen:
        ptype = rng.choice(C.POI_TYPES)
        nm = names[ptype][counters[ptype] % len(names[ptype])]
        counters[ptype] += 1
        pois.append({
            "id": f"P{len(pois):03d}",
            "type": ptype,
            "name": nm,
            "lat": round(nd["lat"] + rng.uniform(-0.003, 0.003), 6),
            "lon": round(nd["lon"] + rng.uniform(-0.003, 0.003), 6),
        })
    return pois


# ---------------------------------------------------------------------------
# Latent risk surface (the ground-truth generating process)
# ---------------------------------------------------------------------------
def compute_latent_risk(segments, pois):
    """Return a dict seg_id -> latent risk in [0,1] used to sample accidents."""
    # pre-compute nearest POI distances per segment midpoint
    def poi_dist(seg, ptype):
        best = 1e9
        for p in pois:
            if ptype is None or p["type"] == ptype:
                d = haversine_km(seg["mid_lat"], seg["mid_lon"], p["lat"], p["lon"])
                best = min(best, d)
        return best

    max_aadt = max(s["aadt"] for s in segments)
    risk = {}
    for s in segments:
        d_school = poi_dist(s, "school")
        d_hosp = poi_dist(s, "hospital")
        d_market = poi_dist(s, "market")
        # proximity exposure (closer -> higher), exponential decay ~ 1km
        poi_exposure = (math.exp(-d_school / 0.8) * 1.0
                        + math.exp(-d_market / 0.9) * 1.1
                        + math.exp(-d_hosp / 1.0) * 0.5)
        traffic = s["aadt"] / max_aadt
        speed_factor = (s["speed_limit"] - 25) / 65.0
        dark_factor = 1.0 - s["lighting"]
        class_factor = s["road_class_ord"] / 3.0
        curvature = s["curvature"]
        surface_bad = 1.0 - s["surface_condition"]

        latent = (
            0.26 * traffic
            + 0.20 * speed_factor
            + 0.16 * dark_factor
            + 0.14 * class_factor
            + 0.16 * min(1.0, poi_exposure / 2.0)
            + 0.10 * curvature
            + 0.08 * surface_bad
            + 0.10 * s["congestion_index"]
        )
        risk[s["id"]] = min(0.99, max(0.02, latent))
    return risk


# ---------------------------------------------------------------------------
# Accident simulation
# ---------------------------------------------------------------------------
HOUR_WEIGHTS = [
    0.4, 0.3, 0.25, 0.2, 0.25, 0.5,      # 00-05
    1.0, 1.6, 2.4, 2.6, 2.2, 1.9,        # 06-11
    1.7, 1.6, 1.6, 1.8, 2.2, 3.0,        # 12-17
    3.4, 3.2, 2.8, 2.4, 1.8, 1.0,        # 18-23
]
MONTH_WEIGHTS = [1.0, 0.95, 1.0, 1.1, 1.2, 1.5, 1.7, 1.75, 1.6, 1.3, 1.15, 1.05]  # monsoon peak Jul-Sep

SEVERITY_LEVELS = ["Fatal", "Grievous", "Minor", "Property Damage"]
ACCIDENT_TYPES = ["Two-wheeler", "Rear-end", "Side-impact", "Pedestrian",
                  "Single-vehicle", "Rollover", "Head-on"]
WEATHERS = ["Clear", "Rain", "Fog", "Overcast"]
LIGHTING_COND = ["Daylight", "Dark - lit", "Dark - unlit", "Dawn/Dusk"]
ROAD_CONDITIONS = ["Dry", "Wet", "Slippery"]


def _pick(rng, items, weights):
    return rng.choices(items, weights=weights, k=1)[0]


def point_on_segment(rng, seg):
    """Sample a point along the (3-point) polyline with small lateral jitter."""
    coords = seg["coords"]
    t = rng.uniform(0.12, 0.88)
    if t < 0.5:
        a, b = coords[0], coords[1]
        u = t / 0.5
    else:
        a, b = coords[1], coords[2]
        u = (t - 0.5) / 0.5
    lat = a[0] + (b[0] - a[0]) * u
    lon = a[1] + (b[1] - a[1]) * u
    jitter = 0.0006
    return round(lat + rng.uniform(-jitter, jitter), 6), round(lon + rng.uniform(-jitter, jitter), 6)


def generate_accidents(rng: random.Random, segments, pois, latent_risk):
    max_aadt = max(s["aadt"] for s in segments)
    # sampling weight ~ latent risk (amplified) * traffic exposure
    weights = []
    for s in segments:
        w = (0.15 + latent_risk[s["id"]]) ** 2.2 * (0.4 + s["aadt"] / max_aadt)
        weights.append(w)

    seg_by_id = {s["id"]: s for s in segments}
    poi_by_type = {}
    for p in pois:
        poi_by_type.setdefault(p["type"], []).append(p)

    years = list(range(C.START_YEAR, C.END_YEAR + 1))
    accidents = []
    for k in range(C.N_ACCIDENTS):
        seg = _pick(rng, segments, weights)
        year = _pick(rng, years, [1.0, 1.06, 1.14])       # slight upward trend
        month = _pick(rng, list(range(1, 13)), MONTH_WEIGHTS)
        # number of days in month (approx, ignore leap nuance)
        dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
        day = rng.randint(1, dim)
        hour = _pick(rng, list(range(24)), HOUR_WEIGHTS)
        minute = rng.randint(0, 59)
        ts = datetime(year, month, day, hour, minute)
        weekday = ts.weekday()  # 0=Mon .. 6=Sun

        is_night = hour >= 19 or hour <= 5
        is_rush = hour in (8, 9, 10, 17, 18, 19, 20, 21)
        is_monsoon = month in (6, 7, 8, 9)
        is_weekend = weekday >= 4

        # ---- weather ----
        if is_monsoon:
            weather = _pick(rng, WEATHERS, [0.20, 0.62, 0.03, 0.15])
        elif month in (12, 1) and is_night:
            weather = _pick(rng, WEATHERS, [0.55, 0.05, 0.25, 0.15])
        else:
            weather = _pick(rng, WEATHERS, [0.72, 0.10, 0.02, 0.16])

        # ---- lighting condition ----
        if 7 <= hour < 18:
            light_cond = "Daylight"
        elif hour in (5, 6, 18, 19):
            light_cond = _pick(rng, ["Dawn/Dusk", "Dark - lit", "Dark - unlit"], [0.5, 0.3, 0.2])
        else:
            if seg["lighting"] > 0.75:
                light_cond = _pick(rng, ["Dark - lit", "Dark - unlit"], [0.85, 0.15])
            else:
                light_cond = _pick(rng, ["Dark - lit", "Dark - unlit"], [0.35, 0.65])

        # ---- severity (worse at high speed / dark / bad weather) ----
        sev_score = (
            0.35 * ((seg["speed_limit"] - 25) / 65.0)
            + 0.30 * (1.0 if light_cond.startswith("Dark") else 0.25)
            + 0.20 * (1.0 if weather in ("Rain", "Fog") else 0.15)
            + 0.15 * (seg["road_class_ord"] / 3.0)
        )
        sev_score = min(1.0, max(0.0, sev_score + rng.uniform(-0.12, 0.12)))
        fatal_w = 0.02 + 0.20 * sev_score
        griev_w = 0.10 + 0.30 * sev_score
        minor_w = 0.45 - 0.15 * sev_score
        prop_w = max(0.05, 0.55 - 0.45 * sev_score)
        severity = _pick(rng, SEVERITY_LEVELS, [fatal_w, griev_w, minor_w, prop_w])

        # ---- accident type (context dependent) ----
        near_school = any(haversine_km(seg["mid_lat"], seg["mid_lon"], p["lat"], p["lon"]) < 0.6
                          for p in poi_by_type.get("school", []))
        ped_w = 1.6 if (near_school or seg["road_class"] == "residential") else 0.7
        rear_w = 1.0 + 1.6 * seg["congestion_index"]
        two_w = 2.4 if seg["road_class"] in ("collector", "residential") else 1.4
        single_w = 0.8 + 1.2 * seg["curvature"]
        roll_w = 0.5 if seg["speed_limit"] >= 60 else 0.15
        head_w = 0.7 if seg["road_class"] in ("highway", "arterial") else 0.25
        side_w = 1.3 if seg["has_signal"] else 0.9
        atype = _pick(rng, ACCIDENT_TYPES,
                      [two_w, rear_w, side_w, ped_w, single_w, roll_w, head_w])

        road_cond = "Wet" if weather == "Rain" else _pick(rng, ROAD_CONDITIONS, [0.8, 0.1, 0.1])
        lat, lon = point_on_segment(rng, seg)

        accidents.append({
            "id": k,
            "seg_id": seg["id"],
            "lat": lat,
            "lon": lon,
            "ts": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "year": year, "month": month, "day": day,
            "hour": hour, "minute": minute, "weekday": weekday,
            "is_night": int(is_night), "is_rush": int(is_rush),
            "is_monsoon": int(is_monsoon), "is_weekend": int(is_weekend),
            "severity": severity,
            "type": atype,
            "weather": weather,
            "lighting": light_cond,
            "road_condition": road_cond,
            "road_class": seg["road_class"],
            "speed_limit": seg["speed_limit"],
        })

    accidents.sort(key=lambda a: a["ts"])
    for new_id, a in enumerate(accidents):
        a["id"] = new_id
    return accidents
