"""Lightweight metric execution for Studio MVP."""

from __future__ import annotations

import numpy as np
import pandas as pd


def _predict_signal(model, X: pd.DataFrame, task_type: str) -> np.ndarray:
    if task_type == "classification" and hasattr(model, "predict_proba"):
        probs = model.predict_proba(X)
        return np.max(probs, axis=1)
    preds = model.predict(X)
    return np.asarray(preds, dtype=float)


def _attributions(model, feature_names: list[str]) -> np.ndarray:
    if hasattr(model, "feature_importances_"):
        values = np.asarray(model.feature_importances_, dtype=float)
    elif hasattr(model, "coef_"):
        coef = np.asarray(model.coef_, dtype=float)
        values = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)
    else:
        values = np.ones(len(feature_names), dtype=float)

    if values.shape[0] != len(feature_names):
        values = np.resize(values, len(feature_names))

    values = np.abs(values)
    total = values.sum()
    return values / total if total > 0 else np.full(len(feature_names), 1 / len(feature_names))


def compute_metric_score(*, model, task_type: str, X: pd.DataFrame, explainer: str, metric: str) -> float:
    feature_names = list(X.columns)
    if not feature_names:
        return 0.0

    base_attr = _attributions(model, feature_names)
    if explainer == "lime":
        attr = np.sqrt(base_attr)
    elif explainer == "treeshap":
        attr = np.power(base_attr, 1.25)
    else:
        attr = base_attr
    attr = attr / attr.sum()

    k = max(1, min(3, len(feature_names)))
    top_idx = np.argsort(attr)[::-1][:k]
    means = X.mean(numeric_only=True)

    base_signal = _predict_signal(model, X, task_type)

    X_removed = X.copy()
    for idx in top_idx:
        col = feature_names[idx]
        X_removed[col] = means.get(col, 0.0)
    removed_signal = _predict_signal(model, X_removed, task_type)

    X_kept = X.copy()
    for i, col in enumerate(feature_names):
        if i not in top_idx:
            X_kept[col] = means.get(col, 0.0)
    kept_signal = _predict_signal(model, X_kept, task_type)

    drop = np.mean(np.clip(base_signal - removed_signal, 0, None))
    retain_gap = np.mean(np.abs(base_signal - kept_signal))

    if metric == "comprehensiveness":
        score = drop
    elif metric == "sufficiency":
        score = 1.0 - retain_gap
    elif metric == "faithfulness_correlation":
        impacts = []
        for col in feature_names:
            Xi = X.copy()
            Xi[col] = means.get(col, 0.0)
            sig = _predict_signal(model, Xi, task_type)
            impacts.append(float(np.mean(np.abs(base_signal - sig))))
        impacts_arr = np.asarray(impacts, dtype=float)
        if np.std(impacts_arr) == 0 or np.std(attr) == 0:
            score = 0.0
        else:
            corr = float(np.corrcoef(attr, impacts_arr)[0, 1])
            score = (corr + 1.0) / 2.0
    else:
        score = float(np.mean(attr))

    return float(np.clip(score, 0.0, 1.0))
