from io import StringIO

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict

from app.store import DatasetRecord, store

router = APIRouter(prefix="/datasets", tags=["datasets"])


class ImageManifestRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    image_count: int
    class_labels: list[str]
    image_root_uri: str


@router.post("/image-manifest")
def register_image_manifest(payload: ImageManifestRequest) -> dict:
    if payload.image_count <= 0:
        raise HTTPException(status_code=400, detail="image_count must be > 0")
    if not payload.class_labels:
        raise HTTPException(status_code=400, detail="class_labels is required")

    manifest_id = store.next_id("img", store.image_manifests)
    store.image_manifests[manifest_id] = payload.model_dump()

    return {
        "manifest_id": manifest_id,
        "status": "registered",
        "phase": "phase2_prep",
        **payload.model_dump(),
    }


def _serialize_preview(dataframe: pd.DataFrame, max_rows: int = 5) -> list[dict]:
    preview = dataframe.head(max_rows).where(pd.notnull(dataframe), None)
    return preview.to_dict(orient="records")


@router.post("")
async def upload_dataset(file: UploadFile) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    try:
        dataframe = pd.read_csv(StringIO(content.decode("utf-8")))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {exc}") from exc

    if dataframe.empty:
        raise HTTPException(status_code=400, detail="Dataset has no rows")

    dataset_id = store.next_id("ds", store.datasets)
    record = DatasetRecord(
        dataset_id=dataset_id,
        filename=file.filename,
        rows=int(dataframe.shape[0]),
        columns=[str(column) for column in dataframe.columns],
    )
    store.datasets[dataset_id] = record
    store.dataset_frames[dataset_id] = dataframe.copy()

    missing = dataframe.isnull().sum().to_dict()
    dtypes = {column: str(dtype) for column, dtype in dataframe.dtypes.items()}

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "rows": record.rows,
        "columns": record.columns,
        "missing_values": missing,
        "dtypes": dtypes,
        "preview": _serialize_preview(dataframe),
        "status": "uploaded",
    }


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str) -> dict:
    record = store.datasets.get(dataset_id)
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return {
        "dataset_id": record.dataset_id,
        "filename": record.filename,
        "rows": record.rows,
        "columns": record.columns,
        "target_column": record.target_column,
    }


@router.get("")
def list_datasets() -> dict:
    datasets = [
        {
            "dataset_id": record.dataset_id,
            "filename": record.filename,
            "rows": record.rows,
            "columns": record.columns,
            "target_column": record.target_column,
        }
        for record in store.datasets.values()
    ]
    return {"datasets": datasets}
