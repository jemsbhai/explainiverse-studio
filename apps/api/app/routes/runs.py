from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.store import store

router = APIRouter(prefix="/runs", tags=["runs"])


class RunRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    model_id: str
    explainer: str
    metric: str


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

    return {
        "run_id": "run_mock_001",
        "status": "completed",
        "config": payload.model_dump(),
        "results": {
            "metric": payload.metric,
            "value": 0.42,
            "explainer": payload.explainer,
            "target_column": model.target_column,
            "dataset_rows": dataset.rows,
        },
    }
