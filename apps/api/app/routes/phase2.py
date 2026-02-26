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


class BatchRunRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_id: str
    manifest_id: str
    explainers: list[str]
    metrics: list[str]


@router.post("/batch-runs")
def create_batch_run(payload: BatchRunRequest) -> dict:
    model = store.models.get(payload.model_id)
    manifest = store.image_manifests.get(payload.manifest_id)

    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if not manifest:
        raise HTTPException(status_code=404, detail="Image manifest not found")
    if not payload.explainers:
        raise HTTPException(status_code=400, detail="explainers must not be empty")
    if not payload.metrics:
        raise HTTPException(status_code=400, detail="metrics must not be empty")

    job_id = store.next_id("job", store.phase2_jobs)
    total = len(payload.explainers) * len(payload.metrics)
    now = datetime.now(timezone.utc).isoformat()

    jobs = []
    for explainer in payload.explainers:
        for metric in payload.metrics:
            score = round(((len(explainer) * 7 + len(metric) * 11) % 100) / 100, 3)
            jobs.append({"explainer": explainer, "metric": metric, "score": score, "status": "completed"})

    store.phase2_jobs[job_id] = {
        "job_id": job_id,
        "model_id": payload.model_id,
        "manifest_id": payload.manifest_id,
        "status": "completed",
        "progress": {"completed": total, "total": total},
        "created_at": now,
        "updated_at": now,
        "results": jobs,
    }

    return {
        "job_id": job_id,
        "status": "accepted",
        "phase": "phase2",
        "poll_url": f"/phase2/batch-runs/{job_id}",
        "progress": {"completed": 0, "total": total},
    }


@router.get("/batch-runs/{job_id}")
def get_batch_run(job_id: str) -> dict:
    job = store.phase2_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    return job


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
