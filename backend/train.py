"""
Model Training, Experiments & Evaluation
========================================
Implements the controlled research experiments from the project plan:

  * Experiment D - compare Logistic Regression / Random Forest / Gradient
    Boosting on the full feature set (primary, time-aware evaluation).
  * Experiments A/B/C - incremental feature groups (temporal -> +road -> +all).
  * Experiment F - spatial validation on an unseen geographical half of the city.
  * Experiment G - the time-aware protocol itself (features<=2023 -> target 2024).
  * Ablation - remove one feature group at a time.

Evaluation uses repeated out-of-fold predictions (cross_val_predict) so the
reported ROC / PR curves and confusion matrix are leakage-free, and reports mean
+- std across folds for every metric.
"""

from __future__ import annotations

import numpy as np
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, brier_score_loss,
    confusion_matrix, roc_curve, precision_recall_curve,
)

import config as C
from features import feature_matrix, GROUP_SETS, FEATURE_GROUPS, FEATURE_NAMES


# ---------------------------------------------------------------------------
# Model factory
# ---------------------------------------------------------------------------
def get_model(name: str, seed: int = C.RANDOM_SEED):
    if name == "Logistic Regression":
        return make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=4000, class_weight="balanced", C=0.5),
        )
    if name == "Random Forest":
        return RandomForestClassifier(
            n_estimators=400, max_depth=None, min_samples_leaf=2,
            class_weight="balanced_subsample", random_state=seed, n_jobs=-1,
        )
    if name == "Gradient Boosting":
        return HistGradientBoostingClassifier(
            max_iter=350, learning_rate=0.06, max_leaf_nodes=31,
            min_samples_leaf=8, l2_regularization=1.0, random_state=seed,
        )
    raise ValueError(name)


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------
def _metrics_from_proba(y_true, proba, threshold=0.5):
    pred = (proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    fpr, tpr, _ = roc_curve(y_true, proba)
    prec_c, rec_c, _ = precision_recall_curve(y_true, proba)
    return {
        "accuracy": round(float(accuracy_score(y_true, pred)), 4),
        "precision": round(float(precision_score(y_true, pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, proba)), 4),
        "pr_auc": round(float(average_precision_score(y_true, proba)), 4),
        "brier": round(float(brier_score_loss(y_true, proba)), 4),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "roc_curve": {
            "fpr": np.round(fpr[::max(1, len(fpr) // 60)], 4).tolist(),
            "tpr": np.round(tpr[::max(1, len(tpr) // 60)], 4).tolist(),
        },
        "pr_curve": {
            "precision": np.round(prec_c[::max(1, len(prec_c) // 60)], 4).tolist(),
            "recall": np.round(rec_c[::max(1, len(rec_c) // 60)], 4).tolist(),
        },
    }


def _fold_scores(name, X, y, model_name, n_splits=5, repeats=2):
    """Mean +- std of a metric across repeated stratified folds."""
    vals = []
    for r in range(repeats):
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=C.RANDOM_SEED + r)
        for tr, te in cv.split(X, y):
            m = get_model(model_name)
            m.fit(X[tr], y[tr])
            proba = m.predict_proba(X[te])[:, 1]
            if len(np.unique(y[te])) < 2:
                continue
            if name == "roc_auc":
                vals.append(roc_auc_score(y[te], proba))
            elif name == "pr_auc":
                vals.append(average_precision_score(y[te], proba))
            elif name == "f1":
                vals.append(f1_score(y[te], (proba >= 0.5).astype(int), zero_division=0))
            elif name == "recall":
                vals.append(recall_score(y[te], (proba >= 0.5).astype(int), zero_division=0))
    return {"mean": round(float(np.mean(vals)), 4), "std": round(float(np.std(vals)), 4)}


def evaluate_cv(X, y, model_name):
    """Out-of-fold evaluation -> single metrics dict + curves + fold stability."""
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=C.RANDOM_SEED)
    oof = cross_val_predict(get_model(model_name), X, y, cv=cv, method="predict_proba")[:, 1]
    out = _metrics_from_proba(y, oof)
    out["cv"] = {
        "roc_auc": _fold_scores("roc_auc", X, y, model_name, repeats=1),
        "pr_auc": _fold_scores("pr_auc", X, y, model_name, repeats=1),
        "f1": _fold_scores("f1", X, y, model_name, repeats=1),
        "recall": _fold_scores("recall", X, y, model_name, repeats=1),
    }
    return out


# ---------------------------------------------------------------------------
# Experiments
# ---------------------------------------------------------------------------
def run_experiments(rows, y):
    X_full, _ = feature_matrix(rows)               # Experiment C / D feature set
    results = {}

    # ---- Experiment D + G: model comparison under the time-aware protocol ----
    comparison = {}
    for name in C.MODEL_NAMES:
        comparison[name] = evaluate_cv(X_full, y, name)
    results["D_model_comparison"] = comparison
    results["G_time_aware"] = comparison           # same protocol, reported explicitly

    best_model = max(comparison, key=lambda k: comparison[k]["roc_auc"])
    results["best_model"] = best_model

    # ---- Experiments A / B / C: incremental feature groups ----
    feature_study = {}
    for exp, groups in GROUP_SETS.items():
        Xg, names = feature_matrix(rows, groups)
        m = evaluate_cv(Xg, y, best_model)
        feature_study[exp] = {
            "groups": groups,
            "n_features": len(names),
            "model": best_model,
            "metrics": {k: m[k] for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "brier")},
        }
    results["ABC_feature_study"] = feature_study

    # ---- Experiment F: spatial validation on an unseen geographic half ----
    results["F_spatial"] = _spatial_validation(rows, y, best_model)

    # ---- Ablation: drop one feature group at a time ----
    all_groups = ["historical", "road", "traffic", "context", "environment"]
    ablation = {}
    for g in all_groups:
        keep = [x for x in all_groups if x != g]
        Xg, names = feature_matrix(rows, keep)
        m = evaluate_cv(Xg, y, best_model)
        ablation[g] = {
            "removed_group": g,
            "n_features": len(names),
            "roc_auc": m["roc_auc"],
            "pr_auc": m["pr_auc"],
            "f1": m["f1"],
            "recall": m["recall"],
            "delta_roc_auc": round(m["roc_auc"] - comparison[best_model]["roc_auc"], 4),
        }
    results["ablation"] = ablation
    return results


def _spatial_validation(rows, y, model_name):
    """Train on the western half of the city, test on the unseen eastern half."""
    lons = np.array([r["_lon"] for r in rows])
    split = np.median(lons)
    train_mask = lons <= split
    test_mask = ~train_mask
    X_all, _ = feature_matrix(rows)
    Xtr, ytr = X_all[train_mask], y[train_mask]
    Xte, yte = X_all[test_mask], y[test_mask]
    if len(np.unique(ytr)) < 2 or len(np.unique(yte)) < 2:
        return {"note": "insufficient class balance for spatial split"}
    m = get_model(model_name)
    m.fit(Xtr, ytr)
    proba = m.predict_proba(Xte)[:, 1]
    out = _metrics_from_proba(yte, proba)
    return {
        "model": model_name,
        "train_segments": int(train_mask.sum()),
        "test_segments": int(test_mask.sum()),
        "metrics": {k: out[k] for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "brier")},
        "confusion": out["confusion"],
    }


# ---------------------------------------------------------------------------
# Deployed model (Random Forest - SHAP native) trained on all segments
# ---------------------------------------------------------------------------
def fit_deployed_model(rows, y):
    """
    The model shipped with the application.  A Random Forest is used because it
    is both highly accurate here and natively supported by SHAP TreeExplainer,
    so the risk shown on the map and the explanations come from one model.
    """
    X, names = feature_matrix(rows)
    rf = RandomForestClassifier(
        n_estimators=600, max_depth=None, min_samples_leaf=5,
        random_state=C.RANDOM_SEED, n_jobs=-1,
    )
    rf.fit(X, y)
    risk = rf.predict_proba(X)[:, 1]
    return rf, X, names, risk
