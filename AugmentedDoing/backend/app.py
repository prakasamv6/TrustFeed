"""TrustFeed Bias Simulation Backend — FastAPI application.

Run with:  uvicorn app:app --reload
"""

from __future__ import annotations

import os
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter
from pydantic import BaseModel

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
from storage import AnalysisRepository  # noqa: E402

repo = AnalysisRepository()
from storage.repository import StoredAnalysis  # noqa: E402

# ── FastAPI app ──────────────────────────────────────────────────────────────
API_PREFIX = os.getenv("API_PREFIX", "")  # Set to "/api" on DO App Platform

app = FastAPI(
    title="TrustFeed Bias Simulation API",
    version="1.0.0",
    description="BIAS SIMULATOR - NOT A REAL PROVENANCE JUDGE",
)

cors_origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else CFG.get("cors_origins", ["http://localhost:4200"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ─────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    postId: str
    contentType: str = "text"
    content: str = ""
    mediaUrl: str | None = None
    localFilePath: str | None = None


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


class AnalyzeResponse(BaseModel):
    postId: str
    status: str
    agentScores: list[AgentScoreResponse]
    biasResult: BiasResultResponse
    biasDetection: BiasDetectionResponse | None = None
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
