"""Image analyzer using OpenCV + Hugging Face Vision Transformers + PyTorch.

Extracts visual features with OpenCV (noise analysis, ELA-like metrics,
frequency-domain statistics) then runs a HF image-classification model
for AI-generated image detection.  Each regional agent receives the
raw features and applies its region-specific bias profile.
"""

from __future__ import annotations

import hashlib
import struct
from dataclasses import dataclass, field
from pathlib import Path

_vision_pipeline = None  # lazy-loaded


@dataclass
class ImageAnalysisResult:
    raw_score: float               # model confidence that image is AI-generated
    features: dict                 # OpenCV-extracted features
    model_name: str
    resolution: tuple[int, int]
    metadata: dict = field(default_factory=dict)


def _deterministic_mock(ref: str, salt: str = "") -> float:
    digest = hashlib.sha256(f"{salt}:{ref[:128]}".encode()).digest()
    val = struct.unpack(">I", digest[:4])[0]
    return (val % 10000) / 10000.0


def _load_vision_pipeline():
    global _vision_pipeline
    if _vision_pipeline is not None:
        return _vision_pipeline
    try:
        from transformers import pipeline as hf_pipeline
        _vision_pipeline = hf_pipeline(
            "image-classification",
            model="umm-maybe/AI-image-detector",
            device=-1,
        )
        return _vision_pipeline
    except Exception:
        return None


def _extract_opencv_features(img_array) -> dict:
    """Extract forensic-style features from a numpy image array using OpenCV."""
    import cv2
    import numpy as np

    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY) if len(img_array.shape) == 3 else img_array
    h, w = gray.shape[:2]

    # Noise estimation via Laplacian variance
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    # Edge density via Canny
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.count_nonzero(edges)) / (h * w)

    # Frequency-domain energy (DCT)
    float_img = np.float32(gray)
    dct = cv2.dct(float_img[:min(h, 512), :min(w, 512)])
    high_freq_energy = float(np.mean(np.abs(dct[dct.shape[0] // 2:, dct.shape[1] // 2:])))
    low_freq_energy = float(np.mean(np.abs(dct[:dct.shape[0] // 4, :dct.shape[1] // 4])))

    # Color histogram uniformity (for RGB images)
    if len(img_array.shape) == 3:
        hist_b = cv2.calcHist([img_array], [0], None, [256], [0, 256]).flatten()
        hist_g = cv2.calcHist([img_array], [1], None, [256], [0, 256]).flatten()
        hist_r = cv2.calcHist([img_array], [2], None, [256], [0, 256]).flatten()
        color_uniformity = float(np.std([np.std(hist_b), np.std(hist_g), np.std(hist_r)]))
    else:
        color_uniformity = 0.0

    # Saturation statistics (for color images)
    if len(img_array.shape) == 3:
        hsv = cv2.cvtColor(img_array, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        sat_mean = float(np.mean(sat))
        sat_std = float(np.std(sat))
    else:
        sat_mean = 0.0
        sat_std = 0.0

    # JPEG blocking artifact detection (8x8 grid correlation)
    block_artifact_score = 0.0
    if h >= 16 and w >= 16:
        row_diffs = np.abs(np.diff(gray.astype(np.float32), axis=0))
        col_diffs = np.abs(np.diff(gray.astype(np.float32), axis=1))
        grid_rows = row_diffs[7::8, :].mean() if row_diffs.shape[0] > 7 else 0
        grid_cols = col_diffs[:, 7::8].mean() if col_diffs.shape[1] > 7 else 0
        non_grid_rows = row_diffs.mean()
        block_artifact_score = float((grid_rows + grid_cols) / max(non_grid_rows * 2, 1e-6))

    return {
        "laplacian_variance": round(laplacian_var, 2),
        "edge_density": round(edge_density, 4),
        "high_freq_energy": round(high_freq_energy, 2),
        "low_freq_energy": round(low_freq_energy, 2),
        "freq_ratio": round(high_freq_energy / max(low_freq_energy, 1e-6), 4),
        "color_uniformity": round(color_uniformity, 2),
        "saturation_mean": round(sat_mean, 2),
        "saturation_std": round(sat_std, 2),
        "block_artifact_score": round(block_artifact_score, 4),
        "resolution": (w, h),
    }


class ImageAnalyzer:
    """Analyze images for AI-generation likelihood.

    Priority: mock → OpenAI GPT-4o Vision → OpenCV + HuggingFace fallback.
    """

    @staticmethod
    def analyze(
        media_url: str | None = None,
        local_path: str | None = None,
        *,
        mock: bool = True,
    ) -> ImageAnalysisResult:
        ref = media_url or local_path or "unknown"

        if mock:
            base = _deterministic_mock(ref, "image-analyzer")
            return ImageAnalysisResult(
                raw_score=round(base * 0.65 + 0.20, 4),
                features={
                    "laplacian_variance": round(200 + base * 2000, 2),
                    "edge_density": round(0.02 + base * 0.15, 4),
                    "high_freq_energy": round(5 + base * 40, 2),
                    "low_freq_energy": round(50 + base * 200, 2),
                    "freq_ratio": round(0.05 + base * 0.4, 4),
                    "color_uniformity": round(base * 500, 2),
                    "saturation_mean": round(40 + base * 120, 2),
                    "saturation_std": round(10 + base * 50, 2),
                    "block_artifact_score": round(base * 2.0, 4),
                    "resolution": (1024, 768),
                },
                model_name="mock-image-detector",
                resolution=(1024, 768),
            )

        # ── Live mode: try OpenRouter Vision first ──
        from analyzers.openai_service import analyze_image as openai_analyze_image

        openai_result = openai_analyze_image(
            image_url=media_url,
            image_path=local_path,
        )
        if openai_result is not None:
            return ImageAnalysisResult(
                raw_score=round(openai_result.ai_probability, 4),
                features={
                    "openai_confidence": openai_result.confidence,
                    "openai_reasoning": openai_result.reasoning,
                    "openai_artifacts": openai_result.detected_artifacts,
                    "style_classification": openai_result.style_classification,
                    # Provide placeholder forensic features so downstream code works
                    "laplacian_variance": 0.0,
                    "edge_density": 0.0,
                    "freq_ratio": 0.0,
                    "color_uniformity": 0.0,
                    "block_artifact_score": 0.0,
                    "resolution": (0, 0),
                },
                model_name="openrouter-gpt-4o-vision",
                resolution=(0, 0),
            )

        # ── Fallback: OpenCV + HuggingFace ──
        import cv2
        import numpy as np

        img_array = None
        resolution = (0, 0)

        # Load from URL
        if media_url:
            import httpx
            resp = httpx.get(media_url, timeout=30, follow_redirects=True)
            resp.raise_for_status()
            nparr = np.frombuffer(resp.content, np.uint8)
            img_array = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Load from local file
        elif local_path and Path(local_path).is_file():
            img_array = cv2.imread(str(local_path), cv2.IMREAD_COLOR)

        if img_array is None:
            return ImageAnalyzer.analyze(media_url, local_path, mock=True)

        h, w = img_array.shape[:2]
        resolution = (w, h)

        # OpenCV feature extraction
        cv_features = _extract_opencv_features(img_array)

        # HF vision model
        pipe = _load_vision_pipeline()
        ai_score = 0.5
        model_name = "opencv-only"

        if pipe is not None:
            try:
                from PIL import Image
                pil_img = Image.fromarray(cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB))
                results = pipe(pil_img)
                for r in results:
                    if "ai" in r["label"].lower() or "artificial" in r["label"].lower():
                        ai_score = r["score"]
                        break
                    elif "human" in r["label"].lower() or "real" in r["label"].lower():
                        ai_score = 1.0 - r["score"]
                        break
                model_name = "umm-maybe/AI-image-detector"
            except Exception:
                # Fall back to OpenCV-only heuristic
                ai_score = min(1.0, max(0.0,
                    0.3
                    + (0.2 if cv_features["laplacian_variance"] < 100 else 0.0)
                    + (0.15 if cv_features["freq_ratio"] < 0.1 else 0.0)
                    + (0.1 if cv_features["color_uniformity"] < 50 else 0.0)
                    + (0.1 if cv_features["block_artifact_score"] < 0.5 else 0.0)
                ))

        return ImageAnalysisResult(
            raw_score=round(ai_score, 4),
            features=cv_features,
            model_name=model_name,
            resolution=resolution,
        )
