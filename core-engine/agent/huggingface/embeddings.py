"""Hugging Face Semantic Embeddings for RAG Knowledge Retrieval.

Generates dense 384-dimensional or 768-dimensional semantic embeddings using:
- sentence-transformers/all-MiniLM-L6-v2
- BAAI/bge-small-en-v1.5
Enables semantic search over clinic FAQs, services, and policies with cosine similarity.
"""

from typing import List, Optional
import httpx
import numpy as np
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("huggingface.embeddings")

DEFAULT_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models"


class HuggingFaceEmbedder:
    """Generates dense semantic vectors for queries and clinic documents."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key or getattr(settings, "huggingface_api_key", None)
        self.model = model or DEFAULT_EMBEDDING_MODEL

    async def embed_texts(self, texts: List[str]) -> List[np.ndarray]:
        """Embed a list of strings into normalized float32 numpy vectors."""
        if not texts:
            return []

        if not self.api_key:
            # Fallback zero-vector if no HF key configured
            return [np.zeros(384, dtype=np.float32) for _ in texts]

        url = f"{HF_INFERENCE_URL}/{self.model}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json={"inputs": texts})
                if res.status_code == 200:
                    raw_vecs = res.json()
                    # HF returns list of lists of floats
                    output_vectors = []
                    for vec in raw_vecs:
                        arr = np.array(vec, dtype=np.float32)
                        norm = np.linalg.norm(arr)
                        if norm > 0:
                            arr = arr / norm
                        output_vectors.append(arr)
                    return output_vectors
                else:
                    logger.warning(
                        f"HF Embedding failed with HTTP {res.status_code}: {res.text[:150]}"
                    )
        except Exception as e:
            logger.error(f"HF Embedding call failed: {e}")

        return [np.zeros(384, dtype=np.float32) for _ in texts]

    async def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query."""
        vecs = await self.embed_texts([query])
        return vecs[0] if vecs else np.zeros(384, dtype=np.float32)
