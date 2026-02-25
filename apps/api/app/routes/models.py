from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/models", tags=["models"])


class TrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    target_column: str
    model_type: str = "random_forest"


@router.post("/train")
def train_model(payload: TrainRequest) -> dict:
    return {
        "model_id": "model_mock_001",
        "dataset_id": payload.dataset_id,
        "status": "trained",
        "model_type": payload.model_type,
    }
