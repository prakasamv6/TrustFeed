"""Text content pipeline — extracts/preprocesses text for agent scoring.

Uses the HuggingFace TextAnalyzer for feature extraction when available.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PreparedText:
    content: str
    features: dict = field(default_factory=dict)


class TextPipeline:
    """Pre-process text content before handing it to agents."""

    @staticmethod
    def prepare(content: str, *, mock: bool = True) -> str:
        """Normalise and truncate text for consistent agent scoring."""
        text = content.strip()
        if len(text) > 2000:
            text = text[:2000]
        return text

    @staticmethod
    def prepare_with_features(content: str, *, mock: bool = True) -> PreparedText:
        """Prepare text and extract ML features via HF Transformers."""
        text = content.strip()[:2000]
        try:
            from analyzers.text_analyzer import TextAnalyzer
            result = TextAnalyzer.analyze(text, mock=mock)
            return PreparedText(
                content=text,
                features={
                    **result.features,
                    "_raw_ml_score": result.raw_score,
                    "_model": result.model_name,
                    "_token_count": result.token_count,
                },
            )
        except Exception:
            return PreparedText(content=text, features={})
