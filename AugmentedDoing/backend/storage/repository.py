"""In-memory storage for analysis results and reports."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone

from agents.base_agent import AgentScoreResult
from scoring.bias_deduction import DebiasedResult


@dataclass
class StoredAnalysis:
    post_id: str
    content_type: str
    agent_scores: list[AgentScoreResult]
    debiased: DebiasedResult
    explanation: str
    report_json: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AnalysisRepository:
    """Thread-safe in-memory store for analysis results."""

    def __init__(self) -> None:
        self._store: dict[str, StoredAnalysis] = {}
        self._lock = threading.Lock()

    def save(self, analysis: StoredAnalysis) -> None:
        with self._lock:
            self._store[analysis.post_id] = analysis

    def get(self, post_id: str) -> StoredAnalysis | None:
        with self._lock:
            return self._store.get(post_id)

    def get_all(self) -> list[StoredAnalysis]:
        with self._lock:
            return list(self._store.values())

    def count(self) -> int:
        with self._lock:
            return len(self._store)
