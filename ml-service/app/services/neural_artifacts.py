from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np


PROJECT_MODEL_FILE = "discovery_reranker_project_finetuned.pt"
CROSS_DOMAIN_MODEL_FILE = "cross_domain_boosted_reranker.pt"
PROJECT_SCALER_FILE = "feature_scaler.npz"
CROSS_DOMAIN_SCALER_FILE = "cross_domain_feature_scaler.npz"


@dataclass
class NeuralArtifact:
    name: str
    model_path: Path
    scaler_path: Path
    model: Any | None = None
    scaler_mean: np.ndarray | None = None
    scaler_scale: np.ndarray | None = None
    error: str | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def loaded(self) -> bool:
        return self.model is not None and self.error is None

    def status(self) -> dict[str, Any]:
        return {
            "loaded": self.loaded,
            "model_path": str(self.model_path),
            "scaler_path": str(self.scaler_path),
            "error": self.error,
            "warnings": self.warnings,
        }

    def predict(self, features: np.ndarray) -> np.ndarray | None:
        if not self.loaded or self.model is None:
            return None
        prepared = self._scale(features)
        try:
            return _predict_with_model(self.model, prepared)
        except Exception as exc:
            self.warnings.append(f"inference_failed:{type(exc).__name__}")
            return None

    def _scale(self, features: np.ndarray) -> np.ndarray:
        if self.scaler_mean is None or self.scaler_scale is None:
            return features
        if self.scaler_mean.shape[-1] != features.shape[-1]:
            self.warnings.append("scaler_mean_shape_mismatch")
            return features
        if self.scaler_scale.shape[-1] != features.shape[-1]:
            self.warnings.append("scaler_scale_shape_mismatch")
            return features
        scale = np.where(self.scaler_scale == 0, 1.0, self.scaler_scale)
        return (features - self.scaler_mean) / scale


@dataclass
class NeuralArtifactBundle:
    artifacts_dir: Path
    project: NeuralArtifact
    cross_domain: NeuralArtifact
    torch_available: bool

    @property
    def project_model_loaded(self) -> bool:
        return self.project.loaded

    @property
    def cross_domain_model_loaded(self) -> bool:
        return self.cross_domain.loaded

    def status(self) -> dict[str, Any]:
        return {
            "artifacts_dir": str(self.artifacts_dir),
            "torch_available": self.torch_available,
            "project": self.project.status(),
            "cross_domain": self.cross_domain.status(),
        }


def load_neural_artifacts(artifacts_dir: Path) -> NeuralArtifactBundle:
    artifacts_dir = Path(artifacts_dir)
    torch_module = _load_torch()
    torch_available = torch_module is not None
    project = _load_artifact(
        name="project_finetuned",
        model_path=artifacts_dir / "project" / PROJECT_MODEL_FILE,
        scaler_path=artifacts_dir / "project" / PROJECT_SCALER_FILE,
        torch_module=torch_module,
    )
    cross_domain = _load_artifact(
        name="cross_domain_boost",
        model_path=artifacts_dir / "cross_domain" / CROSS_DOMAIN_MODEL_FILE,
        scaler_path=artifacts_dir / "cross_domain" / CROSS_DOMAIN_SCALER_FILE,
        torch_module=torch_module,
    )
    return NeuralArtifactBundle(
        artifacts_dir=artifacts_dir,
        project=project,
        cross_domain=cross_domain,
        torch_available=torch_available,
    )


def _load_torch() -> Any | None:
    try:
        import torch  # type: ignore
    except Exception:
        return None
    return torch


def _load_artifact(
    name: str,
    model_path: Path,
    scaler_path: Path,
    torch_module: Any | None,
) -> NeuralArtifact:
    artifact = NeuralArtifact(name=name, model_path=model_path, scaler_path=scaler_path)
    _load_scaler(artifact)
    if not model_path.exists():
        artifact.error = "model_missing"
        return artifact
    if torch_module is None:
        artifact.error = "torch_unavailable"
        return artifact

    try:
        artifact.model = torch_module.jit.load(str(model_path), map_location="cpu")
        if hasattr(artifact.model, "eval"):
            artifact.model.eval()
        return artifact
    except Exception:
        pass

    try:
        loaded = torch_module.load(str(model_path), map_location="cpu")
    except Exception as exc:
        artifact.error = f"load_failed:{type(exc).__name__}"
        return artifact

    model = loaded.get("model") if isinstance(loaded, dict) else loaded
    if not callable(model):
        artifact.error = "model_not_callable"
        return artifact
    artifact.model = model
    if hasattr(artifact.model, "eval"):
        artifact.model.eval()
    return artifact


def _load_scaler(artifact: NeuralArtifact) -> None:
    if not artifact.scaler_path.exists():
        artifact.warnings.append("scaler_missing")
        return
    try:
        data = np.load(artifact.scaler_path)
        artifact.scaler_mean = np.asarray(data["mean"], dtype=float) if "mean" in data else None
        artifact.scaler_scale = np.asarray(data["scale"], dtype=float) if "scale" in data else None
    except Exception as exc:
        artifact.warnings.append(f"scaler_load_failed:{type(exc).__name__}")


def _predict_with_model(model: Any, features: np.ndarray) -> np.ndarray:
    try:
        import torch  # type: ignore
    except Exception:
        return _predict_without_torch(model, features)

    with torch.no_grad():
        tensor = torch.as_tensor(features, dtype=torch.float32)
        output = model(tensor)
    if hasattr(output, "detach"):
        output = output.detach().cpu().numpy()
    scores = np.asarray(output, dtype=float).reshape(-1)
    return np.clip(scores, 0.0, 1.0)


def _predict_without_torch(model: Any, features: np.ndarray) -> np.ndarray:
    if hasattr(model, "predict"):
        scores = model.predict(features)
    else:
        scores = model(features)
    return np.clip(np.asarray(scores, dtype=float).reshape(-1), 0.0, 1.0)
