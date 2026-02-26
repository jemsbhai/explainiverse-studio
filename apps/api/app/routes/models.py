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


class UploadModelRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    dataset_id: str
    target_column: str
    model_type: str = "pytorch_classifier"
    framework: str = "pytorch"
    artifact_uri: str
    input_shape: list[int] | None = None
    class_labels: list[str] | None = None


class ValidateModelArtifactRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str


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
        framework="sklearn",
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


@router.post("/upload")
def upload_model(payload: UploadModelRequest) -> dict:
    dataset = store.datasets.get(payload.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if payload.target_column not in dataset.columns:
        raise HTTPException(status_code=400, detail="Target column not in dataset columns")

    if not payload.artifact_uri.strip():
        raise HTTPException(status_code=400, detail="artifact_uri is required")

    model_id = store.next_id("model", store.models)
    dataset.target_column = payload.target_column
    task_type = "classification"

    store.models[model_id] = ModelRecord(
        model_id=model_id,
        dataset_id=payload.dataset_id,
        target_column=payload.target_column,
        model_type=payload.model_type,
        task_type=task_type,
        framework=payload.framework,
        artifact_uri=payload.artifact_uri,
        input_shape=payload.input_shape,
        class_labels=payload.class_labels,
    )

    return {
        "model_id": model_id,
        "dataset_id": payload.dataset_id,
        "status": "registered",
        "model_type": payload.model_type,
        "task_type": task_type,
        "framework": payload.framework,
        "artifact_uri": payload.artifact_uri,
        "phase": "phase2_prep",
    }


@router.post("/validate-artifact")
def validate_model_artifact(payload: ValidateModelArtifactRequest) -> dict:
    model = store.models.get(payload.model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if not model.artifact_uri:
        raise HTTPException(status_code=400, detail="Model has no artifact_uri")

    uri = model.artifact_uri.strip()
    is_remote = uri.startswith(("s3://", "gs://", "http://", "https://"))
    is_local = uri.startswith(("file://", "/"))
    if not (is_remote or is_local):
        raise HTTPException(status_code=400, detail="artifact_uri must be a remote URI or local file path")

    expected_ext = {
        "pytorch": (".pt", ".pth", ".ckpt"),
        "onnx": (".onnx",),
    }.get(model.framework, ())
    extension_ok = True if not expected_ext else uri.lower().endswith(expected_ext)

    return {
        "model_id": model.model_id,
        "framework": model.framework,
        "artifact_uri": uri,
        "checks": {
            "uri_scheme_valid": True,
            "extension_expected": list(expected_ext),
            "extension_ok": extension_ok,
        },
        "status": "valid" if extension_ok else "warning",
        "phase": "phase2_prep",
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
            "framework": record.framework,
            "artifact_uri": record.artifact_uri,
        }
        for record in store.models.values()
    ]
    return {"models": models}
