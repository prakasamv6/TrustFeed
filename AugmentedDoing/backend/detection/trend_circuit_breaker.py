"""Fake Trend Circuit Breaker — detects and breaks artificially amplified trends.

Monitors trending topics for anomalous velocity spikes, coordinated amplification
patterns, and bot-like engagement to protect the platform from manufactured virality.
"""

from __future__ import annotations

import hashlib
import math
import statistics
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any


@dataclass
class TrendEngagement:
    """Single engagement event on a trending topic."""

    user_id: str
    post_id: str
    topic: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_ai_content: bool = False
    engagement_type: str = "post"  # post | share | like | comment


@dataclass
class TrendingTopic:
    """A trending topic with circuit breaker metadata."""

    topic: str
    post_count: int = 0
    engagement_count: int = 0
    velocity: float = 0.0              # posts per minute
    ai_content_ratio: float = 0.0      # fraction of posts that are AI-generated
    unique_authors: int = 0
    coordination_score: float = 0.0    # 0-1, higher = more coordinated (suspicious)
    trust_score: float = 100.0         # 0-100, lower = less trustworthy

    # Circuit breaker state
    circuit_broken: bool = False
    break_reason: str = ""
    break_severity: str = "none"       # none | watch | warning | critical | broken
    corrective_actions: list[str] = field(default_factory=list)

    # Timeline
    first_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    break_triggered_at: datetime | None = None


@dataclass
class TrendAlert:
    """Alert issued by the circuit breaker system."""

    topic: str
    alert_type: str       # velocity_spike | ai_flood | coordination | bot_pattern | low_diversity
    severity: str         # watch | warning | critical
    message: str
    evidence: list[str]
    recommended_action: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class TrendCircuitBreaker:
    """Monitors trending topics and breaks fake/manipulated trends.

    Detection signals:
    1. Velocity spikes — sudden unnatural growth in posts/engagement
    2. AI content flooding — topic dominated by AI-generated posts
    3. Coordination detection — burst patterns suggesting bot networks
    4. Author diversity — few unique authors driving the trend
    5. Engagement authenticity — ratio of organic vs synthetic engagement
    """

    # Thresholds
    VELOCITY_SPIKE_THRESHOLD = 10.0     # posts/min to flag as suspicious
    AI_RATIO_WARNING = 0.50             # 50% AI content → warning
    AI_RATIO_CRITICAL = 0.75            # 75% AI content → critical
    COORDINATION_THRESHOLD = 0.70       # coordination score to flag
    MIN_AUTHOR_DIVERSITY = 0.20         # unique_authors / post_count
    CIRCUIT_BREAK_TRUST_THRESHOLD = 30  # trust score below this → break

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engagements: dict[str, list[TrendEngagement]] = defaultdict(list)
        self._topics: dict[str, TrendingTopic] = {}
        self._alerts: list[TrendAlert] = []

    def record_engagement(self, engagement: TrendEngagement) -> TrendingTopic:
        """Record a new engagement event and re-evaluate the topic."""
        topic_key = engagement.topic.lower().strip()
        with self._lock:
            self._engagements[topic_key].append(engagement)
            topic = self._evaluate_topic(topic_key)
            self._topics[topic_key] = topic
            return topic

    def get_trending(self, limit: int = 20) -> list[TrendingTopic]:
        """Get current trending topics sorted by engagement, with circuit breaker status."""
        with self._lock:
            topics = sorted(
                self._topics.values(),
                key=lambda t: t.engagement_count,
                reverse=True,
            )
            return topics[:limit]

    def get_alerts(self, since_hours: int = 24) -> list[TrendAlert]:
        """Get recent circuit breaker alerts."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        with self._lock:
            return [a for a in self._alerts if a.timestamp >= cutoff]

    def manual_break(self, topic: str, reason: str) -> TrendingTopic | None:
        """Manually trigger a circuit break on a topic (admin action)."""
        topic_key = topic.lower().strip()
        with self._lock:
            t = self._topics.get(topic_key)
            if not t:
                return None
            t.circuit_broken = True
            t.break_reason = f"Manual break: {reason}"
            t.break_severity = "broken"
            t.break_triggered_at = datetime.now(timezone.utc)
            t.corrective_actions = [
                "Suppress from trending feed",
                "Add 'Under Review' label to all posts",
                "Throttle new engagement on this topic",
                "Notify moderators for human review",
            ]
            self._alerts.append(
                TrendAlert(
                    topic=topic,
                    alert_type="manual_break",
                    severity="critical",
                    message=f"Manual circuit break: {reason}",
                    evidence=["Triggered by platform moderator"],
                    recommended_action="Review all posts under this topic",
                )
            )
            return t

    def release_break(self, topic: str) -> TrendingTopic | None:
        """Release a circuit break (after human review)."""
        topic_key = topic.lower().strip()
        with self._lock:
            t = self._topics.get(topic_key)
            if not t:
                return None
            t.circuit_broken = False
            t.break_reason = ""
            t.break_severity = "none"
            t.break_triggered_at = None
            t.corrective_actions = []
            return t

    # ── Private evaluation methods ───────────────────────────────────────────

    def _evaluate_topic(self, topic_key: str) -> TrendingTopic:
        """Re-evaluate a topic across all detection signals."""
        events = self._engagements.get(topic_key, [])
        if not events:
            return TrendingTopic(topic=topic_key)

        now = datetime.now(timezone.utc)
        post_events = [e for e in events if e.engagement_type == "post"]
        unique_authors = set(e.user_id for e in events)
        ai_posts = [e for e in post_events if e.is_ai_content]

        # Basic counts
        post_count = len(post_events)
        engagement_count = len(events)
        ai_ratio = len(ai_posts) / max(1, post_count)
        author_diversity = len(unique_authors) / max(1, post_count)

        # Velocity: posts in last 5 minutes
        five_min_ago = now - timedelta(minutes=5)
        recent_posts = [e for e in post_events if e.timestamp >= five_min_ago]
        velocity = len(recent_posts) / 5.0  # posts per minute

        # Coordination score: burst detection
        coordination = self._compute_coordination(events)

        # Trust score calculation
        trust = 100.0
        alerts: list[TrendAlert] = []
        corrective_actions: list[str] = []
        severity = "none"

        # ── Signal 1: Velocity spike ──
        if velocity > self.VELOCITY_SPIKE_THRESHOLD:
            penalty = min(30, (velocity - self.VELOCITY_SPIKE_THRESHOLD) * 3)
            trust -= penalty
            severity = self._escalate(severity, "warning" if velocity < 20 else "critical")
            alerts.append(
                TrendAlert(
                    topic=topic_key,
                    alert_type="velocity_spike",
                    severity="critical" if velocity >= 20 else "warning",
                    message=f"Trend velocity spike: {velocity:.1f} posts/min (threshold: {self.VELOCITY_SPIKE_THRESHOLD})",
                    evidence=[
                        f"{len(recent_posts)} posts in last 5 minutes",
                        f"Normal baseline: <{self.VELOCITY_SPIKE_THRESHOLD} posts/min",
                    ],
                    recommended_action="Throttle new posts on this topic; flag for review",
                )
            )
            corrective_actions.append("Throttle algorithmic amplification of this topic")

        # ── Signal 2: AI content flooding ──
        if ai_ratio >= self.AI_RATIO_CRITICAL:
            trust -= 25
            severity = self._escalate(severity, "critical")
            alerts.append(
                TrendAlert(
                    topic=topic_key,
                    alert_type="ai_flood",
                    severity="critical",
                    message=f"AI content flood: {ai_ratio:.0%} of posts are AI-generated",
                    evidence=[
                        f"{len(ai_posts)} of {post_count} posts flagged as AI",
                        "Trend may be artificially manufactured by AI content",
                    ],
                    recommended_action="Apply 'AI-Driven Trend' label; suppress from organic trending",
                )
            )
            corrective_actions.append("Label as 'AI-Driven Trend' in feed")
            corrective_actions.append("Demote from organic trending algorithms")
        elif ai_ratio >= self.AI_RATIO_WARNING:
            trust -= 15
            severity = self._escalate(severity, "warning")
            alerts.append(
                TrendAlert(
                    topic=topic_key,
                    alert_type="ai_flood",
                    severity="warning",
                    message=f"High AI content ratio: {ai_ratio:.0%}",
                    evidence=[f"{len(ai_posts)} of {post_count} posts flagged as AI"],
                    recommended_action="Monitor closely; add AI content advisory",
                )
            )
            corrective_actions.append("Display AI content ratio on topic page")

        # ── Signal 3: Coordination detection ──
        if coordination > self.COORDINATION_THRESHOLD:
            trust -= 20
            severity = self._escalate(severity, "warning")
            alerts.append(
                TrendAlert(
                    topic=topic_key,
                    alert_type="coordination",
                    severity="critical" if coordination > 0.85 else "warning",
                    message=f"Coordinated amplification detected (score: {coordination:.0%})",
                    evidence=[
                        "Burst pattern suggests organized campaign",
                        f"Coordination score: {coordination:.2f}",
                    ],
                    recommended_action="Flag for human moderation review",
                )
            )
            corrective_actions.append("Review for coordinated inauthentic behavior")

        # ── Signal 4: Low author diversity ──
        if post_count >= 5 and author_diversity < self.MIN_AUTHOR_DIVERSITY:
            trust -= 15
            severity = self._escalate(severity, "watch")
            alerts.append(
                TrendAlert(
                    topic=topic_key,
                    alert_type="low_diversity",
                    severity="warning",
                    message=f"Low author diversity: {len(unique_authors)} unique authors for {post_count} posts",
                    evidence=[
                        f"Author diversity ratio: {author_diversity:.0%}",
                        "Small number of accounts driving the trend",
                    ],
                    recommended_action="Check for duplicate/bot accounts",
                )
            )
            corrective_actions.append("Investigate accounts for bot indicators")

        # Determine circuit break
        trust = max(0, trust)
        circuit_broken = trust < self.CIRCUIT_BREAK_TRUST_THRESHOLD

        if circuit_broken:
            severity = "broken"
            corrective_actions.insert(0, "CIRCUIT BROKEN — Trend suppressed from feeds")
            corrective_actions.append("All posts under this topic labeled 'Under Review'")
            corrective_actions.append("New engagement throttled until human review")

        # Store alerts
        self._alerts.extend(alerts)

        existing = self._topics.get(topic_key)
        return TrendingTopic(
            topic=topic_key,
            post_count=post_count,
            engagement_count=engagement_count,
            velocity=round(velocity, 2),
            ai_content_ratio=round(ai_ratio, 4),
            unique_authors=len(unique_authors),
            coordination_score=round(coordination, 4),
            trust_score=round(trust, 2),
            circuit_broken=circuit_broken,
            break_reason=", ".join(a.message for a in alerts) if circuit_broken else "",
            break_severity=severity,
            corrective_actions=corrective_actions,
            first_seen=existing.first_seen if existing else now,
            last_updated=now,
            break_triggered_at=now if circuit_broken and not (existing and existing.circuit_broken) else (existing.break_triggered_at if existing else None),
        )

    def _compute_coordination(self, events: list[TrendEngagement]) -> float:
        """Detect coordinated amplification from timing patterns."""
        if len(events) < 5:
            return 0.0

        # Compute inter-event intervals
        timestamps = sorted(e.timestamp for e in events)
        intervals = [
            (timestamps[i + 1] - timestamps[i]).total_seconds()
            for i in range(len(timestamps) - 1)
        ]

        if not intervals:
            return 0.0

        # Very regular intervals suggest bot coordination
        mean_interval = statistics.mean(intervals)
        if mean_interval == 0:
            return 0.9  # Zero intervals = simultaneous posts = very suspicious

        std_interval = statistics.stdev(intervals) if len(intervals) > 1 else 0
        cv = std_interval / mean_interval if mean_interval > 0 else 0

        # Low CV = very regular timing = suspicious
        # Also check for bursts (many events in short window)
        burst_count = sum(1 for i in intervals if i < 2.0)  # <2 second intervals
        burst_ratio = burst_count / len(intervals)

        coordination = 0.0
        # Regular timing contributes
        if cv < 0.3:
            coordination += 0.5
        elif cv < 0.6:
            coordination += 0.3

        # Burst ratio contributes
        coordination += burst_ratio * 0.5

        return min(1.0, coordination)

    @staticmethod
    def _escalate(current: str, new: str) -> str:
        """Return the higher severity level."""
        order = {"none": 0, "watch": 1, "warning": 2, "critical": 3, "broken": 4}
        return new if order.get(new, 0) > order.get(current, 0) else current


# ── Convenience: seed mock trending data for demo ────────────────────────────

def seed_mock_trends(breaker: TrendCircuitBreaker) -> None:
    """Pre-populate with realistic trending data for demo purposes."""
    now = datetime.now(timezone.utc)

    # 1. Organic healthy trend
    for i in range(12):
        breaker.record_engagement(
            TrendEngagement(
                user_id=f"user_{i}",
                post_id=f"p_climate_{i}",
                topic="#ClimateAction",
                timestamp=now - timedelta(minutes=i * 8),
                is_ai_content=i in (3, 7),
                engagement_type="post",
            )
        )

    # 2. AI-flooded trend (circuit break candidate)
    for i in range(20):
        breaker.record_engagement(
            TrendEngagement(
                user_id=f"bot_{i % 3}",
                post_id=f"p_crypto_{i}",
                topic="#CryptoMoon",
                timestamp=now - timedelta(seconds=i * 15),
                is_ai_content=i < 16,  # 80% AI
                engagement_type="post",
            )
        )

    # 3. Suspicious coordinated trend
    for i in range(15):
        breaker.record_engagement(
            TrendEngagement(
                user_id=f"coord_{i % 2}",
                post_id=f"p_prod_{i}",
                topic="#BuyProductX",
                timestamp=now - timedelta(seconds=i * 2),
                is_ai_content=i < 10,
                engagement_type="post",
            )
        )

    # 4. Normal healthy trend
    for i in range(8):
        breaker.record_engagement(
            TrendEngagement(
                user_id=f"real_{i}",
                post_id=f"p_local_{i}",
                topic="#LocalNews",
                timestamp=now - timedelta(minutes=i * 20),
                is_ai_content=False,
                engagement_type="post",
            )
        )

    # 5. Mixed trend with some AI
    for i in range(10):
        breaker.record_engagement(
            TrendEngagement(
                user_id=f"mixed_{i}",
                post_id=f"p_tech_{i}",
                topic="#TechInnovation",
                timestamp=now - timedelta(minutes=i * 5),
                is_ai_content=i in (0, 2, 4, 6),
                engagement_type="post",
            )
        )
