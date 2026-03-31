"""Video content pipeline — OpenCV frame extraction + HF per-frame analysis."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PreparedVideo:
    ref: str
    features: dict = field(default_factory=dict)


class VideoPipeline:
    """Pre-process video content using OpenCV frame extraction and HF.

    In mock mode the agents operate on a hash of the URL/path.
    In live mode OpenCV extracts key frames, runs per-frame feature
    extraction and HF image classification, then aggregates.
    """

    @staticmethod
    def prepare(media_url: str | None = None, local_path: str | None = None) -> str:
        """Return a canonical string representation for the agents to hash."""
        ref = media_url or local_path or "unknown-video"
        return f"video:{ref}"

    @staticmethod
    def prepare_with_features(
        media_url: str | None = None,
        local_path: str | None = None,
        *,
        mock: bool = True,
    ) -> PreparedVideo:
        """Prepare video and extract aggregated frame features."""
        ref = media_url or local_path or "unknown-video"
        try:
            from analyzers.video_analyzer import VideoAnalyzer
            result = VideoAnalyzer.analyze(media_url, local_path, mock=mock)
            return PreparedVideo(
                ref=f"video:{ref}",
                features={
                    **result.features,
                    "_raw_ml_score": result.raw_score,
                    "_model": result.model_name,
                    "_frame_scores": result.frame_scores,
                    "_frame_count": result.frame_count,
                    "_duration_sec": result.duration_sec,
                    "_resolution": result.resolution,
                },
            )
        except Exception:
            return PreparedVideo(ref=f"video:{ref}", features={})
