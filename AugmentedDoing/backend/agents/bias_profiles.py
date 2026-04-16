"""Region-specific bias profiles for each agent.

Each profile defines HOW a regional agent applies its bias:
  • feature_weights — which content features the region emphasizes
  • bias_direction — inflation or deflation tendency
  • sensitivity — how strongly the bias affects the final score
  • cultural_context — what the region "looks for" in content

These profiles make each agent perform a genuinely different,
continent-specific biased analysis of the same content.

Continents: Africa, Asia, North America, South America, Antarctica, Europe, Australia
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
        "laplacian_variance": 1.3,
        "edge_density": 1.1,
        "color_uniformity": 0.8,
        "saturation_mean": 1.4,
        "freq_ratio": 0.9,
        "temporal_consistency": 1.0,
        "lexical_diversity": 1.2,
        "perplexity_proxy": 0.85,
    },
    text_sensitivities={
        "formal_language_penalty": 0.20,
        "short_sentence_bonus": -0.10,
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
        "edge_density": 1.3,
        "color_uniformity": 1.2,
        "saturation_mean": 0.85,
        "freq_ratio": 1.4,
        "temporal_consistency": 1.2,
        "lexical_diversity": 0.9,
        "perplexity_proxy": 1.3,
    },
    text_sensitivities={
        "formal_language_penalty": -0.05,
        "short_sentence_bonus": 0.10,
        "repetition_penalty": 0.25,
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
        "color_uniformity": 1.3,
        "saturation_mean": 1.0,
        "freq_ratio": 1.1,
        "temporal_consistency": 1.3,
        "lexical_diversity": 1.3,
        "perplexity_proxy": 1.1,
    },
    text_sensitivities={
        "formal_language_penalty": -0.10,
        "short_sentence_bonus": 0.05,
        "repetition_penalty": 0.20,
    },
    cultural_context=(
        "The Europe agent emphasises lexical diversity and colour uniformity. "
        "Content with very uniform colour palettes or low vocabulary richness "
        "is flagged as AI-generated more aggressively."
    ),
)

NORTH_AMERICA_PROFILE = RegionBiasProfile(
    region="North_America",
    agent_name="NorthAmericaBiasAgent",
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
        "block_artifact_score": 1.4,
    },
    text_sensitivities={
        "formal_language_penalty": 0.15,
        "short_sentence_bonus": -0.15,
        "repetition_penalty": 0.10,
    },
    cultural_context=(
        "The North America agent is biased toward detecting compression artifacts "
        "and over-polished text. Casual conversational writing is given benefit "
        "of the doubt; formal or templated text is penalised."
    ),
)

SOUTH_AMERICA_PROFILE = RegionBiasProfile(
    region="South_America",
    agent_name="SouthAmericaBiasAgent",
    bias_intensity=0.67,
    bias_direction=0.12,
    feature_weights={
        "laplacian_variance": 1.1,
        "edge_density": 1.0,
        "color_uniformity": 0.9,
        "saturation_mean": 1.3,
        "freq_ratio": 1.0,
        "temporal_consistency": 1.1,
        "lexical_diversity": 1.1,
        "perplexity_proxy": 1.0,
    },
    text_sensitivities={
        "formal_language_penalty": 0.10,
        "short_sentence_bonus": -0.08,
        "repetition_penalty": 0.18,
    },
    cultural_context=(
        "The South America agent emphasises narrative vibrancy and emotional "
        "authenticity. Overly clinical or neutral prose is flagged as AI-generated. "
        "Strong color saturation in images is accepted as natural."
    ),
)

ANTARCTICA_PROFILE = RegionBiasProfile(
    region="Antarctica",
    agent_name="AntarcticaBiasAgent",
    bias_intensity=0.55,
    bias_direction=0.05,
    feature_weights={
        "laplacian_variance": 1.2,
        "edge_density": 1.1,
        "color_uniformity": 1.4,
        "saturation_mean": 0.7,
        "freq_ratio": 1.3,
        "temporal_consistency": 1.2,
        "lexical_diversity": 1.0,
        "perplexity_proxy": 1.1,
    },
    text_sensitivities={
        "formal_language_penalty": -0.05,
        "short_sentence_bonus": 0.0,
        "repetition_penalty": 0.12,
    },
    cultural_context=(
        "The Antarctica agent is the mildest bias profile. It focuses on "
        "environmental and scientific data integrity — flagging over-uniform "
        "colour palettes and suspiciously precise data as AI markers."
    ),
)

AUSTRALIA_PROFILE = RegionBiasProfile(
    region="Australia",
    agent_name="AustraliaBiasAgent",
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
        "motion_smoothness": 1.3,
    },
    text_sensitivities={
        "formal_language_penalty": 0.05,
        "short_sentence_bonus": -0.05,
        "repetition_penalty": 0.18,
    },
    cultural_context=(
        "The Australia agent emphasises edge detail and motion smoothness "
        "in video. Relatively balanced on text with slight inflation on "
        "high-noise images. Cross-modal consistency is a key focus."
    ),
)


ALL_REGION_PROFILES: dict[str, RegionBiasProfile] = {
    "Africa": AFRICA_PROFILE,
    "Asia": ASIA_PROFILE,
    "Europe": EUROPE_PROFILE,
    "North_America": NORTH_AMERICA_PROFILE,
    "South_America": SOUTH_AMERICA_PROFILE,
    "Antarctica": ANTARCTICA_PROFILE,
    "Australia": AUSTRALIA_PROFILE,
}


def get_profile(region: str) -> RegionBiasProfile:
    profile = ALL_REGION_PROFILES.get(region)
    if profile is None:
        raise ValueError(f"Unknown region: {region}")
    return profile
