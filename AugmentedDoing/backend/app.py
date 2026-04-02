"""TrustFeed Bias Simulation Backend — FastAPI application.

Run with:  uvicorn app:app --reload
"""

from __future__ import annotations

import os
import re
import statistics
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from pydantic import BaseModel, field_validator

# ── Load config ──────────────────────────────────────────────────────────────
_cfg_dir = Path(__file__).parent / "config"

with open(_cfg_dir / "default.yaml") as f:
    CFG = yaml.safe_load(f)

MOCK_MODE = os.getenv("MOCK_MODE", str(CFG.get("mock_mode", True))).lower() in ("true", "1", "yes")
BIAS_STRENGTH = float(os.getenv("BIAS_STRENGTH", CFG.get("bias_strength", 0.85)))
RESIDUAL_MAX = float(os.getenv("RESIDUAL_ADJUSTMENT_MAX", CFG.get("residual_adjustment_max", 0.05)))
REGION_DOM_THRESHOLD = float(os.getenv("REGION_DOMINANCE_THRESHOLD", CFG.get("region_dominance_threshold", 0.60)))
BIAS_WARN_THRESHOLD = float(os.getenv("BIAS_WARNING_THRESHOLD", CFG.get("bias_warning_threshold", 0.20)))

# ── Agents ───────────────────────────────────────────────────────────────────
from agents import (  # noqa: E402
    AfricaBiasAgent,
    AmericasBiasAgent,
    AsiaBiasAgent,
    EuropeBiasAgent,
    NonBiasBaselineAgent,
    OceaniaBiasAgent,
)

REGIONAL_AGENTS = [
    AfricaBiasAgent(),
    AsiaBiasAgent(),
    EuropeBiasAgent(),
    AmericasBiasAgent(),
    OceaniaBiasAgent(),
]
BASELINE_AGENT = NonBiasBaselineAgent()

# ── Pipelines ────────────────────────────────────────────────────────────────
from pipelines import ImagePipeline, TextPipeline, VideoPipeline  # noqa: E402

# ── Scoring ──────────────────────────────────────────────────────────────────
from scoring import aggregate_scores, compute_debiased_result, generate_explanation  # noqa: E402
from scoring.bias_detector import detect_bias  # noqa: E402

# ── LangGraph Orchestration ──────────────────────────────────────────────────
from orchestration import AnalysisState, get_orchestrator  # noqa: E402
orchestrator = get_orchestrator()

# ── Reports & Storage ────────────────────────────────────────────────────────
from reports import ReportBuilder  # noqa: E402
from storage import AnalysisRepository, FairnessStore, FlagStore

repo = AnalysisRepository()
fairness_store = FairnessStore()
flag_store = FlagStore()
from storage.repository import StoredAnalysis  # noqa: E402
from storage.fairness_store import FairnessSurveyResponse  # noqa: E402
from storage.flag_store import AiContentFlag  # noqa: E402

# ── Detection modules ────────────────────────────────────────────────────────
from detection import (  # noqa: E402
    AiContentDetector,
    TrendCircuitBreaker,
    TrendEngagement,
    CorrectiveEngine,
)
from detection.trend_circuit_breaker import seed_mock_trends  # noqa: E402

ai_detector = AiContentDetector(mock=MOCK_MODE)
trend_breaker = TrendCircuitBreaker()
corrective_engine = CorrectiveEngine()

# Seed mock trending data for demo
if MOCK_MODE:
    seed_mock_trends(trend_breaker)

# ── FastAPI app ──────────────────────────────────────────────────────────────
API_PREFIX = os.getenv("API_PREFIX", "")  # Set to "/api" on DO App Platform

app = FastAPI(
    title="TrustFeed Bias Simulation API",
    version="1.0.0",
    description="BIAS SIMULATOR - NOT A REAL PROVENANCE JUDGE",
)

cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()] or CFG.get("cors_origins", ["http://localhost:4200"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ── Rate Limiting Middleware (DDoS protection) ───────────────────────────────

_rate_limit_store: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 30  # requests per window


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Clean old entries
    _rate_limit_store[client_ip] = [
        t for t in _rate_limit_store[client_ip] if now - t < RATE_LIMIT_WINDOW
    ]

    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please wait before trying again."},
        )

    _rate_limit_store[client_ip].append(now)
    response = await call_next(request)
    return response


# ── Security: SQL Injection & XSS pattern detection ─────────────────────────

_SQLI_PATTERNS = [
    re.compile(r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|TABLE|SET|WHERE)\b)", re.I),
    re.compile(r"(--|#|/\*|\*/|;)\s*(DROP|ALTER|DELETE|UPDATE|INSERT|SELECT)", re.I),
    re.compile(r"('\s*(OR|AND)\s*'?\d*\s*=\s*\d*)", re.I),
]
_XSS_PATTERNS = [
    re.compile(r"<script[\s>]", re.I),
    re.compile(r"javascript:", re.I),
    re.compile(r"on\w+\s*=", re.I),
]


def _contains_malicious_input(text: str) -> bool:
    """Defense-in-depth check for SQLi/XSS patterns in free-text input."""
    return any(p.search(text) for p in _SQLI_PATTERNS + _XSS_PATTERNS)


# ── Pydantic models ─────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    postId: str
    contentType: str = "text"
    content: str = ""
    mediaUrl: str | None = None
    localFilePath: str | None = None

    @field_validator("postId")
    @classmethod
    def validate_post_id(cls, v: str) -> str:
        if not v or len(v) > 128:
            raise ValueError("postId must be 1-128 characters")
        if _contains_malicious_input(v):
            raise ValueError("Invalid characters in postId")
        return v

    @field_validator("contentType")
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        allowed = {"text", "image", "video"}
        if v.lower() not in allowed:
            raise ValueError(f"contentType must be one of: {allowed}")
        return v.lower()

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if len(v) > 50_000:
            raise ValueError("content must be under 50,000 characters")
        if _contains_malicious_input(v):
            raise ValueError("Content contains disallowed patterns")
        return v

    @field_validator("mediaUrl")
    @classmethod
    def validate_media_url(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) > 2048:
            raise ValueError("mediaUrl is too long")
        if not v.startswith(("http://", "https://")):
            raise ValueError("mediaUrl must be an HTTP(S) URL")
        if _contains_malicious_input(v):
            raise ValueError("mediaUrl contains disallowed patterns")
        return v

    @field_validator("localFilePath")
    @classmethod
    def validate_local_file_path(cls, v: str | None) -> str | None:
        """Block path traversal attacks (e.g. ../../etc/passwd)."""
        if v is None:
            return v
        # Block path traversal sequences
        if ".." in v or v.startswith("/") or "~" in v:
            raise ValueError("Path traversal is not allowed")
        # Only allow safe file extensions
        allowed_ext = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".webm", ".mov"}
        ext = Path(v).suffix.lower()
        if ext not in allowed_ext:
            raise ValueError(f"File extension '{ext}' is not allowed")
        return v


class BiasResultResponse(BaseModel):
    rawBiasedScore: float
    baselineNonbiasedScore: float
    debiasedAdjustedScore: float
    biasDelta: float
    deductedBiasAmount: float
    biasAmplificationIndex: float
    disagreementRate: float
    regionDominanceScore: float
    favoritismFlag: bool
    dominantBiasedAgent: str
    favoredRegion: str | None
    favoredSegments: list[str]
    explanationSummary: str
    reportPath: str


class AgentScoreResponse(BaseModel):
    agent: str
    region: str | None
    score: float
    confidence: float
    biasHighlights: list[str] = []


class BiasHighlightResponse(BaseModel):
    agentName: str
    region: str | None
    biasMode: str
    deltaFromBaseline: float
    severity: str
    explanation: str


class BiasDetectionResponse(BaseModel):
    mostBiasedAgent: str
    leastBiasedAgent: str
    overallBiasLevel: str
    summary: str
    flaggedItems: list[BiasHighlightResponse]


class FactorContributionResponse(BaseModel):
    factorName: str
    factorCategory: str
    rawValue: float
    weight: float
    contribution: float
    contributionPct: float
    description: str


class AgentAttributionResponse(BaseModel):
    agentName: str
    region: str | None
    agentScore: float
    baselineScore: float
    totalDelta: float
    factors: list[FactorContributionResponse]
    topFactor: str
    summary: str


class FactorAttributionResponse(BaseModel):
    agentAttributions: list[AgentAttributionResponse]
    globalTopFactors: list[str]
    proxyRiskIndicators: list[str]
    fairnessSummary: str


class FairnessSurveyRequest(BaseModel):
    postId: str
    originalFairness: int = 3
    nonbiasedFairness: int = 3
    explanationClarity: int = 3
    trustImpact: int = 3
    perceivedBiasSeverity: int = 3
    comment: str = ""

    @field_validator("originalFairness", "nonbiasedFairness", "explanationClarity",
                     "trustImpact", "perceivedBiasSeverity")
    @classmethod
    def validate_likert(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: str) -> str:
        if len(v) > 2000:
            raise ValueError("Comment must be under 2000 characters")
        if v and _contains_malicious_input(v):
            raise ValueError("Comment contains disallowed patterns")
        return v


class AnalyzeResponse(BaseModel):
    postId: str
    status: str
    agentScores: list[AgentScoreResponse]
    biasResult: BiasResultResponse
    biasDetection: BiasDetectionResponse | None = None
    factorAttribution: FactorAttributionResponse | None = None
    mlFeatures: dict = {}


# ── Routes ───────────────────────────────────────────────────────────────────
# Use API_PREFIX so routes work behind DO App Platform's preserve_path_prefix
router = APIRouter(prefix=API_PREFIX)


@router.get("/health")
def health():
    langgraph_available = False
    try:
        import langgraph  # noqa: F401
        langgraph_available = True
    except ImportError:
        pass

    torch_available = False
    try:
        import torch  # noqa: F401
        torch_available = True
    except ImportError:
        pass

    return {
        "status": "ok",
        "mockMode": MOCK_MODE,
        "orchestration": "langgraph" if langgraph_available else "sequential-fallback",
        "torchAvailable": torch_available,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    # ── Run the full LangGraph orchestration pipeline ──
    state = AnalysisState(
        post_id=req.postId,
        content_type=req.contentType.lower(),
        content=req.content,
        media_url=req.mediaUrl,
        local_file_path=req.localFilePath,
        mock=MOCK_MODE,
    )

    state = orchestrator.invoke(state)

    # ── Store result ──
    all_scores = state.regional_scores + ([state.baseline_score] if state.baseline_score else [])
    stored = StoredAnalysis(
        post_id=req.postId,
        content_type=state.content_type,
        agent_scores=all_scores,
        debiased=state.debiased_result,
        explanation=state.explanation,
        report_json=state.report_json,
    )
    repo.save(stored)

    # ── Build bias detection response ──
    bias_detection = None
    if state.bias_report:
        bias_detection = BiasDetectionResponse(
            mostBiasedAgent=state.bias_report.most_biased_agent,
            leastBiasedAgent=state.bias_report.least_biased_agent,
            overallBiasLevel=state.bias_report.overall_bias_level,
            summary=state.bias_report.summary,
            flaggedItems=[
                BiasHighlightResponse(
                    agentName=h.agent_name,
                    region=h.region,
                    biasMode=h.bias_mode.value,
                    deltaFromBaseline=h.delta_from_baseline,
                    severity=h.severity,
                    explanation=h.explanation,
                )
                for h in state.bias_report.flagged_items
            ],
        )

    # ── Build factor attribution response ──
    factor_attribution_resp = None
    if state.factor_attribution:
        fa = state.factor_attribution
        factor_attribution_resp = FactorAttributionResponse(
            agentAttributions=[
                AgentAttributionResponse(
                    agentName=aa.agent_name,
                    region=aa.region,
                    agentScore=aa.agent_score,
                    baselineScore=aa.baseline_score,
                    totalDelta=aa.total_delta,
                    factors=[
                        FactorContributionResponse(
                            factorName=fc.factor_name,
                            factorCategory=fc.factor_category,
                            rawValue=fc.raw_value,
                            weight=fc.weight,
                            contribution=fc.contribution,
                            contributionPct=fc.contribution_pct,
                            description=fc.description,
                        )
                        for fc in aa.factors
                    ],
                    topFactor=aa.top_factor,
                    summary=aa.summary,
                )
                for aa in fa.agent_attributions
            ],
            globalTopFactors=fa.global_top_factors,
            proxyRiskIndicators=fa.proxy_risk_indicators,
            fairnessSummary=fa.fairness_summary,
        )

    # ── Response ──
    debiased = state.debiased_result
    return AnalyzeResponse(
        postId=req.postId,
        status="completed",
        agentScores=[
            AgentScoreResponse(
                agent=s.agent_name, region=s.region, score=s.score,
                confidence=s.confidence, biasHighlights=s.bias_highlights,
            )
            for s in all_scores
        ],
        biasResult=BiasResultResponse(
            rawBiasedScore=debiased.raw_biased_score,
            baselineNonbiasedScore=debiased.baseline_score,
            debiasedAdjustedScore=debiased.debiased_adjusted_score,
            biasDelta=debiased.bias_delta,
            deductedBiasAmount=debiased.deducted_bias_amount,
            biasAmplificationIndex=debiased.bias_amplification_index,
            disagreementRate=debiased.disagreement_rate,
            regionDominanceScore=debiased.region_dominance_score,
            favoritismFlag=debiased.favoritism_flag,
            dominantBiasedAgent=debiased.dominant_biased_agent,
            favoredRegion=debiased.favored_region,
            favoredSegments=debiased.favored_segments,
            explanationSummary=state.explanation,
            reportPath=f"/reports/{req.postId}",
        ),
        biasDetection=bias_detection,
        factorAttribution=factor_attribution_resp,
        mlFeatures={k: v for k, v in state.ml_features.items() if not k.startswith("_")},
    )


@router.get("/analysis/{post_id}", response_model=AnalyzeResponse)
def get_analysis(post_id: str):
    stored = repo.get(post_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return AnalyzeResponse(
        postId=stored.post_id,
        status="completed",
        agentScores=[
            AgentScoreResponse(
                agent=s.agent_name, region=s.region, score=s.score,
                confidence=s.confidence,
                biasHighlights=s.bias_highlights if hasattr(s, "bias_highlights") else [],
            )
            for s in stored.agent_scores
        ],
        biasResult=BiasResultResponse(
            rawBiasedScore=stored.debiased.raw_biased_score,
            baselineNonbiasedScore=stored.debiased.baseline_score,
            debiasedAdjustedScore=stored.debiased.debiased_adjusted_score,
            biasDelta=stored.debiased.bias_delta,
            deductedBiasAmount=stored.debiased.deducted_bias_amount,
            biasAmplificationIndex=stored.debiased.bias_amplification_index,
            disagreementRate=stored.debiased.disagreement_rate,
            regionDominanceScore=stored.debiased.region_dominance_score,
            favoritismFlag=stored.debiased.favoritism_flag,
            dominantBiasedAgent=stored.debiased.dominant_biased_agent,
            favoredRegion=stored.debiased.favored_region,
            favoredSegments=stored.debiased.favored_segments,
            explanationSummary=stored.explanation,
            reportPath=f"/reports/{stored.post_id}",
        ),
    )


@router.get("/reports/{post_id}")
def get_report(post_id: str):
    stored = repo.get(post_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Report not found")
    return JSONResponse(
        content={"report": stored.report_json},
        media_type="application/json",
    )


# ── Dashboard endpoints ─────────────────────────────────────────────────────


@router.get("/dashboard/summary")
def dashboard_summary():
    all_analyses = repo.get_all()
    total = len(all_analyses)
    if total == 0:
        return {
            "totalAnalysed": 0,
            "avgBiasDelta": 0,
            "avgDebiasedScore": 0,
            "flaggedCount": 0,
            "debiasedSafeCount": 0,
            "avgDisagreement": 0,
        }

    deltas = [a.debiased.bias_delta for a in all_analyses]
    debiased_scores = [a.debiased.debiased_adjusted_score for a in all_analyses]
    flagged = sum(1 for a in all_analyses if a.debiased.favoritism_flag)
    safe = total - flagged
    disagree = [a.debiased.disagreement_rate for a in all_analyses]

    return {
        "totalAnalysed": total,
        "avgBiasDelta": round(statistics.mean(deltas), 4),
        "avgDebiasedScore": round(statistics.mean(debiased_scores), 4),
        "flaggedCount": flagged,
        "debiasedSafeCount": safe,
        "avgDisagreement": round(statistics.mean(disagree), 4),
    }


@router.get("/dashboard/agent-stats")
def dashboard_agent_stats():
    all_analyses = repo.get_all()
    agent_names = [
        "AfricaBiasAgent", "AsiaBiasAgent", "EuropeBiasAgent",
        "AmericasBiasAgent", "OceaniaBiasAgent", "NonBiasBaselineAgent",
    ]
    stats = {}
    for name in agent_names:
        scores_for_agent = []
        for a in all_analyses:
            for s in a.agent_scores:
                if s.agent_name == name:
                    scores_for_agent.append(s.score)
        if scores_for_agent:
            stats[name] = {
                "avgScore": round(statistics.mean(scores_for_agent), 4),
                "minScore": round(min(scores_for_agent), 4),
                "maxScore": round(max(scores_for_agent), 4),
                "count": len(scores_for_agent),
            }
        else:
            stats[name] = {"avgScore": 0, "minScore": 0, "maxScore": 0, "count": 0}
    return stats


@router.get("/dashboard/trends")
def dashboard_trends():
    all_analyses = repo.get_all()
    now = datetime.now(timezone.utc)
    points = []
    for day_offset in range(6, -1, -1):
        day = (now - timedelta(days=day_offset)).date()
        day_analyses = [
            a for a in all_analyses if a.created_at.date() == day
        ]
        if day_analyses:
            avg_delta = statistics.mean([a.debiased.bias_delta for a in day_analyses])
            avg_debiased = statistics.mean(
                [a.debiased.debiased_adjusted_score for a in day_analyses]
            )
        else:
            avg_delta = 0
            avg_debiased = 0
        points.append({
            "date": day.isoformat(),
            "avgBiasDelta": round(avg_delta, 4),
            "avgDebiasedScore": round(avg_debiased, 4),
            "count": len(day_analyses),
        })
    return points


# ── Fairness Survey endpoints ────────────────────────────────────────────────


@router.post("/fairness-survey")
def submit_fairness_survey(req: FairnessSurveyRequest):
    response = FairnessSurveyResponse(
        post_id=req.postId,
        original_fairness=req.originalFairness,
        nonbiased_fairness=req.nonbiasedFairness,
        explanation_clarity=req.explanationClarity,
        trust_impact=req.trustImpact,
        perceived_bias_severity=req.perceivedBiasSeverity,
        comment=req.comment,
    )
    survey_id = fairness_store.save(response)
    return {"id": survey_id, "status": "saved"}


@router.get("/fairness-survey/{post_id}")
def get_fairness_surveys(post_id: str):
    responses = fairness_store.get_by_post(post_id)
    if not responses:
        return {"postId": post_id, "responses": [], "summary": None}

    n = len(responses)
    summary = {
        "avgOriginalFairness": round(sum(r.original_fairness for r in responses) / n, 2),
        "avgNonbiasedFairness": round(sum(r.nonbiased_fairness for r in responses) / n, 2),
        "avgExplanationClarity": round(sum(r.explanation_clarity for r in responses) / n, 2),
        "avgTrustImpact": round(sum(r.trust_impact for r in responses) / n, 2),
        "avgPerceivedBias": round(sum(r.perceived_bias_severity for r in responses) / n, 2),
        "responseCount": n,
    }

    return {
        "postId": post_id,
        "responses": [
            {
                "id": r.id,
                "originalFairness": r.original_fairness,
                "nonbiasedFairness": r.nonbiased_fairness,
                "explanationClarity": r.explanation_clarity,
                "trustImpact": r.trust_impact,
                "perceivedBiasSeverity": r.perceived_bias_severity,
                "comment": r.comment,
                "createdAt": r.created_at.isoformat(),
            }
            for r in responses
        ],
        "summary": summary,
    }


@router.get("/dashboard/fairness-trends")
def dashboard_fairness_trends():
    return [
        {
            "date": t.date,
            "avgOriginalFairness": t.avg_original_fairness,
            "avgNonbiasedFairness": t.avg_nonbiased_fairness,
            "avgExplanationClarity": t.avg_explanation_clarity,
            "avgTrustImpact": t.avg_trust_impact,
            "avgPerceivedBias": t.avg_perceived_bias,
            "responseCount": t.response_count,
        }
        for t in fairness_store.get_trends(days=7)
    ]


# ── AI Content Detection & Flagging endpoints ────────────────────────────────


class AiFlagRequest(BaseModel):
    postId: str
    flagType: str = "ai"      # ai | human | disputed | misleading
    reason: str = ""
    confidence: int = 3

    @field_validator("flagType")
    @classmethod
    def validate_flag_type(cls, v: str) -> str:
        allowed = {"ai", "human", "disputed", "misleading"}
        if v not in allowed:
            raise ValueError(f"flagType must be one of: {allowed}")
        return v

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("confidence must be between 1 and 5")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        if len(v) > 1000:
            raise ValueError("reason must be under 1000 characters")
        if v and _contains_malicious_input(v):
            raise ValueError("reason contains disallowed patterns")
        return v


class TrendEngagementRequest(BaseModel):
    topic: str
    postId: str
    userId: str = "anonymous"
    isAiContent: bool = False
    engagementType: str = "post"

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        if not v or len(v) > 200:
            raise ValueError("topic must be 1-200 characters")
        if _contains_malicious_input(v):
            raise ValueError("topic contains disallowed patterns")
        return v


@router.post("/flag-ai-content")
def flag_ai_content(req: AiFlagRequest):
    """Community flag: report content as AI-generated, human, disputed, or misleading."""
    flag = AiContentFlag(
        post_id=req.postId,
        flag_type=req.flagType,
        reason=req.reason,
        confidence=req.confidence,
    )
    flag_id = flag_store.save(flag)
    summary = flag_store.get_summary(req.postId)
    return {
        "flagId": flag_id,
        "status": "recorded",
        "summary": {
            "postId": summary.post_id,
            "totalFlags": summary.total_flags,
            "aiFlags": summary.ai_flags,
            "humanFlags": summary.human_flags,
            "disputedFlags": summary.disputed_flags,
            "misleadingFlags": summary.misleading_flags,
            "avgConfidence": summary.avg_confidence,
            "recommendedLabel": summary.recommended_label,
            "consensusStrength": summary.consensus_strength,
        },
    }


@router.get("/content-trust/{post_id}")
def get_content_trust(post_id: str):
    """Get AI detection analysis and trust score for a post."""
    stored = repo.get(post_id)
    content = ""
    is_declared = False
    community_ai = 0
    community_human = 0
    ml_features = None
    agent_scores_data = None

    if stored:
        ml_features = {}
        agent_scores_data = [
            {"score": s.score, "agent": s.agent_name}
            for s in stored.agent_scores
        ]

    # Run AI detection
    result = ai_detector.analyze(
        post_id,
        content,
        is_author_declared_ai=is_declared,
        community_ai_votes=community_ai,
        community_human_votes=community_human,
        ml_features=ml_features,
        agent_scores=agent_scores_data,
    )

    # Get flag summary
    flag_summary = flag_store.get_summary(post_id)

    # Generate corrective actions
    corrections = corrective_engine.generate_post_corrections(
        post_id,
        ai_probability=result.overall_ai_probability,
        recommended_label=result.recommended_label,
        is_author_declared=is_declared,
        bias_delta=stored.debiased.bias_delta if stored else 0,
        favoritism_flag=stored.debiased.favoritism_flag if stored else False,
        dominant_agent=stored.debiased.dominant_biased_agent if stored else None,
        risk_factors=result.risk_factors,
        community_ai_ratio=flag_summary.ai_flags / max(1, flag_summary.total_flags),
    )

    return {
        "postId": post_id,
        "detection": {
            "overallAiProbability": result.overall_ai_probability,
            "trustScore": result.trust_score,
            "recommendedLabel": result.recommended_label,
            "confidence": result.confidence,
            "linguisticScore": result.linguistic_score,
            "structuralScore": result.structural_score,
            "statisticalScore": result.statistical_score,
            "communityScore": result.community_score,
            "authorDeclarationWeight": result.author_declaration_weight,
            "signals": result.signals,
            "riskFactors": result.risk_factors,
            "recommendation": result.recommendation,
        },
        "flags": {
            "totalFlags": flag_summary.total_flags,
            "aiFlags": flag_summary.ai_flags,
            "humanFlags": flag_summary.human_flags,
            "recommendedLabel": flag_summary.recommended_label,
            "consensusStrength": flag_summary.consensus_strength,
        },
        "corrections": {
            "overallRisk": corrections.overall_risk,
            "trustScore": corrections.trust_score,
            "summary": corrections.summary,
            "actions": [
                {
                    "actionId": a.action_id,
                    "category": a.category,
                    "severity": a.severity,
                    "title": a.title,
                    "description": a.description,
                    "rationale": a.rationale,
                    "automated": a.automated,
                }
                for a in corrections.actions
            ],
        },
    }


@router.post("/detect-ai")
def detect_ai_content(req: AnalyzeRequest):
    """Run AI content detection on submitted content (standalone, no bias pipeline)."""
    result = ai_detector.analyze(
        req.postId,
        req.content,
        is_author_declared_ai=False,
    )
    return {
        "postId": req.postId,
        "overallAiProbability": result.overall_ai_probability,
        "trustScore": result.trust_score,
        "recommendedLabel": result.recommended_label,
        "confidence": result.confidence,
        "signals": result.signals,
        "riskFactors": result.risk_factors,
        "recommendation": result.recommendation,
    }


# ── Trending & Circuit Breaker endpoints ─────────────────────────────────────


@router.get("/trending")
def get_trending():
    """Get trending topics with circuit breaker status."""
    topics = trend_breaker.get_trending(limit=20)
    return {
        "topics": [
            {
                "topic": t.topic,
                "postCount": t.post_count,
                "engagementCount": t.engagement_count,
                "velocity": t.velocity,
                "aiContentRatio": t.ai_content_ratio,
                "uniqueAuthors": t.unique_authors,
                "coordinationScore": t.coordination_score,
                "trustScore": t.trust_score,
                "circuitBroken": t.circuit_broken,
                "breakReason": t.break_reason,
                "breakSeverity": t.break_severity,
                "correctiveActions": t.corrective_actions,
                "firstSeen": t.first_seen.isoformat(),
                "lastUpdated": t.last_updated.isoformat(),
            }
            for t in topics
        ],
        "alerts": [
            {
                "topic": a.topic,
                "alertType": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "evidence": a.evidence,
                "recommendedAction": a.recommended_action,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in trend_breaker.get_alerts(since_hours=24)
        ],
    }


@router.post("/trending/engage")
def record_trend_engagement(req: TrendEngagementRequest):
    """Record an engagement event on a trending topic."""
    engagement = TrendEngagement(
        user_id=req.userId,
        post_id=req.postId,
        topic=req.topic,
        is_ai_content=req.isAiContent,
        engagement_type=req.engagementType,
    )
    topic = trend_breaker.record_engagement(engagement)
    return {
        "topic": topic.topic,
        "postCount": topic.post_count,
        "velocity": topic.velocity,
        "aiContentRatio": topic.ai_content_ratio,
        "trustScore": topic.trust_score,
        "circuitBroken": topic.circuit_broken,
        "breakSeverity": topic.break_severity,
        "correctiveActions": topic.corrective_actions,
    }


@router.post("/trending/circuit-break")
def manual_circuit_break(topic: str, reason: str = "Manual intervention"):
    """Manually trigger a circuit break on a trending topic."""
    result = trend_breaker.manual_break(topic, reason)
    if not result:
        raise HTTPException(status_code=404, detail="Topic not found")
    return {
        "topic": result.topic,
        "circuitBroken": result.circuit_broken,
        "breakReason": result.break_reason,
        "correctiveActions": result.corrective_actions,
    }


@router.get("/corrective-actions/{post_id}")
def get_corrective_actions(post_id: str):
    """Get corrective action recommendations for a post."""
    stored = repo.get(post_id)

    # Run detection
    result = ai_detector.analyze(post_id, "", agent_scores=(
        [{"score": s.score, "agent": s.agent_name} for s in stored.agent_scores]
        if stored else None
    ))

    flag_summary = flag_store.get_summary(post_id)

    corrections = corrective_engine.generate_post_corrections(
        post_id,
        ai_probability=result.overall_ai_probability,
        recommended_label=result.recommended_label,
        bias_delta=stored.debiased.bias_delta if stored else 0,
        favoritism_flag=stored.debiased.favoritism_flag if stored else False,
        dominant_agent=stored.debiased.dominant_biased_agent if stored else None,
        risk_factors=result.risk_factors,
        community_ai_ratio=flag_summary.ai_flags / max(1, flag_summary.total_flags),
    )

    return {
        "postId": post_id,
        "overallRisk": corrections.overall_risk,
        "trustScore": corrections.trust_score,
        "summary": corrections.summary,
        "actions": [
            {
                "actionId": a.action_id,
                "category": a.category,
                "severity": a.severity,
                "title": a.title,
                "description": a.description,
                "rationale": a.rationale,
                "automated": a.automated,
                "applied": a.applied,
            }
            for a in corrections.actions
        ],
    }


# ── Startup ──────────────────────────────────────────────────────────────────

# Register the router with all API routes
app.include_router(router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host=CFG.get("host", "0.0.0.0"),
        port=CFG.get("port", 8000),
        reload=True,
    )
