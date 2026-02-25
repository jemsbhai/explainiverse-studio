from io import StringIO

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile

from app.store import DatasetRecord, store

router = APIRouter(prefix="/datasets", tags=["datasets"])


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
