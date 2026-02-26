# Explainiverse Studio Phase Status

## Phase 1 sign-off

Status: **Complete** ✅

Implemented and validated:

- Dataset upload and profiling (`POST /datasets`)
- Baseline sklearn training with task inference (`POST /models/train`)
- Explainer/metric compatibility with metadata (`GET /explainers/compatible`)
- Executable run scoring MVP (`POST /runs`)
- Leaderboard aggregation (`GET /runs/leaderboard`)
- Reproducible JSON report export (`GET /runs/report`)
- Web workflow with model-type selection, metadata display, and report export

## Phase 2 in progress

Status: **Started** 🚧

Thin-slice delivered in this repo:

- Saliency preview contract endpoint (Phase 2 stub):
  - `POST /phase2/saliency-preview`
  - returns artifact contract payload (`artifact_key`, `overlay_uri`, `heatmap_stats`) for UI integration
- Batch execution + polling stub endpoints:
  - `POST /phase2/batch-runs`
  - `GET /phase2/batch-runs/{job_id}`
  - `GET /phase2/batch-runs`
  - `POST /phase2/batch-runs/{job_id}/cancel`
  - returns progress states (`running`, `completed`, `cancelled`) and matrix results contract for UI integration
- Model registration endpoint for external artifacts (e.g., PyTorch):
  - `POST /models/upload`
  - captures `framework`, `artifact_uri`, `input_shape`, `class_labels`
- Model artifact validation endpoint (Phase 2 prep):
  - `POST /models/validate-artifact`
  - performs URI/extension checks for uploaded model artifacts
- Image dataset manifest registration endpoint:
  - `POST /datasets/image-manifest`
  - captures dataset metadata needed for image workflows

## Next Phase 2 implementation steps

1. Add artifact fetch adapters (validation endpoint is now available; next is URI accessibility checks).
2. Add image explanation artifact generation endpoint (starting with saliency stub contract).
3. Replace batch execution stub with async/background execution engine and incremental progress updates.
4. Extend web wizard with Phase 2 tab for model upload + image manifest registration.
