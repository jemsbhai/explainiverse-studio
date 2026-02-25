from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/runs", tags=["runs"])


class RunRequest(BaseModel):
    dataset_id: str
    model_id: str
    explainer: str
    metric: str


@router.post("")
def create_run(payload: RunRequest) -> dict:
    return {
        "run_id": "run_mock_001",
        "status": "completed",
        "config": payload.model_dump(),
        "results": {
            "metric": payload.metric,
            "value": 0.42,
            "explainer": payload.explainer,
        },
    }
