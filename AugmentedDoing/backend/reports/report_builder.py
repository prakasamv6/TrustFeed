"""Build downloadable JSON reports for individual post analyses."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from agents.base_agent import AgentScoreResult
from scoring.bias_deduction import DebiasedResult


class ReportBuilder:
    @staticmethod
    def build_json(
        post_id: str,
        content_type: str,
        agent_scores: list[AgentScoreResult],
        debiased: DebiasedResult,
        explanation: str,
    ) -> str:
        report = {
            "reportVersion": "1.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "disclaimer": "BIAS SIMULATOR - NOT A REAL PROVENANCE JUDGE",
            "postId": post_id,
            "contentType": content_type,
            "agentScores": [
                {
                    "agent": s.agent_name,
                    "region": s.region,
                    "score": s.score,
                    "confidence": s.confidence,
                    "reasoning": s.reasoning,
                }
                for s in agent_scores
            ],
            "biasResult": {
                "rawBiasedScore": debiased.raw_biased_score,
                "baselineNonbiasedScore": debiased.baseline_score,
                "debiasedAdjustedScore": debiased.debiased_adjusted_score,
                "biasDelta": debiased.bias_delta,
                "deductedBiasAmount": debiased.deducted_bias_amount,
                "biasAmplificationIndex": debiased.bias_amplification_index,
                "disagreementRate": debiased.disagreement_rate,
                "regionDominanceScore": debiased.region_dominance_score,
                "favoritismFlag": debiased.favoritism_flag,
                "dominantBiasedAgent": debiased.dominant_biased_agent,
                "favoredRegion": debiased.favored_region,
                "favoredSegments": debiased.favored_segments,
            },
            "explanationSummary": explanation,
        }
        return json.dumps(report, indent=2)
