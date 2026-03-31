"""Image content pipeline — OpenCV + HF Vision Transformers feature extraction."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PreparedImage:
    ref: str
    features: dict = field(default_factory=dict)


class ImagePipeline:
    """Pre-process image content using OpenCV and HF vision models.

    In mock mode the agents operate on a hash of the URL/path.
    In live mode OpenCV extracts forensic features (Laplacian, edges,
    frequency-domain, colour, JPEG artifacts) and HF runs AI-image detection.
    """

    @staticmethod
    def prepare(media_url: str | None = None, local_path: str | None = None) -> str:
        """Return a canonical string representation for the agents to hash."""
        ref = media_url or local_path or "unknown-image"
        return f"image:{ref}"

    @staticmethod
    def prepare_with_features(
        media_url: str | None = None,
        local_path: str | None = None,
        *,
        mock: bool = True,
    ) -> PreparedImage:
        """Prepare image and extract OpenCV + HF features."""
        ref = media_url or local_path or "unknown-image"
        try:
            from analyzers.image_analyzer import ImageAnalyzer
            result = ImageAnalyzer.analyze(media_url, local_path, mock=mock)
            return PreparedImage(
                ref=f"image:{ref}",
                features={
                    **result.features,
                    "_raw_ml_score": result.raw_score,
                    "_model": result.model_name,
                    "_resolution": result.resolution,
                },
            )
        except Exception:
            return PreparedImage(ref=f"image:{ref}", features={})
