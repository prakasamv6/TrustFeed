"""AI Content Detector — multi-signal analysis engine for identifying AI-generated content.

Combines statistical text analysis, pattern recognition, and community signals to
produce a trust score and recommended AI label for social media posts.
"""

from __future__ import annotations

import hashlib
import math
import re
import statistics
from dataclasses import dataclass, field
from typing import Any


# ── Linguistic patterns commonly found in AI-generated text ──────────────────

_AI_PHRASES = [
    r"\bin this article\b",
    r"\blet'?s dive in\b",
    r"\bit'?s worth noting\b",
    r"\bin today'?s world\b",
    r"\bever[- ]?evolving\b",
    r"\bgroundbreaking\b",
    r"\bcutting[- ]?edge\b",
    r"\bunlock the (?:full )?potential\b",
    r"\bgame[- ]?changer\b",
    r"\bseamless(?:ly)?\b",
    r"\bleverage\b",
    r"\brobust\b",
    r"\bsynerg(?:y|ies|istic)\b",
    r"\bholistic\b",
    r"\bparadigm\b",
    r"\bfacilitate\b",
    r"\boptimize\b",
    r"\btransformative\b",
    r"\binnovative\b",
    r"\bworld[- ]class\b",
    r"\bstate[- ]of[- ]the[- ]art\b",
    r"\bneedless to say\b",
    r"\bmoreover\b",
    r"\bfurthermore\b",
    r"\badditionally\b",
    r"\bin conclusion\b",
    r"\bthat being said\b",
    r"\bhaving said that\b",
    r"\bit goes without saying\b",
    r"\bdelve\b",
    r"\bfoster(?:ing)?\b",
    r"\bensure\b",
    r"\butilize\b",
    r"\bfundamentally\b",
]

_AI_PATTERNS_COMPILED = [re.compile(p, re.IGNORECASE) for p in _AI_PHRASES]

# Structural patterns
_LISTICLE_PATTERN = re.compile(r"^\s*\d+[\.\)]\s", re.MULTILINE)
_BULLET_PATTERN = re.compile(r"^\s*[-•*]\s", re.MULTILINE)
_HEADER_PATTERN = re.compile(r"^#{1,6}\s", re.MULTILINE)


@dataclass
class AiDetectionResult:
    """Result of AI content detection analysis."""

    post_id: str
    overall_ai_probability: float            # 0-1 probability content is AI-generated
    trust_score: float                       # 0-100 trust score (100 = very trustworthy/human)
    recommended_label: str                   # "ai-generated" | "likely-ai" | "uncertain" | "likely-human" | "human"
    confidence: float                        # 0-1 confidence in the label

    # Signal breakdown
    linguistic_score: float = 0.0            # AI phrase density
    structural_score: float = 0.0            # structural uniformity
    statistical_score: float = 0.0           # statistical anomalies
    community_score: float = 0.0             # community consensus signal
    author_declaration_weight: float = 0.0   # author self-declaration

    signals: list[str] = field(default_factory=list)      # human-readable signal descriptions
    risk_factors: list[str] = field(default_factory=list)  # risk factors detected
    recommendation: str = ""                               # corrective recommendation


class AiContentDetector:
    """Multi-signal AI content detection engine.

    Analyzes text through several lenses:
    1. Linguistic patterns — AI-typical phrases and vocabulary
    2. Structural analysis — sentence uniformity, paragraph regularity
    3. Statistical signals — word length distribution, perplexity proxy
    4. Community consensus — crowdsourced flags weighted by reliability
    5. Author declaration — self-declared AI status
    """

    def __init__(self, *, mock: bool = True) -> None:
        self._mock = mock

    def analyze(
        self,
        post_id: str,
        content: str,
        *,
        is_author_declared_ai: bool = False,
        community_ai_votes: int = 0,
        community_human_votes: int = 0,
        ml_features: dict[str, float] | None = None,
        agent_scores: list[dict[str, Any]] | None = None,
    ) -> AiDetectionResult:
        """Run full AI detection analysis on a piece of content."""

        if self._mock and not content.strip():
            return self._mock_result(post_id)

        signals: list[str] = []
        risk_factors: list[str] = []

        # ── 1. Linguistic Pattern Analysis ──
        linguistic_score = self._linguistic_analysis(content, signals)

        # ── 2. Structural Analysis ──
        structural_score = self._structural_analysis(content, signals)

        # ── 3. Statistical Signals ──
        statistical_score = self._statistical_analysis(content, signals, ml_features)

        # ── 4. Community Consensus ──
        community_score = self._community_analysis(
            community_ai_votes, community_human_votes, signals
        )

        # ── 5. Author Declaration ──
        author_weight = 0.0
        if is_author_declared_ai:
            author_weight = 0.95
            signals.append("Author self-declared content as AI-generated (high weight)")

        # ── 6. Multi-agent signal (if available) ──
        agent_signal = 0.0
        if agent_scores:
            avg_agent = statistics.mean(s.get("score", 0.5) for s in agent_scores)
            agent_signal = avg_agent
            if avg_agent > 0.7:
                signals.append(
                    f"Multi-agent analysis: average AI probability {avg_agent:.0%}"
                )
                risk_factors.append("High AI probability from regional bias agents")

        # ── Weighted combination ──
        weights = {
            "linguistic": 0.20,
            "structural": 0.15,
            "statistical": 0.15,
            "community": 0.20,
            "author": 0.15,
            "agent": 0.15,
        }

        raw_probability = (
            weights["linguistic"] * linguistic_score
            + weights["structural"] * structural_score
            + weights["statistical"] * statistical_score
            + weights["community"] * community_score
            + weights["author"] * author_weight
            + weights["agent"] * agent_signal
        )

        # Clamp to [0, 1]
        overall_ai_prob = max(0.0, min(1.0, raw_probability))
        trust_score = max(0.0, min(100.0, (1.0 - overall_ai_prob) * 100))

        # Determine label
        label, confidence = self._classify(overall_ai_prob)

        # Risk factors
        if overall_ai_prob > 0.8:
            risk_factors.append("Very high AI probability — recommend mandatory AI label")
        elif overall_ai_prob > 0.6:
            risk_factors.append("Elevated AI probability — recommend AI content advisory")
        if linguistic_score > 0.5 and structural_score > 0.5:
            risk_factors.append("Both linguistic and structural AI patterns detected")
        if community_score > 0.7 and not is_author_declared_ai:
            risk_factors.append(
                "Strong community AI consensus but author did not declare AI — transparency gap"
            )

        # Recommendation
        recommendation = self._generate_recommendation(
            label, overall_ai_prob, risk_factors, is_author_declared_ai
        )

        return AiDetectionResult(
            post_id=post_id,
            overall_ai_probability=round(overall_ai_prob, 4),
            trust_score=round(trust_score, 2),
            recommended_label=label,
            confidence=round(confidence, 4),
            linguistic_score=round(linguistic_score, 4),
            structural_score=round(structural_score, 4),
            statistical_score=round(statistical_score, 4),
            community_score=round(community_score, 4),
            author_declaration_weight=round(author_weight, 4),
            signals=signals,
            risk_factors=risk_factors,
            recommendation=recommendation,
        )

    # ── Private analysis methods ─────────────────────────────────────────────

    def _linguistic_analysis(self, text: str, signals: list[str]) -> float:
        """Check for AI-typical phrases and vocabulary patterns."""
        if not text:
            return 0.0
        words = text.split()
        word_count = len(words)
        if word_count == 0:
            return 0.0

        matches = 0
        matched_phrases: list[str] = []
        for pattern in _AI_PATTERNS_COMPILED:
            found = pattern.findall(text)
            if found:
                matches += len(found)
                matched_phrases.append(found[0])

        # Density: matches per 100 words
        density = (matches / word_count) * 100 if word_count > 0 else 0
        score = min(1.0, density / 5.0)  # 5+ matches per 100 words → max

        if matched_phrases:
            sample = matched_phrases[:3]
            signals.append(
                f"Linguistic: {matches} AI-typical phrases detected "
                f"({density:.1f}/100 words). Examples: {', '.join(sample)}"
            )

        return score

    def _structural_analysis(self, text: str, signals: list[str]) -> float:
        """Analyze structural uniformity — sentence lengths, paragraph regularity."""
        sentences = re.split(r"[.!?]+", text)
        sentences = [s.strip() for s in sentences if s.strip()]
        if len(sentences) < 3:
            return 0.0

        # Sentence length uniformity
        lengths = [len(s.split()) for s in sentences]
        mean_len = statistics.mean(lengths)
        if mean_len == 0:
            return 0.0
        cv = statistics.stdev(lengths) / mean_len if len(lengths) > 1 else 0

        # Very low coefficient of variation → suspiciously uniform (AI)
        uniformity_score = max(0, 1.0 - cv) if cv < 1.0 else 0.0

        # Check for listicle/bullet patterns (common in AI output)
        listicle_matches = len(_LISTICLE_PATTERN.findall(text))
        bullet_matches = len(_BULLET_PATTERN.findall(text))
        header_matches = len(_HEADER_PATTERN.findall(text))
        template_score = min(1.0, (listicle_matches + bullet_matches + header_matches) / 5)

        score = 0.6 * uniformity_score + 0.4 * template_score

        if score > 0.3:
            signals.append(
                f"Structural: sentence-length CV={cv:.2f} (low = uniform), "
                f"{listicle_matches} numbered items, {bullet_matches} bullets"
            )

        return min(1.0, score)

    def _statistical_analysis(
        self,
        text: str,
        signals: list[str],
        ml_features: dict[str, float] | None = None,
    ) -> float:
        """Statistical anomaly detection — word length distribution, diversity."""
        words = text.split()
        if len(words) < 10:
            return 0.0

        # Word length distribution — AI text tends to cluster around mean
        word_lengths = [len(w) for w in words]
        mean_wl = statistics.mean(word_lengths)
        std_wl = statistics.stdev(word_lengths) if len(word_lengths) > 1 else 0

        # Very tight word-length distribution is suspicious
        wl_score = max(0, 1.0 - (std_wl / 4.0)) if std_wl < 4 else 0.0

        # Lexical diversity (type-token ratio)
        unique = set(w.lower() for w in words)
        ttr = len(unique) / len(words) if words else 1
        # Low diversity is suspicious
        diversity_score = max(0, 1.0 - ttr) if ttr < 1 else 0.0

        # Incorporate ML features if available
        ml_score = 0.0
        if ml_features:
            perplexity = ml_features.get("perplexity_proxy", 0.5)
            repetition = ml_features.get("repetition_ratio", 0.1)
            ml_score = (1.0 - perplexity) * 0.5 + repetition * 0.5

        score = 0.3 * wl_score + 0.3 * diversity_score + 0.4 * ml_score

        if score > 0.3:
            signals.append(
                f"Statistical: mean word length {mean_wl:.1f}±{std_wl:.1f}, "
                f"lexical diversity {ttr:.2f}, ML features score {ml_score:.2f}"
            )

        return min(1.0, score)

    def _community_analysis(
        self, ai_votes: int, human_votes: int, signals: list[str]
    ) -> float:
        """Community consensus signal with reliability weighting."""
        total = ai_votes + human_votes
        if total == 0:
            return 0.5  # No data → neutral

        ai_ratio = ai_votes / total

        # Reliability increases with sample size (logistic curve)
        reliability = 1.0 / (1.0 + math.exp(-0.1 * (total - 20)))

        # Weighted score: move toward ai_ratio as reliability increases
        score = 0.5 + (ai_ratio - 0.5) * reliability

        if total >= 5:
            signals.append(
                f"Community: {ai_votes} AI flags vs {human_votes} human flags "
                f"(ratio {ai_ratio:.0%}, reliability {reliability:.0%})"
            )

        return score

    def _classify(self, probability: float) -> tuple[str, float]:
        """Classify into human-readable label with confidence."""
        if probability >= 0.85:
            return "ai-generated", 0.90 + (probability - 0.85) * 0.67
        elif probability >= 0.65:
            return "likely-ai", 0.70 + (probability - 0.65) * 1.0
        elif probability >= 0.40:
            return "uncertain", 0.40 + abs(0.50 - probability) * 2.0
        elif probability >= 0.20:
            return "likely-human", 0.70 + (0.40 - probability) * 1.5
        else:
            return "human", 0.85 + (0.20 - probability) * 0.75

    def _generate_recommendation(
        self,
        label: str,
        probability: float,
        risk_factors: list[str],
        is_declared: bool,
    ) -> str:
        """Generate a corrective action recommendation."""
        if label in ("ai-generated", "likely-ai"):
            if is_declared:
                return (
                    "Content is correctly labeled as AI-generated. "
                    "Transparency maintained. No corrective action needed."
                )
            return (
                f"AI probability is {probability:.0%}. Recommend applying "
                '"AI Content" label to maintain platform transparency. '
                "Consider community review before amplification in feeds."
            )
        elif label == "uncertain":
            return (
                f"AI probability is {probability:.0%} — content is disputed. "
                "Recommend flagging for community review and limiting "
                "algorithmic amplification until consensus is reached."
            )
        else:
            return (
                "Content appears authentically human-created. "
                "No AI label needed. Continue normal distribution."
            )

    def _mock_result(self, post_id: str) -> AiDetectionResult:
        """Deterministic mock result for demo/testing."""
        h = int(hashlib.sha256(post_id.encode()).hexdigest()[:8], 16) % 1000
        prob = h / 1000
        label, conf = self._classify(prob)
        return AiDetectionResult(
            post_id=post_id,
            overall_ai_probability=round(prob, 4),
            trust_score=round((1 - prob) * 100, 2),
            recommended_label=label,
            confidence=round(conf, 4),
            signals=["Mock mode — deterministic result from post ID hash"],
            risk_factors=[],
            recommendation="Mock mode — no real analysis performed",
        )
