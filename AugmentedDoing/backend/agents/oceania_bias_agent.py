"""Oceania regional bias agent.

Role: Simulates a content-provenance evaluator with an Oceanian regional
perspective. The mildest regional bias. Emphasises edge detail and motion
smoothness in video. Relatively balanced on text with slight inflation on
high-noise images.
"""

from .base_agent import AgentScoreResult, BaseAgent


class OceaniaBiasAgent(BaseAgent):
    name = "OceaniaBiasAgent"
    region = "Oceania"

    def score(self, content: str, content_type: str, *, mock: bool = True,
              ml_features: dict | None = None) -> AgentScoreResult:
        from .bias_profiles import OCEANIA_PROFILE as profile

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
