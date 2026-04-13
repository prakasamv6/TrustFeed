"""LangGraph-based multi-agent orchestration for bias analysis.

Uses LangGraph's StateGraph to orchestrate 6 agents (5 regional + 1 baseline)
as nodes in a directed graph:

    ┌──────────┐
    │ Prepare  │  (content pipeline + ML feature extraction)
    └────┬─────┘
         │
    ┌────▼─────┐
    │ Fan-Out  │  (parallel dispatch to all 6 agents)
    └────┬─────┘
         │
  ┌──────┼──────┬──────┬──────┬──────┐
  ▼      ▼      ▼      ▼      ▼      ▼
Africa  Asia  Europe Americas Oceania Baseline
  │      │      │      │      │      │
  └──────┴──────┴──────┴──────┴──────┘
         │
    ┌────▼──────┐
    │ Aggregate │  (combine scores, compute raw biased score)
    └────┬──────┘
         │
    ┌────▼──────┐
    │ Debias    │  (apply debiasing formulas)
    └────┬──────┘
         │
    ┌────▼──────────┐
    │ Bias Detect   │  (per-agent bias mode analysis + highlights)
    └────┬──────────┘
         │
    ┌────▼──────┐
    │ Explain   │  (generate human-readable summary)
    └────┬──────┘
         │
    ┌────▼──────┐
    │  Report   │  (build downloadable JSON report)
    └───────────┘

When LangGraph is not installed, falls back to a simple sequential executor
that preserves the same node order and state schema.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from agents.base_agent import AgentScoreResult

# ── Graph state ──────────────────────────────────────────────────────────────

@dataclass
class AnalysisState:
    """Shared state that flows through the LangGraph graph."""
    # Inputs
    post_id: str = ""
    content_type: str = "text"
    content: str = ""
    media_url: str | None = None
    local_file_path: str | None = None
    mock: bool = True

    # After prepare
    prepared_content: str = ""
    ml_features: dict = field(default_factory=dict)

    # After agents
    regional_scores: list[AgentScoreResult] = field(default_factory=list)
    baseline_score: AgentScoreResult | None = None

    # After aggregate
    raw_biased_score: float = 0.0

    # After debias
    debiased_result: Any = None       # DebiasedResult

    # After bias detection
    bias_report: Any = None           # BiasDetectionReport

    # After factor attribution
    factor_attribution: Any = None    # FactorAttributionReport

    # After explain
    explanation: str = ""

    # After report
    report_json: str = ""


# ── Node functions ───────────────────────────────────────────────────────────

def node_prepare(state: AnalysisState) -> AnalysisState:
    """Pipeline preprocessing + ML feature extraction."""
    from analyzers import TextAnalyzer, ImageAnalyzer, VideoAnalyzer

    ct = state.content_type.lower()

    if ct == "text":
        result = TextAnalyzer.analyze(state.content, mock=state.mock)
        state.prepared_content = state.content.strip()[:2000]
        state.ml_features = result.features
        state.ml_features["_raw_ml_score"] = result.raw_score
        state.ml_features["_model"] = result.model_name

    elif ct == "image":
        result = ImageAnalyzer.analyze(state.media_url, state.local_file_path, mock=state.mock)
        state.prepared_content = f"image:{state.media_url or state.local_file_path or 'unknown'}"
        state.ml_features = result.features
        state.ml_features["_raw_ml_score"] = result.raw_score
        state.ml_features["_model"] = result.model_name

    elif ct == "video":
        result = VideoAnalyzer.analyze(state.media_url, state.local_file_path, mock=state.mock)
        state.prepared_content = f"video:{state.media_url or state.local_file_path or 'unknown'}"
        state.ml_features = result.features
        state.ml_features["_raw_ml_score"] = result.raw_score
        state.ml_features["_model"] = result.model_name
        state.ml_features["_frame_scores"] = result.frame_scores

    else:
        result = TextAnalyzer.analyze(state.content, mock=state.mock)
        state.prepared_content = state.content.strip()[:2000]
        state.ml_features = result.features
        state.ml_features["_raw_ml_score"] = result.raw_score
        state.ml_features["_model"] = result.model_name

    return state


def _run_regional_agent(state: AnalysisState, region: str) -> AgentScoreResult:
    """Run one regional agent with its bias profile applied to ML features."""
    from agents.bias_profiles import get_profile
    from agents import (
        AfricaBiasAgent, AsiaBiasAgent, EuropeBiasAgent,
        AmericasBiasAgent, OceaniaBiasAgent,
    )

    agent_map = {
        "Africa": AfricaBiasAgent(),
        "Asia": AsiaBiasAgent(),
        "Europe": EuropeBiasAgent(),
        "Americas": AmericasBiasAgent(),
        "Oceania": OceaniaBiasAgent(),
    }

    agent = agent_map[region]
    profile = get_profile(region)
    ml_score = state.ml_features.get("_raw_ml_score", 0.5)

    if state.mock:
        # In mock mode agents still use their own hash, but we blend in ML features
        result = agent.score(state.prepared_content, state.content_type, mock=True)

        # Apply region-specific feature weighting to adjust the score
        feature_adjustment = 0.0
        for feat_key, weight in profile.feature_weights.items():
            feat_val = state.ml_features.get(feat_key, 0)
            if isinstance(feat_val, (int, float)):
                # Normalise features to a 0-1ish range for adjustment
                norm = min(1.0, feat_val / 1000) if feat_val > 1 else feat_val
                feature_adjustment += (weight - 1.0) * norm * 0.05

        # Text sensitivities
        if state.content_type == "text":
            for sens_key, sens_val in profile.text_sensitivities.items():
                feature_adjustment += sens_val * 0.08

        # Blend: base mock score + feature-weighted adjustment + bias direction
        adjusted = result.score + feature_adjustment + profile.bias_direction * profile.bias_intensity * 0.15
        adjusted = round(min(1.0, max(0.0, adjusted)), 4)

        return AgentScoreResult(
            agent_name=result.agent_name,
            region=result.region,
            score=adjusted,
            confidence=result.confidence,
            reasoning=(
                f"{profile.cultural_context[:120]}... "
                f"Feature-adjusted Δ={feature_adjustment:+.3f}, "
                f"bias_direction={profile.bias_direction:+.2f}, "
                f"intensity={profile.bias_intensity:.0%}."
            ),
        )

    # Live mode — blend ML raw score with bias profile
    result = agent.score(state.prepared_content, state.content_type, mock=False)
    feature_adjustment = 0.0
    for feat_key, weight in profile.feature_weights.items():
        feat_val = state.ml_features.get(feat_key, 0)
        if isinstance(feat_val, (int, float)):
            norm = min(1.0, feat_val / 1000) if feat_val > 1 else feat_val
            feature_adjustment += (weight - 1.0) * norm * 0.05

    adjusted = ml_score + feature_adjustment + profile.bias_direction * profile.bias_intensity * 0.15
    adjusted = round(min(1.0, max(0.0, adjusted)), 4)

    return AgentScoreResult(
        agent_name=result.agent_name,
        region=result.region,
        score=adjusted,
        confidence=result.confidence,
        reasoning=result.reasoning,
    )


def node_agents(state: AnalysisState) -> AnalysisState:
    """Run all 5 regional agents + baseline."""
    from agents import NonBiasBaselineAgent

    regions = ["Africa", "Asia", "Europe", "Americas", "Oceania"]
    state.regional_scores = [_run_regional_agent(state, r) for r in regions]

    baseline = NonBiasBaselineAgent()
    state.baseline_score = baseline.score(
        state.prepared_content, state.content_type, mock=state.mock
    )
    return state


def node_aggregate(state: AnalysisState) -> AnalysisState:
    """Compute raw biased score from regional agents."""
    from scoring.aggregation import aggregate_scores
    state.raw_biased_score = aggregate_scores(state.regional_scores, bias_strength=0.85)
    return state


def node_debias(state: AnalysisState) -> AnalysisState:
    """Apply debiasing formulas."""
    from scoring.bias_deduction import compute_debiased_result
    state.debiased_result = compute_debiased_result(
        state.regional_scores,
        state.baseline_score,
        state.raw_biased_score,
    )
    return state


def node_bias_detect(state: AnalysisState) -> AnalysisState:
    """Run per-agent bias detection and highlighting."""
    from scoring.bias_detector import detect_bias
    state.bias_report = detect_bias(
        state.regional_scores,
        state.baseline_score,
        state.content_type,
    )
    return state


def node_factor_attribution(state: AnalysisState) -> AnalysisState:
    """Compute per-feature factor attribution for bias explainability."""
    from scoring.factor_attribution import compute_factor_attribution
    state.factor_attribution = compute_factor_attribution(
        state.regional_scores,
        state.baseline_score,
        state.ml_features,
        state.content_type,
    )
    return state


def node_explain(state: AnalysisState) -> AnalysisState:
    """Generate human-readable explanation."""
    from scoring.explainability import generate_explanation
    explanation = generate_explanation(state.debiased_result)

    # Append bias detector summary
    if state.bias_report:
        explanation += f" [Bias Detector] {state.bias_report.summary}"

    # Append factor attribution summary
    if state.factor_attribution:
        explanation += f" [Factor Attribution] {state.factor_attribution.fairness_summary}"

    state.explanation = explanation
    return state


def node_report(state: AnalysisState) -> AnalysisState:
    """Build downloadable JSON report."""
    from reports.report_builder import ReportBuilder
    all_scores = state.regional_scores + ([state.baseline_score] if state.baseline_score else [])
    state.report_json = ReportBuilder.build_json(
        state.post_id,
        state.content_type,
        all_scores,
        state.debiased_result,
        state.explanation,
    )
    return state


# ── Graph construction ───────────────────────────────────────────────────────

def _build_langgraph():
    """Build and compile the LangGraph state graph."""
    from langgraph.graph import StateGraph, END

    graph = StateGraph(AnalysisState)

    # Add nodes
    graph.add_node("prepare", node_prepare)
    graph.add_node("agents", node_agents)
    graph.add_node("aggregate", node_aggregate)
    graph.add_node("debias", node_debias)
    graph.add_node("bias_detect", node_bias_detect)
    graph.add_node("factor_attribution", node_factor_attribution)
    graph.add_node("explain", node_explain)
    graph.add_node("report", node_report)

    # Define edges (linear pipeline)
    graph.set_entry_point("prepare")
    graph.add_edge("prepare", "agents")
    graph.add_edge("agents", "aggregate")
    graph.add_edge("aggregate", "debias")
    graph.add_edge("debias", "bias_detect")
    graph.add_edge("bias_detect", "factor_attribution")
    graph.add_edge("factor_attribution", "explain")
    graph.add_edge("explain", "report")
    graph.add_edge("report", END)

    return graph.compile()


class _LangGraphWrapper:
    """Wraps compiled LangGraph to convert dict output back to AnalysisState."""

    def __init__(self, compiled_graph):
        self._graph = compiled_graph

    def invoke(self, state: AnalysisState) -> AnalysisState:
        result = self._graph.invoke(state)
        if isinstance(result, dict):
            return AnalysisState(**result)
        return result


class _SequentialFallback:
    """Fallback executor when LangGraph is not installed."""

    _NODES = [
        node_prepare,
        node_agents,
        node_aggregate,
        node_debias,
        node_bias_detect,
        node_factor_attribution,
        node_explain,
        node_report,
    ]

    def invoke(self, state: AnalysisState) -> AnalysisState:
        for fn in self._NODES:
            state = fn(state)
        return state


def get_orchestrator():
    """Return the compiled LangGraph graph, or a sequential fallback."""
    try:
        return _LangGraphWrapper(_build_langgraph())
    except Exception:
        return _SequentialFallback()
