from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.evaluation import compute_metric_score
from app.store import RunRecord, store

router = APIRouter(prefix="/runs", tags=["runs"])


class RunRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    model_id: str
    explainer: str
    metric: str


def _serialize_run(run: RunRecord) -> dict:
    return {
        "run_id": run.run_id,
        "dataset_id": run.dataset_id,
        "model_id": run.model_id,
        "explainer": run.explainer,
        "metric": run.metric,
        "score": run.score,
        "created_at": run.created_at,
    }


@router.get("/summary")
def run_summary() -> dict:
    runs = list(store.runs.values())
    if not runs:
        return {
            "total_runs": 0,
            "unique_explainers": 0,
            "unique_metrics": 0,
            "best_run": None,
            "latest_run": None,
        }

    best = max(runs, key=lambda run: run.score)
    latest = max(runs, key=lambda run: run.created_at)

    return {
        "total_runs": len(runs),
        "unique_explainers": len({run.explainer for run in runs}),
        "unique_metrics": len({run.metric for run in runs}),
        "best_run": {
            "run_id": best.run_id,
            "explainer": best.explainer,
            "metric": best.metric,
            "score": best.score,
        },
        "latest_run": {
            "run_id": latest.run_id,
            "created_at": latest.created_at,
        },
    }


@router.get("/leaderboard")
def run_leaderboard() -> dict:
    rows: dict[tuple[str, str], dict] = {}

    for run in store.runs.values():
        key = (run.explainer, run.metric)
        if key not in rows:
            rows[key] = {
                "explainer": run.explainer,
                "metric": run.metric,
                "count": 0,
                "avg_score": 0.0,
                "best_score": run.score,
                "last_run_at": run.created_at,
            }

        row = rows[key]
        total = row["avg_score"] * row["count"] + run.score
        row["count"] += 1
        row["avg_score"] = total / row["count"]
        row["best_score"] = max(row["best_score"], run.score)
        row["last_run_at"] = max(row["last_run_at"], run.created_at)

    leaderboard = sorted(rows.values(), key=lambda item: item["avg_score"], reverse=True)
    return {"rows": leaderboard}


@router.get("")
def list_runs() -> dict:
    runs = [_serialize_run(run) for run in store.runs.values()]
    return {"runs": runs}


@router.get("/report")
def run_report() -> dict:
    generated_at = datetime.now(timezone.utc).isoformat()
    runs = [_serialize_run(run) for run in store.runs.values()]
    summary = run_summary()
    leaderboard = run_leaderboard()["rows"]

    return {
        "generated_at": generated_at,
        "summary": summary,
        "leaderboard": leaderboard,
        "runs": runs,
        "metadata": {
            "scoring_mode": "metric_execution_mvp",
            "store_mode": "in_memory",
        },
    }


@router.post("")
def create_run(payload: RunRequest) -> dict:
    dataset = store.datasets.get(payload.dataset_id)
    model = store.models.get(payload.model_id)
    dataframe = store.dataset_frames.get(payload.dataset_id)
    model_object = store.model_objects.get(payload.model_id)
    model_features = store.model_features.get(payload.model_id, [])

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if model.dataset_id != payload.dataset_id:
        raise HTTPException(status_code=400, detail="Model and dataset mismatch")
    if dataframe is None or model_object is None or not model_features:
        raise HTTPException(status_code=400, detail="Model artifacts missing. Retrain model.")

    X = dataframe[model_features].copy()
    X = X.apply(lambda col: col.fillna(col.median()) if col.dtype.kind in {"i", "u", "f"} else col)
    X = X.select_dtypes(include=["number"])
    if X.empty:
        raise HTTPException(status_code=400, detail="No numeric features available for run evaluation")

    run_id = store.next_id("run", store.runs)
    score = compute_metric_score(
        model=model_object,
        task_type=model.task_type,
        X=X,
        explainer=payload.explainer,
        metric=payload.metric,
    )
    created_at = datetime.now(timezone.utc).isoformat()

    store.runs[run_id] = RunRecord(
        run_id=run_id,
        dataset_id=payload.dataset_id,
        model_id=payload.model_id,
        explainer=payload.explainer,
        metric=payload.metric,
        score=score,
        created_at=created_at,
    )

    return {
        "run_id": run_id,
        "status": "completed",
        "config": payload.model_dump(),
        "results": {
            "metric": payload.metric,
            "value": score,
            "explainer": payload.explainer,
            "target_column": model.target_column,
            "dataset_rows": dataset.rows,
            "scoring_mode": "metric_execution_mvp",
        },
    }


@router.delete("")
def clear_runs() -> dict:
    cleared = len(store.runs)
    store.runs.clear()
    return {"cleared": cleared}
