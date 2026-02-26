from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression

from app.store import ModelRecord, store

router = APIRouter(prefix="/models", tags=["models"])


class TrainRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    target_column: str
    model_type: str = "random_forest"


def _infer_task(y) -> str:
    if y.dtype.kind in {"O", "b"}:
        return "classification"
    unique = y.nunique(dropna=True)
    if unique <= 20 and y.dtype.kind in {"i", "u"}:
        return "classification"
    return "regression"


@router.post("/train")
def train_model(payload: TrainRequest) -> dict:
    dataset = store.datasets.get(payload.dataset_id)
    dataframe = store.dataset_frames.get(payload.dataset_id)
    if not dataset or dataframe is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if payload.target_column not in dataset.columns:
        raise HTTPException(status_code=400, detail="Target column not in dataset columns")

    if dataframe[payload.target_column].isna().any():
        raise HTTPException(status_code=400, detail="Target column contains missing values")

    feature_columns = [column for column in dataframe.columns if column != payload.target_column]
    if not feature_columns:
        raise HTTPException(status_code=400, detail="Dataset requires at least one feature column")

    X = dataframe[feature_columns].copy()
    X = X.apply(lambda col: col.fillna(col.median()) if col.dtype.kind in {"i", "u", "f"} else col)
    X = X.select_dtypes(include=["number"])
    if X.empty:
        raise HTTPException(status_code=400, detail="No numeric feature columns available for training")

    y = dataframe[payload.target_column]
    task_type = _infer_task(y)
    model_type = payload.model_type.lower()

    if task_type == "classification":
        if model_type == "logistic_regression":
            estimator = LogisticRegression(max_iter=300)
        else:
            estimator = RandomForestClassifier(n_estimators=100, random_state=42)
    else:
        if model_type == "linear_regression":
            estimator = LinearRegression()
        else:
            estimator = RandomForestRegressor(n_estimators=100, random_state=42)

    estimator.fit(X, y)

    model_id = store.next_id("model", store.models)
    dataset.target_column = payload.target_column

    store.models[model_id] = ModelRecord(
        model_id=model_id,
        dataset_id=payload.dataset_id,
        target_column=payload.target_column,
        model_type=payload.model_type,
        task_type=task_type,
    )
    store.model_objects[model_id] = estimator
    store.model_features[model_id] = list(X.columns)

    return {
        "model_id": model_id,
        "dataset_id": payload.dataset_id,
        "status": "trained",
        "model_type": payload.model_type,
        "task_type": task_type,
        "feature_count": len(X.columns),
    }


@router.get("")
def list_models() -> dict:
    models = [
        {
            "model_id": record.model_id,
            "dataset_id": record.dataset_id,
            "target_column": record.target_column,
            "model_type": record.model_type,
            "task_type": record.task_type,
        }
        for record in store.models.values()
    ]
    return {"models": models}
