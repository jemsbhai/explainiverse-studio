# Run & Deploy Explainiverse Studio

This guide is intentionally practical: copy/paste commands and get running quickly.

## 1) Local run (dev mode)

### API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Web

```bash
pnpm install
cp apps/web/.env.example apps/web/.env
# optional: set VITE_API_BASE_URL in apps/web/.env
pnpm --filter @explainiverse-studio/web dev --host 0.0.0.0 --port 5173
```

### Verify

- Web app: `http://localhost:5173`
- API docs: `http://localhost:8000/docs`
- Health endpoint: `http://localhost:8000/health`

---

## 2) Local run (prod-style commands)

### API

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Web (build + preview)

```bash
pnpm install
pnpm --filter @explainiverse-studio/web build
pnpm --filter @explainiverse-studio/web exec vite preview --host 0.0.0.0 --port 4173
```

---

## 3) Docker deployment baseline

> The following Dockerfiles are examples you can place in your infra repo or copy directly into this repo.

### API Dockerfile

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY apps/api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/api/app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Web Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/web ./apps/web
COPY packages/sdk ./packages/sdk
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @explainiverse-studio/web build

FROM nginx:alpine
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 4) Managed deployment outline

### API (Render / Fly / Cloud Run)

- Build from `apps/api`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Python version: 3.11
- Health check: `/health`

### Web (Vercel / Netlify / static host)

- Build command: `pnpm --filter @explainiverse-studio/web build`
- Output dir: `apps/web/dist`
- Set `VITE_API_BASE_URL` to your API URL

---

## 5) CI expectations

Current CI validates:

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm build`
- Python import check for API entrypoint

If deployment fails, first reproduce with the same commands locally.

---

## 6) Operational notes

Current backend storage is in-memory for speed of iteration. Data resets on restart.

Before production use, plan migration to:

- durable DB for runs/datasets/models
- object storage for artifacts
- async job queue for long-running evaluations
