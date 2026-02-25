# Explainiverse Studio

Standalone frontend + API workspace for Explainiverse.

## Monorepo layout

- `apps/web`: React + Vite + TypeScript frontend
- `apps/api`: FastAPI backend
- `packages/sdk`: shared typed TypeScript client

---

## Prerequisites

- Node 20+
- pnpm 9+
- Python 3.10+

---

## Local development (recommended)

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start API (terminal A)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3) Start frontend (terminal B)

```bash
pnpm --filter @explainiverse-studio/web dev
```


### Frontend environment config

```bash
cp apps/web/.env.example apps/web/.env
# edit apps/web/.env if your API is not on localhost:8000
```

### 4) Open app

- Web: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`

---

## Quick product smoke test

1. Click **Upload sample dataset**
2. Click **Train model**
3. Pick explainer + metric
4. Click **Run experiment** (or **Run all explainer × metric combos**)
5. Verify run history, comparison panel, and JSON export

---

## Available scripts

```bash
# Run all workspace dev tasks
pnpm dev

# Typecheck all workspaces
pnpm typecheck

# Build all workspaces
pnpm build

# Run all workspace tests (currently placeholders in web/sdk)
pnpm test
```

---

## Deployment guide

See [`docs/RUN_AND_DEPLOY.md`](docs/RUN_AND_DEPLOY.md) for:

- local production-style run commands
- Docker image examples for API + web
- managed deployment outlines (Render/Fly/Cloud Run)
- CI expectations and environment notes

---

## Current implemented vertical slice

- Dataset upload + profiling (`POST /datasets`)
- Model training against selected target (`POST /models/train`)
- Compatibility lookup (`GET /explainers/compatible`)
- Run execution + history (`POST /runs`, `GET /runs`, `DELETE /runs`)
- Saved asset listing (`GET /datasets`, `GET /models`)
