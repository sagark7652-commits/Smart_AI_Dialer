"""Hugging Face Real-Time Caller Emotion and Sentiment Analysis.

Evaluates caller transcripts or utterances using open-source transformer models
(e.g., cardiffnlp/twitter-roberta-base-sentiment-latest or distilbert-sst-2).
Outputs calibrated sentiment labels (positive, neutral, negative) and confidence scores.
"""

from typing import Any, Dict, List, Optional
import httpx
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("huggingface.sentiment")

DEFAULT_SENTIMENT_MODEL = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"
HF_INFERENCE_URL = "https://api-inference.huggingface.co/models"


class HuggingFaceSentimentAnalyzer:
    """Classifies caller mood and detects negative escalation or positive satisfaction."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or getattr(settings, "huggingface_api_key", None)
        self.model = model or getattr(settings, "huggingface_sentiment_model", None) or DEFAULT_SENTIMENT_MODEL

    async def analyze(self, text: str) -> Dict[str, Any]:
        """Classify caller utterance sentiment.

        Returns:
            dict with {
                "sentiment": "positive" | "neutral" | "negative",
                "score": float,
                "model": str,
                "is_escalation_risk": bool
            }
        """
        if not text or not text.strip():
            return {
                "sentiment": "neutral",
                "score": 1.0,
                "model": "rule_based_empty",
                "is_escalation_risk": False,
            }

        if not self.api_key:
            # Fallback to local heuristic if key is not configured
            return self._heuristic_fallback(text)

        url = f"{HF_INFERENCE_URL}/{self.model}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, headers=headers, json={"inputs": text[:512]})
                if res.status_code == 200:
                    data = res.json()
                    # HF classification returns list of lists: [[{"label": "...", "score": 0.9}, ...]]
                    if isinstance(data, list) and data and isinstance(data[0], list):
                        top_pred = max(data[0], key=lambda x: x.get("score", 0.0))
                        raw_label = top_pred.get("label", "").lower()
                        score = float(top_pred.get("score", 0.5))

                        if "pos" in raw_label:
                            sentiment = "positive"
                        elif "neg" in raw_label:
                            sentiment = "negative"
                        else:
                            sentiment = "neutral"

                        is_escalation = sentiment == "negative" and score >= 0.75
                        return {
                            "sentiment": sentiment,
                            "score": round(score, 4),
                            "model": self.model,
                            "is_escalation_risk": is_escalation,
                        }
        except Exception as e:
            logger.warning(f"HF Sentiment API call failed: {e}. Using heuristic fallback.")

        return self._heuristic_fallback(text)

    def _heuristic_fallback(self, text: str) -> Dict[str, Any]:
        """Offline keyword heuristic for caller sentiment."""
        lower = text.lower()
        negatives = ["angry", "bad", "worst", "ghatiya", "bekaar", "gussa", "terrible", "cancel", "disappointed", "complaint"]
        positives = ["thank", "shukriya", "dhanyavaad", "great", "excellent", "good", "perfect", "badiya", "achha"]

        for neg in negatives:
            if neg in lower:
                return {
                    "sentiment": "negative",
                    "score": 0.85,
                    "model": "heuristic_fallback",
                    "is_escalation_risk": True,
                }

        for pos in positives:
            if pos in lower:
                return {
                    "sentiment": "positive",
                    "score": 0.85,
                    "model": "heuristic_fallback",
                    "is_escalation_risk": False,
                }

        return {
            "sentiment": "neutral",
            "score": 0.70,
            "model": "heuristic_fallback",
            "is_escalation_risk": False,
        }
