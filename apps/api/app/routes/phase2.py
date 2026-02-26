from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from app.store import store

router = APIRouter(prefix="/phase2", tags=["phase2"])


class SaliencyPreviewRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    manifest_id: str
    sample_ref: str
    method: str = "saliency"


@router.post("/saliency-preview")
def saliency_preview(payload: SaliencyPreviewRequest) -> dict:
    model = store.models.get(payload.model_id)
    manifest = store.image_manifests.get(payload.manifest_id)

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if not manifest:
        raise HTTPException(status_code=404, detail="Image manifest not found")

    if model.framework != "pytorch":
        raise HTTPException(status_code=400, detail="Saliency preview currently supports framework=pytorch models")

    generated_at = datetime.now(timezone.utc).isoformat()
    artifact_key = f"saliency/{payload.model_id}/{payload.sample_ref.replace('/', '_')}.json"

    # Phase-2 thin-slice contract: placeholder payload shape for downstream UI wiring.
    return {
        "status": "queued_stub",
        "phase": "phase2",
        "model_id": payload.model_id,
        "manifest_id": payload.manifest_id,
        "sample_ref": payload.sample_ref,
        "method": payload.method,
        "generated_at": generated_at,
        "artifact": {
            "artifact_key": artifact_key,
            "overlay_uri": f"memory://{artifact_key}",
            "heatmap_stats": {"min": 0.0, "max": 1.0, "mean": 0.42},
        },
    }
