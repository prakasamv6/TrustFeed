"""Unit tests for scoring, bias detection, analyzers, agent profiles, and orchestration."""

import sys
import os
import unittest

# Ensure backend directory is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from agents.base_agent import AgentScoreResult
from scoring.aggregation import aggregate_scores
from scoring.bias_deduction import compute_debiased_result
from scoring.explainability import generate_explanation
from scoring.bias_detector import detect_bias, BiasMode


class TestAggregation(unittest.TestCase):
    def _make_regional(self, scores: list[float]) -> list[AgentScoreResult]:
        regions = ["Africa", "Asia", "Europe", "Americas", "Oceania"]
        return [
            AgentScoreResult(
                agent_name=f"{r}BiasAgent",
                region=r,
                score=s,
                confidence=0.9,
                reasoning="test",
            )
            for r, s in zip(regions, scores)
        ]

    def test_uniform_scores(self):
        regional = self._make_regional([0.5, 0.5, 0.5, 0.5, 0.5])
        raw = aggregate_scores(regional, bias_strength=0.85)
        self.assertAlmostEqual(raw, 0.5, places=3)

    def test_all_ones(self):
        regional = self._make_regional([1.0, 1.0, 1.0, 1.0, 1.0])
        raw = aggregate_scores(regional, bias_strength=0.85)
        self.assertAlmostEqual(raw, 0.925, places=3)

    def test_empty(self):
        raw = aggregate_scores([], bias_strength=0.85)
        self.assertEqual(raw, 0.5)


class TestBiasDeduction(unittest.TestCase):
    def _baseline(self, score: float) -> AgentScoreResult:
        return AgentScoreResult(
            agent_name="NonBiasBaselineAgent",
            region=None,
            score=score,
            confidence=0.9,
            reasoning="baseline",
        )

    def _regional(self, scores: list[float]) -> list[AgentScoreResult]:
        regions = ["Africa", "Asia", "Europe", "Americas", "Oceania"]
        return [
            AgentScoreResult(f"{r}BiasAgent", r, s, 0.9, "test")
            for r, s in zip(regions, scores)
        ]

    def test_bias_delta(self):
        regional = self._regional([0.8, 0.8, 0.8, 0.8, 0.8])
        baseline = self._baseline(0.5)
        raw = 0.75
        result = compute_debiased_result(regional, baseline, raw)
        self.assertAlmostEqual(result.bias_delta, abs(0.75 - 0.5), places=3)

    def test_debiased_clamped(self):
        regional = self._regional([0.9, 0.9, 0.9, 0.9, 0.9])
        baseline = self._baseline(0.5)
        raw = 0.9
        result = compute_debiased_result(regional, baseline, raw, residual_max=0.05)
        self.assertAlmostEqual(result.debiased_adjusted_score, 0.55, places=3)

    def test_deducted_bias(self):
        regional = self._regional([0.9, 0.9, 0.9, 0.9, 0.9])
        baseline = self._baseline(0.5)
        raw = 0.9
        result = compute_debiased_result(regional, baseline, raw, residual_max=0.05)
        self.assertAlmostEqual(result.deducted_bias_amount, 0.35, places=3)

    def test_amplification_index(self):
        regional = self._regional([0.8, 0.8, 0.8, 0.8, 0.8])
        baseline = self._baseline(0.4)
        raw = 0.8
        result = compute_debiased_result(regional, baseline, raw)
        self.assertAlmostEqual(result.bias_amplification_index, 0.8 / 0.4, places=2)

    def test_favoritism_flag(self):
        regional = self._regional([0.95, 0.1, 0.1, 0.1, 0.1])
        baseline = self._baseline(0.3)
        raw = 0.5
        result = compute_debiased_result(
            regional, baseline, raw, region_dominance_threshold=0.60
        )
        self.assertTrue(result.favoritism_flag)
        self.assertEqual(result.dominant_biased_agent, "AfricaBiasAgent")
        self.assertEqual(result.favored_region, "Africa")

    def test_no_favoritism_when_uniform(self):
        regional = self._regional([0.5, 0.5, 0.5, 0.5, 0.5])
        baseline = self._baseline(0.5)
        raw = 0.5
        result = compute_debiased_result(
            regional, baseline, raw, region_dominance_threshold=0.60
        )
        self.assertFalse(result.favoritism_flag)


class TestExplainability(unittest.TestCase):
    def test_explanation_generated(self):
        from scoring.bias_deduction import DebiasedResult

        result = DebiasedResult(
            raw_biased_score=0.85,
            baseline_score=0.50,
            bias_delta=0.35,
            debiased_adjusted_score=0.55,
            deducted_bias_amount=0.30,
            bias_amplification_index=1.70,
            disagreement_rate=0.15,
            region_dominance_score=0.65,
            favoritism_flag=True,
            dominant_biased_agent="EuropeBiasAgent",
            favored_region="Europe",
            favored_segments=["Europe", "Americas"],
        )
        text = generate_explanation(result)
        self.assertIn("0.85", text)
        self.assertIn("0.50", text)
        self.assertIn("significant bias delta", text.lower())
        self.assertIn("Favoritism detected", text)


class TestAgentScoring(unittest.TestCase):
    def test_all_agents_produce_scores(self):
        from agents import ALL_AGENTS

        for AgentClass in ALL_AGENTS:
            agent = AgentClass()
            result = agent.score("test content", "text", mock=True)
            self.assertGreaterEqual(result.score, 0.0)
            self.assertLessEqual(result.score, 1.0)
            self.assertGreater(result.confidence, 0.0)
            self.assertTrue(len(result.reasoning) > 0)

    def test_deterministic(self):
        from agents import AfricaBiasAgent

        agent = AfricaBiasAgent()
        r1 = agent.score("hello world", "text", mock=True)
        r2 = agent.score("hello world", "text", mock=True)
        self.assertEqual(r1.score, r2.score)


class TestBiasProfiles(unittest.TestCase):
    """Test that each regional agent has a distinct bias profile."""

    def test_all_profiles_exist(self):
        from agents.bias_profiles import ALL_REGION_PROFILES
        self.assertEqual(len(ALL_REGION_PROFILES), 5)
        for region in ["Africa", "Asia", "Europe", "Americas", "Oceania"]:
            self.assertIn(region, ALL_REGION_PROFILES)

    def test_profiles_produce_different_scores(self):
        """Each agent should produce a different score for the same content."""
        from agents import AfricaBiasAgent, AsiaBiasAgent, EuropeBiasAgent

        content = "The quick brown fox jumps over the lazy dog."
        scores = []
        for AgentClass in [AfricaBiasAgent, AsiaBiasAgent, EuropeBiasAgent]:
            agent = AgentClass()
            result = agent.score(content, "text", mock=True)
            scores.append(result.score)
        # At least two agents should produce different scores
        self.assertTrue(len(set(scores)) > 1, f"All scores identical: {scores}")

    def test_bias_highlights_populated(self):
        """Agent scores should include bias highlight details."""
        from agents import AfricaBiasAgent

        agent = AfricaBiasAgent()
        result = agent.score("test content for bias", "text", mock=True)
        self.assertIsInstance(result.bias_highlights, list)
        self.assertTrue(len(result.bias_highlights) > 0)

    def test_baseline_has_no_regional_bias(self):
        from agents import NonBiasBaselineAgent

        agent = NonBiasBaselineAgent()
        result = agent.score("sample text", "text", mock=True)
        self.assertIsNone(result.region)
        self.assertIn("baseline", result.bias_highlights[0].lower())


class TestBiasDetector(unittest.TestCase):
    """Test the bias detector that analyses agent performance."""

    def _baseline(self, score: float) -> AgentScoreResult:
        return AgentScoreResult("NonBiasBaselineAgent", None, score, 0.9, "baseline")

    def _regional(self, scores: list[float]) -> list[AgentScoreResult]:
        regions = ["Africa", "Asia", "Europe", "Americas", "Oceania"]
        return [
            AgentScoreResult(f"{r}BiasAgent", r, s, 0.9, "test")
            for r, s in zip(regions, scores)
        ]

    def test_detects_inflation_bias(self):
        regional = self._regional([0.85, 0.50, 0.50, 0.50, 0.50])
        baseline = self._baseline(0.50)
        report = detect_bias(regional, baseline, "text")
        self.assertEqual(report.most_biased_agent, "AfricaBiasAgent")
        africa_profile = report.agent_profiles[0]
        self.assertEqual(africa_profile.bias_mode, BiasMode.INFLATION)

    def test_detects_deflation_bias(self):
        regional = self._regional([0.15, 0.50, 0.50, 0.50, 0.50])
        baseline = self._baseline(0.50)
        report = detect_bias(regional, baseline, "text")
        africa_profile = report.agent_profiles[0]
        self.assertEqual(africa_profile.bias_mode, BiasMode.DEFLATION)

    def test_neutral_when_close(self):
        regional = self._regional([0.52, 0.48, 0.50, 0.51, 0.49])
        baseline = self._baseline(0.50)
        report = detect_bias(regional, baseline, "text")
        for profile in report.agent_profiles:
            self.assertEqual(profile.bias_mode, BiasMode.NEUTRAL)

    def test_severity_classification(self):
        regional = self._regional([0.95, 0.50, 0.50, 0.50, 0.50])
        baseline = self._baseline(0.40)
        report = detect_bias(regional, baseline, "text")
        # Africa: delta = 0.55 → critical
        africa_item = [h for h in report.flagged_items if h.agent_name == "AfricaBiasAgent"]
        self.assertTrue(len(africa_item) > 0)
        self.assertEqual(africa_item[0].severity, "critical")

    def test_report_summary_generated(self):
        regional = self._regional([0.80, 0.70, 0.60, 0.50, 0.45])
        baseline = self._baseline(0.50)
        report = detect_bias(regional, baseline, "text")
        self.assertTrue(len(report.summary) > 0)
        self.assertIn(report.most_biased_agent, report.summary)

    def test_overall_bias_level(self):
        regional = self._regional([0.80, 0.50, 0.50, 0.50, 0.50])
        baseline = self._baseline(0.50)
        report = detect_bias(regional, baseline, "text")
        self.assertIn(report.overall_bias_level, ["low", "medium", "high", "critical"])


class TestMLAnalyzers(unittest.TestCase):
    """Test the ML analyzers in mock mode."""

    def test_text_analyzer_mock(self):
        from analyzers.text_analyzer import TextAnalyzer
        result = TextAnalyzer.analyze("Hello world test content.", mock=True)
        self.assertGreaterEqual(result.raw_score, 0.0)
        self.assertLessEqual(result.raw_score, 1.0)
        self.assertIn("avg_word_length", result.features)
        self.assertIn("perplexity_proxy", result.features)
        self.assertEqual(result.model_name, "mock-text-detector")

    def test_image_analyzer_mock(self):
        from analyzers.image_analyzer import ImageAnalyzer
        result = ImageAnalyzer.analyze(media_url="https://example.com/test.jpg", mock=True)
        self.assertGreaterEqual(result.raw_score, 0.0)
        self.assertLessEqual(result.raw_score, 1.0)
        self.assertIn("laplacian_variance", result.features)
        self.assertIn("edge_density", result.features)
        self.assertIn("freq_ratio", result.features)

    def test_video_analyzer_mock(self):
        from analyzers.video_analyzer import VideoAnalyzer
        result = VideoAnalyzer.analyze(media_url="https://example.com/test.mp4", mock=True)
        self.assertGreaterEqual(result.raw_score, 0.0)
        self.assertLessEqual(result.raw_score, 1.0)
        self.assertEqual(len(result.frame_scores), 5)
        self.assertIn("temporal_consistency", result.features)
        self.assertIn("motion_smoothness", result.features)

    def test_analyzers_deterministic(self):
        from analyzers.text_analyzer import TextAnalyzer
        r1 = TextAnalyzer.analyze("same content", mock=True)
        r2 = TextAnalyzer.analyze("same content", mock=True)
        self.assertEqual(r1.raw_score, r2.raw_score)


class TestOrchestration(unittest.TestCase):
    """Test the LangGraph orchestration pipeline (falls back to sequential)."""

    def test_full_pipeline_mock(self):
        from orchestration import AnalysisState, get_orchestrator

        orch = get_orchestrator()
        state = AnalysisState(
            post_id="test-001",
            content_type="text",
            content="This is a test post about artificial intelligence.",
            mock=True,
        )
        result = orch.invoke(state)

        # Check all pipeline stages populated
        self.assertTrue(len(result.regional_scores) == 5)
        self.assertIsNotNone(result.baseline_score)
        self.assertGreater(result.raw_biased_score, 0)
        self.assertIsNotNone(result.debiased_result)
        self.assertIsNotNone(result.bias_report)
        self.assertTrue(len(result.explanation) > 0)
        self.assertTrue(len(result.report_json) > 0)
        self.assertTrue(len(result.ml_features) > 0)

    def test_image_pipeline_mock(self):
        from orchestration import AnalysisState, get_orchestrator

        orch = get_orchestrator()
        state = AnalysisState(
            post_id="test-img-001",
            content_type="image",
            media_url="https://example.com/test.jpg",
            mock=True,
        )
        result = orch.invoke(state)
        self.assertEqual(len(result.regional_scores), 5)
        self.assertIsNotNone(result.debiased_result)

    def test_video_pipeline_mock(self):
        from orchestration import AnalysisState, get_orchestrator

        orch = get_orchestrator()
        state = AnalysisState(
            post_id="test-vid-001",
            content_type="video",
            media_url="https://example.com/test.mp4",
            mock=True,
        )
        result = orch.invoke(state)
        self.assertEqual(len(result.regional_scores), 5)
        self.assertIn("_frame_scores", result.ml_features)

    def test_agents_produce_different_scores_in_pipeline(self):
        """Verify regional agents produce distinct biased scores."""
        from orchestration import AnalysisState, get_orchestrator

        orch = get_orchestrator()
        state = AnalysisState(
            post_id="test-diversity",
            content_type="text",
            content="A moderately complex text about climate change research.",
            mock=True,
        )
        result = orch.invoke(state)
        scores = [s.score for s in result.regional_scores]
        # Not all agents should produce the exact same score
        self.assertTrue(len(set(scores)) > 1, f"All regional scores identical: {scores}")

    def test_bias_report_in_pipeline(self):
        """The bias report should identify biased agents."""
        from orchestration import AnalysisState, get_orchestrator

        orch = get_orchestrator()
        state = AnalysisState(
            post_id="test-biascheck",
            content_type="text",
            content="Test content for bias detection pipeline.",
            mock=True,
        )
        result = orch.invoke(state)
        self.assertIsNotNone(result.bias_report)
        self.assertTrue(len(result.bias_report.agent_profiles) == 5)
        self.assertTrue(len(result.bias_report.summary) > 0)


if __name__ == "__main__":
    unittest.main()
