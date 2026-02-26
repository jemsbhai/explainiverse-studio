from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import datasets, explainers, models, phase2, runs

app = FastAPI(title="Explainiverse Studio API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(models.router)
app.include_router(explainers.router)
app.include_router(runs.router)
app.include_router(phase2.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
