"""Non-bias baseline agent — no regional preference.

Role: The control agent. Applies NO regional bias. Uses the raw ML score
directly (or mock hash in mock mode) without any feature weighting or
cultural adjustments. Every regional agent's output is compared against
this baseline to quantify how much bias each region introduces.
"""

from .base_agent import AgentScoreResult, BaseAgent


class NonBiasBaselineAgent(BaseAgent):
    name = "NonBiasBaselineAgent"
    region = None

    def score(self, content: str, content_type: str, *, mock: bool = True,
              ml_features: dict | None = None) -> AgentScoreResult:
        if mock:
            base = self._mock_hash(f"{self.name}:{content[:64]}")
            unbiased = min(1.0, max(0.0, base * 0.80 + 0.10))
            return AgentScoreResult(
                agent_name=self.name,
                region=None,
                score=round(unbiased, 4),
                confidence=round(0.80 + base * 0.18, 4),
                reasoning=(
                    f"Unbiased baseline analysis of {content_type} content. "
                    f"No regional weighting applied. Raw score={unbiased:.3f}."
                ),
                bias_highlights=["baseline: no regional bias applied"],
            )

        # Live mode: use raw ML score directly without any bias
        ml_score = (ml_features or {}).get("_raw_ml_score", 0.5)
        return AgentScoreResult(
            agent_name=self.name,
            region=None,
            score=round(ml_score, 4),
            confidence=0.85,
            reasoning=(
                f"Unbiased baseline analysis of {content_type} content. "
                f"Raw ML model score used directly: {ml_score:.3f}."
            ),
            bias_highlights=["baseline: raw ML score, no regional bias"],
        )
