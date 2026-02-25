from fastapi import FastAPI
from app.routes import datasets, models, explainers, runs

app = FastAPI(title="Explainiverse Studio API", version="0.1.0")

app.include_router(datasets.router)
app.include_router(models.router)
app.include_router(explainers.router)
app.include_router(runs.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
