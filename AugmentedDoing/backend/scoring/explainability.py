"""Generate human-readable explanation summaries for bias analysis results."""

from __future__ import annotations

from scoring.bias_deduction import DebiasedResult


def generate_explanation(result: DebiasedResult) -> str:
    parts: list[str] = []

    parts.append(
        f"The raw biased score ({result.raw_biased_score:.2f}) was computed from "
        f"5 regional agents. The unbiased baseline scored {result.baseline_score:.2f}."
    )

    if result.bias_delta > 0.10:
        parts.append(
            f"A significant bias delta of {result.bias_delta:.2f} was detected."
        )
    else:
        parts.append(
            f"The bias delta ({result.bias_delta:.2f}) is within acceptable range."
        )

    parts.append(
        f"After debiasing, the adjusted score is {result.debiased_adjusted_score:.2f} "
        f"(removed {result.deducted_bias_amount:.2f} bias)."
    )

    if result.favoritism_flag:
        parts.append(
            f"⚠ Favoritism detected: {result.dominant_biased_agent} favors "
            f"{result.favored_region} (dominance={result.region_dominance_score:.2f})."
        )

    if result.favored_segments:
        parts.append(
            f"Segments exceeding bias warning: {', '.join(result.favored_segments)}."
        )

    return " ".join(parts)
