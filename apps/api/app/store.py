from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class DatasetRecord:
    dataset_id: str
    filename: str
    rows: int
    columns: list[str]
    target_column: str | None = None


@dataclass
class ModelRecord:
    model_id: str
    dataset_id: str
    target_column: str
    model_type: str
    task_type: str
    framework: str = "sklearn"
    artifact_uri: str | None = None
    input_shape: list[int] | None = None
    class_labels: list[str] | None = None


@dataclass
class RunRecord:
    run_id: str
    dataset_id: str
    model_id: str
    explainer: str
    metric: str
    score: float
    created_at: str


class InMemoryStore:
    def __init__(self) -> None:
        self.datasets: dict[str, DatasetRecord] = {}
        self.models: dict[str, ModelRecord] = {}
        self.runs: dict[str, RunRecord] = {}

        # Runtime assets for MVP execution.
        self.dataset_frames: dict[str, Any] = {}
        self.model_objects: dict[str, Any] = {}
        self.model_features: dict[str, list[str]] = {}

        # Phase-2 prep: image dataset manifests.
        self.image_manifests: dict[str, dict[str, Any]] = {}

    def next_id(self, prefix: str, existing: dict[str, Any]) -> str:
        return f"{prefix}_{len(existing) + 1:03d}"


store = InMemoryStore()
