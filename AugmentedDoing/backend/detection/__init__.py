"""Detection module — AI content detection, fake trend circuit breaking, and corrective actions."""

from .ai_content_detector import AiContentDetector, AiDetectionResult
from .trend_circuit_breaker import TrendCircuitBreaker, TrendingTopic, TrendAlert, TrendEngagement
from .corrective_engine import CorrectiveEngine, CorrectiveAction

__all__ = [
    "AiContentDetector",
    "AiDetectionResult",
    "TrendCircuitBreaker",
    "TrendingTopic",
    "TrendAlert",
    "TrendEngagement",
    "CorrectiveEngine",
    "CorrectiveAction",
]
