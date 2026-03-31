"""Text analyzer using Hugging Face Transformers + PyTorch.

Uses a pre-trained text classification model to detect AI-generated content.
Each regional agent calls this with its own bias_profile to get a
region-adjusted score.
"""

from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass

_pipeline = None  # lazy-loaded HF pipeline


@dataclass
class TextAnalysisResult:
    raw_score: float          # model confidence that content is AI-generated
    features: dict            # extracted features for downstream bias application
    model_name: str
    token_count: int


def _load_pipeline():
    """Lazy-load the HF text-classification pipeline (AI detection)."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    try:
        from transformers import pipeline as hf_pipeline
        _pipeline = hf_pipeline(
            "text-classification",
            model="roberta-base-openai-detector",
            device=-1,  # CPU; set 0 for GPU
        )
        return _pipeline
    except Exception:
        return None


def _deterministic_mock(content: str, salt: str = "") -> float:
    digest = hashlib.sha256(f"{salt}:{content[:128]}".encode()).digest()
    val = struct.unpack(">I", digest[:4])[0]
    return (val % 10000) / 10000.0


class TextAnalyzer:
    """Analyze text content for AI-generation likelihood using HF Transformers."""

    @staticmethod
    def analyze(content: str, *, mock: bool = True) -> TextAnalysisResult:
        text = content.strip()[:2000]
        token_count = len(text.split())

        if mock:
            base = _deterministic_mock(text, "text-analyzer")
            return TextAnalysisResult(
                raw_score=round(base * 0.7 + 0.15, 4),
                features={
                    "avg_word_length": round(3.5 + base * 3.0, 2),
                    "sentence_count": max(1, int(token_count / 15)),
                    "lexical_diversity": round(0.4 + base * 0.4, 3),
                    "perplexity_proxy": round(20 + base * 80, 1),
                    "repetition_ratio": round(base * 0.3, 3),
                },
                model_name="mock-text-detector",
                token_count=token_count,
            )

        # ── Live mode: run HF model ──
        pipe = _load_pipeline()
        if pipe is None:
            # Fallback to mock if model unavailable
            return TextAnalyzer.analyze(content, mock=True)

        result = pipe(text[:512], truncation=True)
        label = result[0]["label"]  # "LABEL_0" (human) or "LABEL_1" (AI)
        score = result[0]["score"]
        ai_score = score if label == "LABEL_1" else 1.0 - score

        return TextAnalysisResult(
            raw_score=round(ai_score, 4),
            features={
                "avg_word_length": round(sum(len(w) for w in text.split()) / max(1, token_count), 2),
                "sentence_count": text.count(".") + text.count("!") + text.count("?"),
                "lexical_diversity": round(len(set(text.lower().split())) / max(1, token_count), 3),
                "perplexity_proxy": round(ai_score * 100, 1),
                "repetition_ratio": 0.0,
            },
            model_name="roberta-base-openai-detector",
            token_count=token_count,
        )
