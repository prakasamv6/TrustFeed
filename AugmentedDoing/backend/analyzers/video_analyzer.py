"""Video analyzer using OpenCV frame extraction + HF Vision Transformers.

Extracts key frames from video, runs per-frame analysis with OpenCV features
and HF image classification, then aggregates across frames.
"""

from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass, field

from .image_analyzer import ImageAnalyzer, _extract_opencv_features, _deterministic_mock

_FRAME_SAMPLE_COUNT = 5  # number of frames to sample from the video


@dataclass
class VideoAnalysisResult:
    raw_score: float                   # aggregated AI-generation score
    frame_scores: list[float]          # per-frame AI scores
    features: dict                     # aggregated OpenCV features
    model_name: str
    frame_count: int
    duration_sec: float
    resolution: tuple[int, int]
    metadata: dict = field(default_factory=dict)


class VideoAnalyzer:
    """Analyze video for AI-generation likelihood using OpenCV + HF per-frame."""

    @staticmethod
    def analyze(
        media_url: str | None = None,
        local_path: str | None = None,
        *,
        mock: bool = True,
    ) -> VideoAnalysisResult:
        ref = media_url or local_path or "unknown"

        if mock:
            base = _deterministic_mock(ref, "video-analyzer")
            frame_scores = [
                round(min(1.0, max(0.0, base * 0.6 + 0.2 + (i * 0.04))), 4)
                for i in range(_FRAME_SAMPLE_COUNT)
            ]
            avg_score = round(sum(frame_scores) / len(frame_scores), 4)
            return VideoAnalysisResult(
                raw_score=avg_score,
                frame_scores=frame_scores,
                features={
                    "temporal_consistency": round(0.7 + base * 0.25, 3),
                    "avg_laplacian_variance": round(300 + base * 1500, 2),
                    "motion_smoothness": round(0.5 + base * 0.4, 3),
                    "scene_change_rate": round(base * 0.1, 4),
                    "avg_edge_density": round(0.04 + base * 0.10, 4),
                    "frame_similarity_std": round(base * 0.15, 4),
                    "avg_freq_ratio": round(0.08 + base * 0.3, 4),
                },
                model_name="mock-video-detector",
                frame_count=150,
                duration_sec=5.0,
                resolution=(1920, 1080),
            )

        # ── Live mode: extract frames with OpenCV ──
        import cv2
        import numpy as np
        from pathlib import Path

        cap = None

        if local_path and Path(local_path).is_file():
            cap = cv2.VideoCapture(str(local_path))
        elif media_url:
            cap = cv2.VideoCapture(media_url)

        if cap is None or not cap.isOpened():
            return VideoAnalyzer.analyze(media_url, local_path, mock=True)

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        duration = total_frames / fps if fps > 0 else 0.0
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        resolution = (w, h)

        # Sample evenly spaced frames
        sample_indices = [
            int(i * total_frames / _FRAME_SAMPLE_COUNT)
            for i in range(_FRAME_SAMPLE_COUNT)
        ] if total_frames > _FRAME_SAMPLE_COUNT else list(range(total_frames))

        frame_scores: list[float] = []
        all_features: list[dict] = []
        prev_gray = None
        motion_diffs: list[float] = []

        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                continue

            # OpenCV features for this frame
            feat = _extract_opencv_features(frame)
            all_features.append(feat)

            # Temporal consistency: compare with previous frame
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                diff = np.mean(np.abs(gray.astype(float) - prev_gray.astype(float)))
                motion_diffs.append(float(diff))
            prev_gray = gray

            # Per-frame AI score using HF (via ImageAnalyzer internals)
            from .image_analyzer import _load_vision_pipeline
            pipe = _load_vision_pipeline()
            if pipe is not None:
                try:
                    from PIL import Image
                    pil_img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    results = pipe(pil_img)
                    ai_score = 0.5
                    for r in results:
                        if "ai" in r["label"].lower() or "artificial" in r["label"].lower():
                            ai_score = r["score"]
                            break
                        elif "human" in r["label"].lower() or "real" in r["label"].lower():
                            ai_score = 1.0 - r["score"]
                            break
                    frame_scores.append(round(ai_score, 4))
                except Exception:
                    frame_scores.append(0.5)
            else:
                # Heuristic from OpenCV features
                fs = min(1.0, max(0.0,
                    0.3
                    + (0.2 if feat["laplacian_variance"] < 100 else 0.0)
                    + (0.15 if feat["freq_ratio"] < 0.1 else 0.0)
                ))
                frame_scores.append(round(fs, 4))

        cap.release()

        # Aggregate
        avg_score = round(sum(frame_scores) / max(len(frame_scores), 1), 4)

        agg_features = {}
        if all_features:
            agg_features["avg_laplacian_variance"] = round(
                sum(f["laplacian_variance"] for f in all_features) / len(all_features), 2
            )
            agg_features["avg_edge_density"] = round(
                sum(f["edge_density"] for f in all_features) / len(all_features), 4
            )
            agg_features["avg_freq_ratio"] = round(
                sum(f["freq_ratio"] for f in all_features) / len(all_features), 4
            )
            # Frame-to-frame similarity std
            if len(frame_scores) > 1:
                import statistics
                agg_features["frame_similarity_std"] = round(statistics.stdev(frame_scores), 4)
            else:
                agg_features["frame_similarity_std"] = 0.0

        if motion_diffs:
            agg_features["motion_smoothness"] = round(1.0 - min(1.0, np.std(motion_diffs) / 50), 3)
            agg_features["temporal_consistency"] = round(
                1.0 - min(1.0, np.mean(motion_diffs) / 30), 3
            )
        else:
            agg_features["motion_smoothness"] = 0.5
            agg_features["temporal_consistency"] = 0.5

        agg_features["scene_change_rate"] = round(
            sum(1 for d in motion_diffs if d > 25) / max(len(motion_diffs), 1), 4
        )

        return VideoAnalysisResult(
            raw_score=avg_score,
            frame_scores=frame_scores,
            features=agg_features,
            model_name="opencv+hf-frame-analysis",
            frame_count=total_frames,
            duration_sec=round(duration, 2),
            resolution=resolution,
        )
