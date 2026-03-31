"""Bias detector — analyses per-agent scores to identify bias modes and
highlight which items each regional agent is biased toward.

This module is the "bias highlighter" that inspects every agent's output,
compares it to the non-bias baseline, and produces a structured report of:
  • which agents show the most bias (and in what direction)
  • which content items are most affected
  • what *mode* of bias each agent exhibits (inflation / deflation / selective)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from agents.base_agent import AgentScoreResult


class BiasMode(str, Enum):
    """Classification of how an agent is biased."""
    INFLATION = "inflation"        # consistently scores higher than baseline
    DEFLATION = "deflation"        # consistently scores lower than baseline
    SELECTIVE = "selective"         # only biased on certain content types / features
    NEUTRAL = "neutral"            # within acceptable range of baseline


@dataclass
class BiasHighlight:
    """A single highlighted bias finding for one agent on one item."""
    agent_name: str
    region: str | None
    bias_mode: BiasMode
    delta_from_baseline: float      # agent_score − baseline_score
    severity: str                   # "low", "medium", "high", "critical"
    explanation: str


@dataclass
class AgentBiasProfile:
    """Overall bias profile for one agent across the analysis."""
    agent_name: str
    region: str | None
    bias_mode: BiasMode
    mean_delta: float
    max_delta: float
    bias_strength_pct: float        # 0-100% how biased this agent is
    highlights: list[BiasHighlight] = field(default_factory=list)


@dataclass
class BiasDetectionReport:
    """Full bias detection report for a single content analysis."""
    agent_profiles: list[AgentBiasProfile]
    most_biased_agent: str
    least_biased_agent: str
    flagged_items: list[BiasHighlight]
    overall_bias_level: str          # "low", "medium", "high", "critical"
    summary: str


# ── Thresholds ──
_DELTA_LOW = 0.10
_DELTA_MEDIUM = 0.20
_DELTA_HIGH = 0.35
_DELTA_CRITICAL = 0.50


def _severity(delta: float) -> str:
    d = abs(delta)
    if d >= _DELTA_CRITICAL:
        return "critical"
    if d >= _DELTA_HIGH:
        return "high"
    if d >= _DELTA_MEDIUM:
        return "medium"
    if d >= _DELTA_LOW:
        return "low"
    return "negligible"


def _classify_bias_mode(delta: float, content_type_delta: float | None = None) -> BiasMode:
    """Determine the mode of bias from the agent's mean delta."""
    if abs(delta) < _DELTA_LOW:
        return BiasMode.NEUTRAL
    if content_type_delta is not None and abs(delta - content_type_delta) > _DELTA_MEDIUM:
        return BiasMode.SELECTIVE
    if delta > 0:
        return BiasMode.INFLATION
    return BiasMode.DEFLATION


def detect_bias(
    regional_scores: list[AgentScoreResult],
    baseline_result: AgentScoreResult,
    content_type: str = "text",
) -> BiasDetectionReport:
    """Run bias detection on a set of agent scores for one content item.

    Compares every regional agent against the non-bias baseline, classifies
    the bias mode, and highlights items with bias above threshold.
    """
    baseline_score = baseline_result.score
    profiles: list[AgentBiasProfile] = []
    all_highlights: list[BiasHighlight] = []

    for agent in regional_scores:
        delta = round(agent.score - baseline_score, 4)
        sev = _severity(delta)
        mode = _classify_bias_mode(delta)

        explanation_parts = []
        if mode == BiasMode.INFLATION:
            explanation_parts.append(
                f"{agent.agent_name} ({agent.region}) inflates the score by "
                f"{abs(delta):.2f} above the non-bias baseline ({baseline_score:.2f})."
            )
        elif mode == BiasMode.DEFLATION:
            explanation_parts.append(
                f"{agent.agent_name} ({agent.region}) deflates the score by "
                f"{abs(delta):.2f} below the non-bias baseline ({baseline_score:.2f})."
            )
        elif mode == BiasMode.SELECTIVE:
            explanation_parts.append(
                f"{agent.agent_name} ({agent.region}) shows selective bias on "
                f"{content_type} content (Δ={delta:+.2f})."
            )
        else:
            explanation_parts.append(
                f"{agent.agent_name} ({agent.region}) is within neutral range "
                f"(Δ={delta:+.2f})."
            )

        highlight = BiasHighlight(
            agent_name=agent.agent_name,
            region=agent.region,
            bias_mode=mode,
            delta_from_baseline=delta,
            severity=sev,
            explanation=" ".join(explanation_parts),
        )

        profile = AgentBiasProfile(
            agent_name=agent.agent_name,
            region=agent.region,
            bias_mode=mode,
            mean_delta=delta,
            max_delta=abs(delta),
            bias_strength_pct=round(min(100.0, abs(delta) / _DELTA_CRITICAL * 100), 1),
            highlights=[highlight],
        )

        profiles.append(profile)
        if sev not in ("negligible",):
            all_highlights.append(highlight)

    # Identify most / least biased agents
    sorted_by_delta = sorted(profiles, key=lambda p: abs(p.mean_delta), reverse=True)
    most_biased = sorted_by_delta[0].agent_name if sorted_by_delta else "none"
    least_biased = sorted_by_delta[-1].agent_name if sorted_by_delta else "none"

    # Overall bias level
    max_abs_delta = max(abs(p.mean_delta) for p in profiles) if profiles else 0
    overall_level = _severity(max_abs_delta)

    # Summary
    flagged_names = [h.agent_name for h in all_highlights if h.severity in ("high", "critical")]
    if flagged_names:
        summary = (
            f"Bias detection found {len(all_highlights)} flagged item(s). "
            f"Most biased: {most_biased} (Δ={sorted_by_delta[0].mean_delta:+.2f}). "
            f"Critical/high-bias agents: {', '.join(flagged_names)}. "
            f"Least biased regional agent: {least_biased}."
        )
    else:
        summary = (
            f"All {len(profiles)} regional agents are within acceptable bias range. "
            f"Highest delta: {most_biased} (Δ={sorted_by_delta[0].mean_delta:+.2f})."
        )

    return BiasDetectionReport(
        agent_profiles=profiles,
        most_biased_agent=most_biased,
        least_biased_agent=least_biased,
        flagged_items=all_highlights,
        overall_bias_level=overall_level,
        summary=summary,
    )
