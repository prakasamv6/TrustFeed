"""Core debiasing formulas.

Implements every metric described in the project specification:
    rawBiasedScore, baselineScore, biasDelta, debiasedAdjustedScore,
    deductedBiasAmount, biasAmplificationIndex, disagreementRate,
    regionDominanceScore, favoritismFlag, dominantBiasedAgent, favoredRegion.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass

from agents.base_agent import AgentScoreResult


@dataclass
class DebiasedResult:
    raw_biased_score: float
    baseline_score: float
    bias_delta: float
    debiased_adjusted_score: float
    deducted_bias_amount: float
    bias_amplification_index: float
    disagreement_rate: float
    region_dominance_score: float
    favoritism_flag: bool
    dominant_biased_agent: str
    favored_region: str | None
    favored_segments: list[str]


def compute_debiased_result(
    regional_scores: list[AgentScoreResult],
    baseline_result: AgentScoreResult,
    raw_biased_score: float,
    *,
    residual_max: float = 0.05,
    region_dominance_threshold: float = 0.60,
    bias_warning_threshold: float = 0.20,
) -> DebiasedResult:
    baseline_score = baseline_result.score

    # ── biasDelta ──
    bias_delta = round(abs(raw_biased_score - baseline_score), 4)

    # ── debiasedAdjustedScore ──
    residual = raw_biased_score - baseline_score
    clamped = max(-residual_max, min(residual_max, residual))
    debiased = round(min(1.0, max(0.0, baseline_score + clamped)), 4)

    # ── deductedBiasAmount ──
    deducted = round(raw_biased_score - debiased, 4)

    # ── biasAmplificationIndex ──
    amp = round(raw_biased_score / baseline_score, 4) if baseline_score > 0 else 0.0

    # ── disagreementRate (std dev across all 6 scores) ──
    all_scores = [s.score for s in regional_scores] + [baseline_score]
    disagree = round(statistics.pstdev(all_scores), 4) if len(all_scores) > 1 else 0.0

    # ── regionDominanceScore ──
    reg_vals = [s.score for s in regional_scores]
    if reg_vals:
        reg_mean = statistics.mean(reg_vals)
        dominance = round(max(reg_vals) - reg_mean, 4)
    else:
        dominance = 0.0

    # ── favoritismFlag ──
    favoritism = dominance > region_dominance_threshold

    # ── dominantBiasedAgent / favoredRegion ──
    if regional_scores:
        dominant = max(regional_scores, key=lambda s: s.score)
        dominant_agent = dominant.agent_name
        favored_region = dominant.region
    else:
        dominant_agent = "none"
        favored_region = None

    # ── favoredSegments: each agent whose score exceeds baseline + warning ──
    favored_segments = [
        s.region or s.agent_name
        for s in regional_scores
        if s.score > baseline_score + bias_warning_threshold
    ]

    return DebiasedResult(
        raw_biased_score=raw_biased_score,
        baseline_score=baseline_score,
        bias_delta=bias_delta,
        debiased_adjusted_score=debiased,
        deducted_bias_amount=deducted,
        bias_amplification_index=amp,
        disagreement_rate=disagree,
        region_dominance_score=dominance,
        favoritism_flag=favoritism,
        dominant_biased_agent=dominant_agent,
        favored_region=favored_region,
        favored_segments=favored_segments,
    )
