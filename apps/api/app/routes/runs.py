from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.store import RunRecord, store

router = APIRouter(prefix="/runs", tags=["runs"])


class RunRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    model_id: str
    explainer: str
    metric: str




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

@router.get("")
def list_runs() -> dict:
    runs = [
        {
            "run_id": run.run_id,
            "dataset_id": run.dataset_id,
            "model_id": run.model_id,
            "explainer": run.explainer,
            "metric": run.metric,
            "score": run.score,
            "created_at": run.created_at,
        }
        for run in store.runs.values()
    ]
    return {"runs": runs}


@router.post("")
def create_run(payload: RunRequest) -> dict:
    dataset = store.datasets.get(payload.dataset_id)
    model = store.models.get(payload.model_id)

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if model.dataset_id != payload.dataset_id:
        raise HTTPException(status_code=400, detail="Model and dataset mismatch")

    run_id = store.next_id("run", store.runs)
    score = 0.42
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
        },
    }


@router.delete("")
def clear_runs() -> dict:
    cleared = len(store.runs)
    store.runs.clear()
    return {"cleared": cleared}
