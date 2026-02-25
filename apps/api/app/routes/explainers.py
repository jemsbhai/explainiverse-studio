from fastapi import APIRouter

router = APIRouter(prefix="/explainers", tags=["explainers"])


@router.get("/compatible")
def compatible_explainers(model_id: str, dataset_id: str) -> dict:
    return {
        "model_id": model_id,
        "dataset_id": dataset_id,
        "explainers": ["lime", "shap", "treeshap"],
        "metrics": ["comprehensiveness", "sufficiency", "faithfulness_correlation"],
    }
