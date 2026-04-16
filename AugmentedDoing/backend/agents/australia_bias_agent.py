"""Australia regional bias agent.

Role: Simulates a content-provenance evaluator with an Australian regional
perspective. Uses local dataset from AugmentedDoing/dataset/Australia/.
Emphasises edge detail and motion smoothness in video.
"""

from .base_agent import AgentScoreResult, BaseAgent


class AustraliaBiasAgent(BaseAgent):
    name = "AustraliaBiasAgent"
    region = "Australia"
    dataset_folder = "Australia"

    def score(self, content: str, content_type: str, *, mock: bool = True,
              ml_features: dict | None = None) -> AgentScoreResult:
        from .bias_profiles import AUSTRALIA_PROFILE as profile

        base = self._mock_hash(f"{self.name}:{content[:64]}")
        base_score = min(1.0, base * 0.52 + 0.42) if mock else 0.5

        adjusted, confidence, highlights = self._apply_bias_profile(
            base_score, content_type, profile, ml_features
        )

        return AgentScoreResult(
            agent_name=self.name,
            region=self.region,
            score=adjusted,
            confidence=confidence,
            reasoning=(
                f"{profile.cultural_context} "
                f"Base={base_score:.3f}, adjusted={adjusted:.3f}."
            ),
            bias_highlights=highlights,
        )
