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

- Model registration endpoint for external artifacts (e.g., PyTorch):
  - `POST /models/upload`
  - captures `framework`, `artifact_uri`, `input_shape`, `class_labels`
- Image dataset manifest registration endpoint:
  - `POST /datasets/image-manifest`
  - captures dataset metadata needed for image workflows

## Next Phase 2 implementation steps

1. Add artifact fetch/validation adapters for uploaded model URIs.
2. Add image explanation artifact generation endpoint (starting with saliency stub contract).
3. Add batch execution endpoint for explainer × metric grids with progress state.
4. Extend web wizard with Phase 2 tab for model upload + image manifest registration.
