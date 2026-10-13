"""
Road Accident Risk Prediction - Configuration
================================================
Central configuration for the study area, simulation parameters and
modelling defaults. Everything the pipeline needs is declared here so the
study is fully reproducible.

Study area: Pune, Maharashtra, India (a realistic mid-size city with a mix of
highways, arterials, collectors and residential streets).
"""

from __future__ import annotations

# ----------------------------------------------------------------------------
# Reproducibility
# ----------------------------------------------------------------------------
RANDOM_SEED = 42

# ----------------------------------------------------------------------------
# Study area (Pune, India)
# ----------------------------------------------------------------------------
CITY_NAME = "Pune"
COUNTRY = "India"
CENTER = (18.5204, 73.8567)          # (lat, lon)
BBOX = {                              # bounding box of the simulated grid
    "min_lat": 18.4780,
    "max_lat": 18.5690,
    "min_lon": 73.8060,
    "max_lon": 73.9090,
}

# Road-network grid resolution (nodes x nodes). 9x9 -> ~150 segments.
GRID_N = 9
GRID_JITTER = 0.0022                  # degrees of organic jitter on nodes

# ----------------------------------------------------------------------------
# Accident simulation
# ----------------------------------------------------------------------------
N_ACCIDENTS = 4600                    # total accidents over the study window
START_YEAR = 2022
END_YEAR = 2024                       # inclusive; 2024 is the "future" window

# Time-aware split (leakage safe): model is trained on the past and asked to
# predict the risk of the future window.
TRAIN_YEARS = (2022, 2023)            # features derived only from these years
TEST_YEAR = 2024                      # target window

# ----------------------------------------------------------------------------
# Road classes and their physical attributes
# ----------------------------------------------------------------------------
# lanes, speed_limit(km/h), aadt range, base lighting quality
ROAD_CLASS_ATTR = {
    "highway":      {"lanes": (4, 6), "speed": (70, 90), "aadt": (45000, 72000), "light": (0.85, 1.0)},
    "arterial":     {"lanes": (3, 4), "speed": (50, 70), "aadt": (26000, 46000), "light": (0.75, 0.95)},
    "collector":    {"lanes": (2, 3), "speed": (40, 55), "aadt": (11000, 26000), "light": (0.55, 0.85)},
    "residential":  {"lanes": (2, 2), "speed": (25, 40), "aadt": (2500, 11000),  "light": (0.30, 0.70)},
}

ROAD_CLASS_ORDER = {"residential": 0, "collector": 1, "arterial": 2, "highway": 3}

# ----------------------------------------------------------------------------
# Points of interest (contextual exposure)
# ----------------------------------------------------------------------------
POI_TYPES = ["school", "hospital", "market", "mall", "college", "transit_hub"]
N_POIS = 18

# ----------------------------------------------------------------------------
# Risk categories (for map colouring / legend)
# ----------------------------------------------------------------------------
RISK_THRESHOLDS = {
    "low":       0.30,   # risk < 0.30
    "moderate":  0.50,   # 0.30 <= risk < 0.50
    "high":      0.70,   # 0.50 <= risk < 0.70
    "very_high": 1.01,   # risk >= 0.70
}

RISK_COLORS = {
    "low":       "#22c55e",
    "moderate":  "#eab308",
    "high":      "#f97316",
    "very_high": "#ef4444",
}

# ----------------------------------------------------------------------------
# Model set
# ----------------------------------------------------------------------------
MODEL_NAMES = ["Logistic Regression", "Random Forest", "Gradient Boosting"]

# High-risk target threshold percentile on the future-window accident counts.
HIGH_RISK_PERCENTILE = 68
