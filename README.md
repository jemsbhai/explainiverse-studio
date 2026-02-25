# explainiverse-studio

Standalone frontend + API workspace for Explainiverse.

## Monorepo layout

- `apps/web`: React + Vite + TypeScript frontend
- `apps/api`: FastAPI backend
- `packages/sdk`: Shared typed TypeScript client

## Quick start

### Prerequisites

- Node 20+
- pnpm 9+
- Python 3.10+

### Install

```bash
pnpm install
```

### Run frontend

```bash
pnpm --filter @explainiverse-studio/web dev
```

### Run API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## First vertical slice

1. Upload dataset (`POST /datasets`)
2. Train baseline model (`POST /models/train`)
3. List compatible explainers (`GET /explainers/compatible`)
4. Submit run (`POST /runs`)
