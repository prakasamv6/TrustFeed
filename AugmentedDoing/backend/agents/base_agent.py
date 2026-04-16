"""Base class for all bias simulation agents."""

from __future__ import annotations

import hashlib
import json
import os
import struct
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path


# Resolve path to the dataset directory (relative to this file)
DATASET_ROOT = Path(__file__).resolve().parent.parent.parent / "dataset"


@dataclass
class DatasetItem:
    """A single item loaded from the local dataset."""
    title: str
    content: str
    content_type: str          # "text", "image", "video"
    ground_truth: str          # "ai" or "human"
    file_path: str             # absolute path on disk
    continent: str
    category: str = ""
    difficulty: str = "medium"


@dataclass
class AgentScoreResult:
    agent_name: str
    region: str | None
    score: float
    confidence: float
    reasoning: str
    bias_highlights: list[str] = field(default_factory=list)


class BaseAgent(ABC):
    """Abstract base for regional bias agents and the baseline agent."""

    name: str = "BaseAgent"
    region: str | None = None
    # Folder name inside dataset/ — override per agent
    dataset_folder: str = ""

    @abstractmethod
    def score(self, content: str, content_type: str, *, mock: bool = True) -> AgentScoreResult:
        ...

    # ── Dataset helpers ──────────────────────────────────────────────────

    def get_dataset_path(self) -> Path:
        """Return the path to this agent's continent dataset folder."""
        return DATASET_ROOT / self.dataset_folder

    def load_dataset_items(self) -> list[DatasetItem]:
        """Load all dataset items for this agent's continent."""
        base = self.get_dataset_path()
        items: list[DatasetItem] = []

        if not base.exists():
            return items

        for media_type in ("Text", "Images", "Videos"):
            for label_dir in ("AI", "NonAI"):
                folder = base / media_type / label_dir
                if not folder.exists():
                    continue
                ground_truth = "ai" if label_dir == "AI" else "human"
                ct = {"Text": "text", "Images": "image", "Videos": "video"}[media_type]

                for fp in sorted(folder.iterdir()):
                    if fp.is_file():
                        item = self._parse_dataset_file(fp, ct, ground_truth)
                        if item:
                            items.append(item)
        return items

    def _parse_dataset_file(
        self, fp: Path, content_type: str, ground_truth: str
    ) -> DatasetItem | None:
        """Parse a single dataset file into a DatasetItem."""
        try:
            if content_type == "text" and fp.suffix.lower() == ".json":
                with open(fp, encoding="utf-8") as f:
                    data = json.load(f)
                title = data.get("title", fp.stem.replace("_", " "))
                content = data.get("extract", data.get("content", ""))
                category = data.get("category", data.get("description", "General"))
                difficulty = data.get("difficulty", "medium")
            elif content_type in ("image", "video"):
                title = fp.stem.replace("_", " ")
                content = f"[{content_type.upper()} file] {title}"
                category = content_type.capitalize()
                difficulty = "medium"
            else:
                return None

            return DatasetItem(
                title=title,
                content=content,
                content_type=content_type,
                ground_truth=ground_truth,
                file_path=str(fp),
                continent=self.dataset_folder,
                category=category,
                difficulty=difficulty,
            )
        except Exception:
            return None

    # Deterministic pseudo-random helper for mock mode
    @staticmethod
    def _mock_hash(seed: str) -> float:
        digest = hashlib.sha256(seed.encode()).digest()
        value = struct.unpack(">I", digest[:4])[0]
        return (value % 10000) / 10000.0

    @staticmethod
    def _apply_bias_profile(
        base_score: float,
        content_type: str,
        profile,  # RegionBiasProfile
        ml_features: dict | None = None,
    ) -> tuple[float, float, list[str]]:
        """Apply a region bias profile to a base score.

        Returns (adjusted_score, confidence, bias_highlights).
        """
        ml_features = ml_features or {}
        adjustment = 0.0
        highlights: list[str] = []

        # Feature-level weighting
        for feat_key, weight in profile.feature_weights.items():
            feat_val = ml_features.get(feat_key)
            if feat_val is not None and isinstance(feat_val, (int, float)):
                norm = min(1.0, feat_val / 1000) if feat_val > 1 else feat_val
                delta = (weight - 1.0) * norm * 0.05
                adjustment += delta
                if abs(delta) > 0.01:
                    highlights.append(
                        f"{feat_key}: weight={weight:.1f}, Δ={delta:+.3f}"
                    )

        # Text sensitivities
        if content_type == "text":
            for sens_key, sens_val in profile.text_sensitivities.items():
                adjustment += sens_val * 0.08
                if abs(sens_val) > 0.05:
                    highlights.append(f"{sens_key}: {sens_val:+.2f}")

        # Bias direction × intensity
        direction_shift = profile.bias_direction * profile.bias_intensity * 0.15
        adjustment += direction_shift
        highlights.append(
            f"region_bias: direction={profile.bias_direction:+.2f}, "
            f"intensity={profile.bias_intensity:.0%}, shift={direction_shift:+.3f}"
        )

        adjusted = round(min(1.0, max(0.0, base_score + adjustment)), 4)
        confidence = round(min(0.99, 0.65 + profile.bias_intensity * 0.30), 4)
        return adjusted, confidence, highlights
