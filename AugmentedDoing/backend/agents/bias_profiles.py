"""Region-specific bias profiles for each agent.

Each profile defines HOW a regional agent applies its bias:
  • feature_weights — which content features the region emphasizes
  • bias_direction — inflation or deflation tendency
  • sensitivity — how strongly the bias affects the final score
  • cultural_context — what the region "looks for" in content

These profiles make each agent perform a genuinely different,
country/region-specific biased analysis of the same content.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class RegionBiasProfile:
    """Defines the bias behaviour of a single regional agent."""
    region: str
    agent_name: str

    # How strongly this agent's bias affects scoring (0.0=no bias, 1.0=maximum)
    bias_intensity: float

    # Direction: >0 means the agent inflates AI-likeness, <0 deflates it
    bias_direction: float

    # Feature-level weights — which ML features matter more to this region
    feature_weights: dict[str, float] = field(default_factory=dict)

    # Text-level sensitivities
    text_sensitivities: dict[str, float] = field(default_factory=dict)

    # Description of this region's bias perspective
    cultural_context: str = ""


# ── Predefined region profiles ──────────────────────────────────────────────

AFRICA_PROFILE = RegionBiasProfile(
    region="Africa",
    agent_name="AfricaBiasAgent",
    bias_intensity=0.72,
    bias_direction=0.15,
    feature_weights={
        "laplacian_variance": 1.3,   # more sensitive to noise patterns
        "edge_density": 1.1,
        "color_uniformity": 0.8,
        "saturation_mean": 1.4,      # emphasises colour richness
        "freq_ratio": 0.9,
        "temporal_consistency": 1.0,
        "lexical_diversity": 1.2,
        "perplexity_proxy": 0.85,
    },
    text_sensitivities={
        "formal_language_penalty": 0.20,    # formal English seen as more AI-like
        "short_sentence_bonus": -0.10,      # short sentences seen as human
        "repetition_penalty": 0.15,
    },
    cultural_context=(
        "The Africa agent is biased toward flagging highly polished, formal "
        "content as AI-generated, and toward accepting colloquial or "
        "vivid-imagery content as human. It weighs color saturation and "
        "noise patterns more heavily in images."
    ),
)

ASIA_PROFILE = RegionBiasProfile(
    region="Asia",
    agent_name="AsiaBiasAgent",
    bias_intensity=0.68,
    bias_direction=0.20,
    feature_weights={
        "laplacian_variance": 0.9,
        "edge_density": 1.3,         # emphasises fine detail / edges
        "color_uniformity": 1.2,
        "saturation_mean": 0.85,
        "freq_ratio": 1.4,           # focuses on frequency-domain artifacts
        "temporal_consistency": 1.2,
        "lexical_diversity": 0.9,
        "perplexity_proxy": 1.3,     # high weight on perplexity
    },
    text_sensitivities={
        "formal_language_penalty": -0.05,
        "short_sentence_bonus": 0.10,       # short sentences seen as AI-like
        "repetition_penalty": 0.25,         # repetition strongly flagged
    },
    cultural_context=(
        "The Asia agent is biased toward flagging repetitive structure and "
        "frequency-domain anomalies as AI markers. It is more lenient on "
        "formal language but penalises repetition heavily."
    ),
)

EUROPE_PROFILE = RegionBiasProfile(
    region="Europe",
    agent_name="EuropeBiasAgent",
    bias_intensity=0.65,
    bias_direction=0.10,
    feature_weights={
        "laplacian_variance": 1.1,
        "edge_density": 1.0,
        "color_uniformity": 1.3,     # sensitive to over-uniform colour
        "saturation_mean": 1.0,
        "freq_ratio": 1.1,
        "temporal_consistency": 1.3,  # emphasises temporal coherence in video
        "lexical_diversity": 1.3,    # higher weight on vocabulary richness
        "perplexity_proxy": 1.1,
    },
    text_sensitivities={
        "formal_language_penalty": -0.10,   # formal is considered normal
        "short_sentence_bonus": 0.05,
        "repetition_penalty": 0.20,
    },
    cultural_context=(
        "The Europe agent emphasises lexical diversity and colour uniformity. "
        "Content with very uniform colour palettes or low vocabulary richness "
        "is flagged as AI-generated more aggressively."
    ),
)

AMERICAS_PROFILE = RegionBiasProfile(
    region="Americas",
    agent_name="AmericasBiasAgent",
    bias_intensity=0.70,
    bias_direction=0.18,
    feature_weights={
        "laplacian_variance": 1.0,
        "edge_density": 0.9,
        "color_uniformity": 1.0,
        "saturation_mean": 1.2,
        "freq_ratio": 1.0,
        "temporal_consistency": 0.9,
        "lexical_diversity": 1.0,
        "perplexity_proxy": 1.2,
        "block_artifact_score": 1.4,  # strongly checks for JPEG artifacts
    },
    text_sensitivities={
        "formal_language_penalty": 0.15,
        "short_sentence_bonus": -0.15,      # informal short writing accepted
        "repetition_penalty": 0.10,
    },
    cultural_context=(
        "The Americas agent is biased toward detecting compression artifacts "
        "and over-polished text. Casual conversational writing is given benefit "
        "of the doubt; formal or templated text is penalised."
    ),
)

OCEANIA_PROFILE = RegionBiasProfile(
    region="Oceania",
    agent_name="OceaniaBiasAgent",
    bias_intensity=0.60,
    bias_direction=0.08,
    feature_weights={
        "laplacian_variance": 1.2,
        "edge_density": 1.2,
        "color_uniformity": 0.9,
        "saturation_mean": 1.1,
        "freq_ratio": 1.2,
        "temporal_consistency": 1.1,
        "lexical_diversity": 1.1,
        "perplexity_proxy": 1.0,
        "motion_smoothness": 1.3,    # extra weight on motion (video)
    },
    text_sensitivities={
        "formal_language_penalty": 0.05,
        "short_sentence_bonus": -0.05,
        "repetition_penalty": 0.18,
    },
    cultural_context=(
        "The Oceania agent is the mildest regional bias. It emphasises edge "
        "detail and motion smoothness in video, and is relatively balanced "
        "on text. Slight inflation on high-noise images."
    ),
)


ALL_REGION_PROFILES: dict[str, RegionBiasProfile] = {
    "Africa": AFRICA_PROFILE,
    "Asia": ASIA_PROFILE,
    "Europe": EUROPE_PROFILE,
    "Americas": AMERICAS_PROFILE,
    "Oceania": OCEANIA_PROFILE,
}


def get_profile(region: str) -> RegionBiasProfile:
    profile = ALL_REGION_PROFILES.get(region)
    if profile is None:
        raise ValueError(f"Unknown region: {region}")
    return profile
