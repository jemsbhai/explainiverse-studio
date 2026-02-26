from __future__ import annotations

from typing import TypedDict


class ExplainerCatalogItem(TypedDict):
    key: str
    label: str
    description: str
    supported_model_types: list[str]


class MetricCatalogItem(TypedDict):
    key: str
    label: str
    description: str


EXPLAINERS: list[ExplainerCatalogItem] = [
    {
        "key": "lime",
        "label": "LIME",
        "description": "Local surrogate explanations for single predictions.",
        "supported_model_types": ["random_forest", "logistic_regression", "linear_regression", "any"],
    },
    {
        "key": "shap",
        "label": "KernelSHAP",
        "description": "Model-agnostic Shapley approximation for feature effects.",
        "supported_model_types": ["random_forest", "logistic_regression", "linear_regression", "any"],
    },
    {
        "key": "treeshap",
        "label": "TreeSHAP",
        "description": "Fast SHAP variant specialized for tree-based models.",
        "supported_model_types": ["random_forest"],
    },
]

METRICS: list[MetricCatalogItem] = [
    {
        "key": "comprehensiveness",
        "label": "Comprehensiveness",
        "description": "Prediction drop after removing top-ranked features.",
    },
    {
        "key": "sufficiency",
        "label": "Sufficiency",
        "description": "Prediction retained when keeping top-ranked features only.",
    },
    {
        "key": "faithfulness_correlation",
        "label": "Faithfulness Correlation",
        "description": "Correlation between attribution ranks and perturbation impacts.",
    },
]


def compatible_explainers_for_model(model_type: str) -> list[ExplainerCatalogItem]:
    return [
        item
        for item in EXPLAINERS
        if "any" in item["supported_model_types"] or model_type in item["supported_model_types"]
    ]
