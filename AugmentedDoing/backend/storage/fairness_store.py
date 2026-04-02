"""In-memory storage for fairness survey responses."""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class FairnessSurveyResponse:
    """A single user's fairness assessment of an analysis result."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    post_id: str = ""
    # Likert-scale ratings (1–5)
    original_fairness: int = 3
    nonbiased_fairness: int = 3
    explanation_clarity: int = 3
    trust_impact: int = 3
    perceived_bias_severity: int = 3
    # Free-text
    comment: str = ""
    # Metadata
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class FairnessTrendPoint:
    """Aggregated fairness metrics for a single day."""

    date: str
    avg_original_fairness: float
    avg_nonbiased_fairness: float
    avg_explanation_clarity: float
    avg_trust_impact: float
    avg_perceived_bias: float
    response_count: int


class FairnessStore:
    """Thread-safe in-memory store for fairness survey responses."""

    def __init__(self) -> None:
        self._store: dict[str, FairnessSurveyResponse] = {}
        self._by_post: dict[str, list[str]] = {}
        self._lock = threading.Lock()

    def save(self, response: FairnessSurveyResponse) -> str:
        with self._lock:
            self._store[response.id] = response
            self._by_post.setdefault(response.post_id, []).append(response.id)
            return response.id

    def get_by_post(self, post_id: str) -> list[FairnessSurveyResponse]:
        with self._lock:
            ids = self._by_post.get(post_id, [])
            return [self._store[rid] for rid in ids if rid in self._store]

    def get_all(self) -> list[FairnessSurveyResponse]:
        with self._lock:
            return list(self._store.values())

    def get_trends(self, days: int = 7) -> list[FairnessTrendPoint]:
        """Aggregate survey responses by day for the last N days."""
        with self._lock:
            from collections import defaultdict

            by_day: dict[str, list[FairnessSurveyResponse]] = defaultdict(list)
            for r in self._store.values():
                day_key = r.created_at.strftime("%Y-%m-%d")
                by_day[day_key].append(r)

            sorted_days = sorted(by_day.keys(), reverse=True)[:days]
            results = []
            for day in sorted(sorted_days):
                items = by_day[day]
                n = len(items)
                if n == 0:
                    continue
                results.append(FairnessTrendPoint(
                    date=day,
                    avg_original_fairness=round(sum(r.original_fairness for r in items) / n, 2),
                    avg_nonbiased_fairness=round(sum(r.nonbiased_fairness for r in items) / n, 2),
                    avg_explanation_clarity=round(sum(r.explanation_clarity for r in items) / n, 2),
                    avg_trust_impact=round(sum(r.trust_impact for r in items) / n, 2),
                    avg_perceived_bias=round(sum(r.perceived_bias_severity for r in items) / n, 2),
                    response_count=n,
                ))
            return results

    def count(self) -> int:
        with self._lock:
            return len(self._store)
