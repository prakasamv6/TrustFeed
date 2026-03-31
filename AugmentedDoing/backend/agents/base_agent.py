"""Base class for all bias simulation agents."""

from __future__ import annotations

import hashlib
import struct
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


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

    @abstractmethod
    def score(self, content: str, content_type: str, *, mock: bool = True) -> AgentScoreResult:
        ...

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
