"""Aggregate individual agent scores into a raw biased score."""

from __future__ import annotations

from agents.base_agent import AgentScoreResult


def aggregate_scores(
    regional_scores: list[AgentScoreResult],
    bias_strength: float = 0.85,
) -> float:
    """Compute the weighted-average raw biased score from the 5 regional agents.

    Each regional agent contributes equally (1/N), then the result is scaled
    by ``bias_strength`` to simulate how strongly regional bias affects the
    composite score.  The remainder (1 - bias_strength) is a uniform prior of 0.5.

    Returns a value in [0, 1].
    """
    if not regional_scores:
        return 0.5
    avg = sum(s.score for s in regional_scores) / len(regional_scores)
    raw = bias_strength * avg + (1 - bias_strength) * 0.5
    return round(min(1.0, max(0.0, raw)), 4)
