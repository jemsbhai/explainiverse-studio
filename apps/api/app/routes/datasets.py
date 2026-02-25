from fastapi import APIRouter, UploadFile

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("")
async def upload_dataset(file: UploadFile) -> dict:
    return {
        "dataset_id": "ds_mock_001",
        "filename": file.filename,
        "status": "uploaded",
        "note": "Scaffold response; wire parsing/profiling next"
    }
