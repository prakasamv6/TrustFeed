"""Community AI flag storage — tracks user reports of AI-generated content."""

from __future__ import annotations

import threading
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class AiContentFlag:
    """A single community flag on content."""

    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    post_id: str = ""
    user_id: str = "anonymous"
    flag_type: str = "ai"          # ai | human | disputed | misleading
    reason: str = ""
    confidence: int = 3            # 1-5 how sure the flagger is
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class FlagSummary:
    """Aggregated flag summary for a post."""

    post_id: str
    total_flags: int = 0
    ai_flags: int = 0
    human_flags: int = 0
    disputed_flags: int = 0
    misleading_flags: int = 0
    avg_confidence: float = 0.0
    recommended_label: str = "unknown"
    consensus_strength: float = 0.0   # 0-1


class FlagStore:
    """Thread-safe storage for community AI content flags."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._flags: dict[str, list[AiContentFlag]] = defaultdict(list)

    def save(self, flag: AiContentFlag) -> str:
        with self._lock:
            self._flags[flag.post_id].append(flag)
            return flag.id

    def get_by_post(self, post_id: str) -> list[AiContentFlag]:
        with self._lock:
            return list(self._flags.get(post_id, []))

    def get_summary(self, post_id: str) -> FlagSummary:
        with self._lock:
            flags = self._flags.get(post_id, [])
            if not flags:
                return FlagSummary(post_id=post_id)

            ai = sum(1 for f in flags if f.flag_type == "ai")
            human = sum(1 for f in flags if f.flag_type == "human")
            disputed = sum(1 for f in flags if f.flag_type == "disputed")
            misleading = sum(1 for f in flags if f.flag_type == "misleading")
            avg_conf = sum(f.confidence for f in flags) / len(flags)

            total = len(flags)
            if total == 0:
                label = "unknown"
                strength = 0.0
            elif ai / total > 0.7:
                label = "ai-generated"
                strength = ai / total
            elif human / total > 0.7:
                label = "human-created"
                strength = human / total
            elif disputed / total > 0.3 or misleading / total > 0.2:
                label = "disputed"
                strength = max(disputed, misleading) / total
            else:
                label = "uncertain"
                strength = max(ai, human) / total

            return FlagSummary(
                post_id=post_id,
                total_flags=total,
                ai_flags=ai,
                human_flags=human,
                disputed_flags=disputed,
                misleading_flags=misleading,
                avg_confidence=round(avg_conf, 2),
                recommended_label=label,
                consensus_strength=round(strength, 4),
            )

    def get_all_summaries(self) -> list[FlagSummary]:
        with self._lock:
            return [self.get_summary(pid) for pid in self._flags]
