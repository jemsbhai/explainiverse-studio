from __future__ import annotations

import hashlib
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


def _advance_job(job: dict) -> None:
    if job["status"] in {"completed", "cancelled"}:
        return

    completed = job["progress"]["completed"]
    total = job["progress"]["total"]
    step = max(1, total // 3)
    job["progress"]["completed"] = min(total, completed + step)

    now = datetime.now(timezone.utc).isoformat()
    job["updated_at"] = now
    if job["progress"]["completed"] >= total:
        job["status"] = "completed"


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
            jobs.append({"explainer": explainer, "metric": metric, "score": score, "status": "queued"})

    store.phase2_jobs[job_id] = {
        "job_id": job_id,
        "model_id": payload.model_id,
        "manifest_id": payload.manifest_id,
        "status": "running",
        "progress": {"completed": 0, "total": total},
        "created_at": now,
        "updated_at": now,
        "results": jobs,
    }

    return {
        "job_id": job_id,
        "status": "running",
        "phase": "phase2",
        "poll_url": f"/phase2/batch-runs/{job_id}",
        "progress": {"completed": 0, "total": total},
    }


@router.get("/batch-runs/{job_id}")
def get_batch_run(job_id: str) -> dict:
    job = store.phase2_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    _advance_job(job)
    if job["status"] == "completed":
        for item in job["results"]:
            item["status"] = "completed"
    return job


@router.get("/batch-runs")
def list_batch_runs() -> dict:
    for job in store.phase2_jobs.values():
        _advance_job(job)
        if job["status"] == "completed":
            for item in job["results"]:
                item["status"] = "completed"
    jobs = sorted(store.phase2_jobs.values(), key=lambda item: item["created_at"], reverse=True)
    return {"jobs": jobs}


@router.post("/batch-runs/{job_id}/cancel")
def cancel_batch_run(job_id: str) -> dict:
    job = store.phase2_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    if job["status"] == "completed":
        return {"job_id": job_id, "status": "already_completed"}
    if job["status"] == "cancelled":
        return {"job_id": job_id, "status": "already_cancelled"}

    job["status"] = "cancelled"
    for item in job["results"]:
        if item["status"] != "completed":
            item["status"] = "cancelled"
    job["updated_at"] = datetime.now(timezone.utc).isoformat()
    return {"job_id": job_id, "status": "cancelled"}


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

    seed = int(hashlib.sha256(f"{payload.model_id}:{payload.sample_ref}".encode()).hexdigest()[:8], 16)
    heatmap = [round(((seed >> (idx % 16)) % 97) / 96, 3) for idx in range(16)]
    heatmap_grid = [heatmap[i : i + 4] for i in range(0, 16, 4)]
    artifact_payload = {
        "artifact_key": artifact_key,
        "overlay_uri": f"memory://{artifact_key}",
        "sample_ref": payload.sample_ref,
        "method": payload.method,
        "grid_shape": [4, 4],
        "heatmap_grid": heatmap_grid,
        "generated_at": generated_at,
    }
    store.phase2_artifacts[artifact_key] = artifact_payload

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


@router.get("/artifacts/{artifact_key:path}")
def get_phase2_artifact(artifact_key: str) -> dict:
    artifact = store.phase2_artifacts.get(artifact_key)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return artifact
