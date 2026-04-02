"""Factor-level bias attribution engine.

Computes exactly which ML features and bias profile parameters drove
the divergence between each regional agent's score and the non-bias baseline.
Outputs structured, per-factor explanations suitable for dashboard visualisation.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from agents.base_agent import AgentScoreResult


@dataclass
class FactorContribution:
    """One feature's contribution to the bias delta for a single agent."""

    factor_name: str
    factor_category: str  # "feature_weight" | "text_sensitivity" | "bias_direction"
    raw_value: float  # the original feature value (or sensitivity value)
    weight: float  # the profile weight applied
    contribution: float  # signed delta this factor added to the score
    contribution_pct: float  # % of total |contribution| for this agent
    description: str  # plain-language explanation


@dataclass
class AgentAttribution:
    """Full factor-level attribution for one regional agent."""

    agent_name: str
    region: str | None
    agent_score: float
    baseline_score: float
    total_delta: float
    factors: list[FactorContribution] = field(default_factory=list)
    top_factor: str = ""
    summary: str = ""


@dataclass
class FactorAttributionReport:
    """Complete factor attribution across all regional agents."""

    agent_attributions: list[AgentAttribution] = field(default_factory=list)
    global_top_factors: list[str] = field(default_factory=list)
    proxy_risk_indicators: list[str] = field(default_factory=list)
    fairness_summary: str = ""


# Features that may correlate with protected attributes (proxy risk)
_PROXY_RISK_FEATURES = {
    "formal_language_penalty": "language formality can correlate with education level or cultural background",
    "short_sentence_bonus": "sentence length patterns may associate with linguistic origin",
    "lexical_diversity": "vocabulary diversity may correlate with language fluency or region",
    "repetition_penalty": "repetition norms vary across cultures and communication styles",
}

_FEATURE_DESCRIPTIONS = {
    "laplacian_variance": "image noise/sharpness estimation",
    "edge_density": "edge detail concentration in image",
    "freq_ratio": "high-to-low frequency energy ratio",
    "color_uniformity": "colour histogram uniformity",
    "saturation_mean": "average colour saturation",
    "block_artifact_score": "JPEG compression artifact detection",
    "temporal_consistency": "frame-to-frame visual consistency (video)",
    "motion_smoothness": "motion fluidity across frames (video)",
    "lexical_diversity": "vocabulary richness in text",
    "perplexity_proxy": "language model perplexity estimate",
    "formal_language_penalty": "penalty for formal/polished language",
    "short_sentence_bonus": "bonus/penalty for short sentences",
    "repetition_penalty": "penalty for repetitive phrasing",
}


def compute_factor_attribution(
    regional_scores: list[AgentScoreResult],
    baseline_result: AgentScoreResult,
    ml_features: dict,
    content_type: str = "text",
) -> FactorAttributionReport:
    """Compute per-factor bias attribution for every regional agent.

    For each agent, reconstruct which feature weights and text sensitivities
    contributed most to the divergence from the non-bias baseline.
    """
    from agents.bias_profiles import get_profile

    baseline_score = baseline_result.score
    agent_attributions: list[AgentAttribution] = []
    global_factor_counts: dict[str, float] = {}
    proxy_risks: set[str] = set()

    for agent_result in regional_scores:
        region = agent_result.region
        if not region:
            continue

        try:
            profile = get_profile(region)
        except (KeyError, ValueError):
            continue

        factors: list[FactorContribution] = []
        total_delta = round(agent_result.score - baseline_score, 4)

        # ── Feature-weight contributions ──
        for feat_key, weight in profile.feature_weights.items():
            feat_val = ml_features.get(feat_key, 0)
            if not isinstance(feat_val, (int, float)):
                continue
            norm = min(1.0, feat_val / 1000) if feat_val > 1 else feat_val
            contribution = round((weight - 1.0) * norm * 0.05, 6)

            desc = _FEATURE_DESCRIPTIONS.get(feat_key, feat_key)
            factors.append(FactorContribution(
                factor_name=feat_key,
                factor_category="feature_weight",
                raw_value=round(float(feat_val), 4),
                weight=weight,
                contribution=contribution,
                contribution_pct=0.0,  # filled below
                description=(
                    f"{desc}: weight={weight:.2f} "
                    f"{'amplifies' if weight > 1.0 else 'dampens'} this signal "
                    f"by {abs(contribution):.4f}"
                ),
            ))

        # ── Text sensitivity contributions ──
        if content_type == "text":
            for sens_key, sens_val in profile.text_sensitivities.items():
                contribution = round(sens_val * 0.08, 6)
                desc = _FEATURE_DESCRIPTIONS.get(sens_key, sens_key)
                factors.append(FactorContribution(
                    factor_name=sens_key,
                    factor_category="text_sensitivity",
                    raw_value=round(float(sens_val), 4),
                    weight=sens_val,
                    contribution=contribution,
                    contribution_pct=0.0,
                    description=(
                        f"{desc}: sensitivity={sens_val:+.2f} "
                        f"shifts score by {contribution:+.4f}"
                    ),
                ))

                # Check proxy risk
                if sens_key in _PROXY_RISK_FEATURES:
                    proxy_risks.add(
                        f"{region}: {sens_key} — {_PROXY_RISK_FEATURES[sens_key]}"
                    )

        # ── Bias direction contribution ──
        direction_contribution = round(
            profile.bias_direction * profile.bias_intensity * 0.15, 6
        )
        factors.append(FactorContribution(
            factor_name="bias_direction",
            factor_category="bias_direction",
            raw_value=round(profile.bias_direction, 4),
            weight=round(profile.bias_intensity, 4),
            contribution=direction_contribution,
            contribution_pct=0.0,
            description=(
                f"Regional bias direction ({profile.bias_direction:+.2f}) × "
                f"intensity ({profile.bias_intensity:.0%}) = {direction_contribution:+.4f} shift"
            ),
        ))

        # ── Compute contribution percentages ──
        total_abs = sum(abs(f.contribution) for f in factors)
        if total_abs > 0:
            for f in factors:
                f.contribution_pct = round(abs(f.contribution) / total_abs * 100, 1)

        # Sort by absolute contribution descending
        factors.sort(key=lambda f: abs(f.contribution), reverse=True)

        top_factor = factors[0].factor_name if factors else "none"

        # Accumulate global factor importance
        for f in factors:
            global_factor_counts[f.factor_name] = (
                global_factor_counts.get(f.factor_name, 0) + abs(f.contribution)
            )

        # Build summary
        top_3 = factors[:3]
        top_desc = ", ".join(
            f"{f.factor_name} ({f.contribution:+.4f})" for f in top_3
        )

        attr = AgentAttribution(
            agent_name=agent_result.agent_name,
            region=region,
            agent_score=agent_result.score,
            baseline_score=baseline_score,
            total_delta=total_delta,
            factors=factors,
            top_factor=top_factor,
            summary=(
                f"{agent_result.agent_name} ({region}) diverges from baseline by "
                f"{total_delta:+.4f}. Top contributing factors: {top_desc}."
            ),
        )
        agent_attributions.append(attr)

    # ── Global top factors ──
    global_sorted = sorted(
        global_factor_counts.items(), key=lambda x: x[1], reverse=True
    )
    global_top = [name for name, _ in global_sorted[:5]]

    # ── Fairness summary ──
    delta_values = [a.total_delta for a in agent_attributions]
    if delta_values:
        max_delta = max(delta_values, key=abs)
        avg_delta = sum(delta_values) / len(delta_values)
        spread = max(delta_values) - min(delta_values)
    else:
        max_delta = avg_delta = spread = 0.0

    proxy_list = sorted(proxy_risks)
    summary_parts = [
        f"Factor attribution analysed {len(agent_attributions)} regional agents.",
        f"Average delta from baseline: {avg_delta:+.4f}, max delta: {max_delta:+.4f}, spread: {spread:.4f}.",
    ]
    if proxy_list:
        summary_parts.append(
            f"Proxy risk indicators detected: {len(proxy_list)} factor(s) "
            f"may correlate with protected attributes."
        )
    if global_top:
        summary_parts.append(
            f"Most influential factors across all agents: {', '.join(global_top[:3])}."
        )

    return FactorAttributionReport(
        agent_attributions=agent_attributions,
        global_top_factors=global_top,
        proxy_risk_indicators=proxy_list,
        fairness_summary=" ".join(summary_parts),
    )
