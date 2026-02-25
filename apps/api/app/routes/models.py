from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.store import ModelRecord, store

router = APIRouter(prefix="/models", tags=["models"])


class TrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    target_column: str
    model_type: str = "random_forest"


@router.post("/train")
def train_model(payload: TrainRequest) -> dict:
    dataset = store.datasets.get(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if payload.target_column not in dataset.columns:
        raise HTTPException(status_code=400, detail="Target column not in dataset columns")

    model_id = store.next_id("model", store.models)
    dataset.target_column = payload.target_column

    store.models[model_id] = ModelRecord(
        model_id=model_id,
        dataset_id=payload.dataset_id,
        target_column=payload.target_column,
        model_type=payload.model_type,
    )

    return {
        "model_id": model_id,
        "dataset_id": payload.dataset_id,
        "status": "trained",
        "model_type": payload.model_type,
    }
