from fastapi import APIRouter, HTTPException

from app.catalog import METRICS, compatible_explainers_for_model
from app.store import store

router = APIRouter(prefix="/explainers", tags=["explainers"])


@router.get("/compatible")
def compatible_explainers(model_id: str, dataset_id: str) -> dict:
    dataset = store.datasets.get(dataset_id)
    model = store.models.get(model_id)

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if model.dataset_id != dataset_id:
        raise HTTPException(status_code=400, detail="Model and dataset mismatch")

    explainer_catalog = compatible_explainers_for_model(model.model_type)

    return {
        "model_id": model_id,
        "dataset_id": dataset_id,
        "target_column": model.target_column,
        "model_type": model.model_type,
        "explainers": [item["key"] for item in explainer_catalog],
        "metrics": [item["key"] for item in METRICS],
        "explainer_details": explainer_catalog,
        "metric_details": METRICS,
    }
