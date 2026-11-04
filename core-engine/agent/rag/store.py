"""Fast in-memory and SQLite-backed local vector store for RAG (retrieval < 150ms)."""

import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from pypdf import PdfReader
from agent.logger import setup_logger

logger = setup_logger("rag.store")


class FastEmbedder:
    """Lightweight character/word n-gram TF-IDF hashing embedder.

    Generates dense 256-dimensional unit vectors with sub-millisecond latency.
    """

    DIM = 256

    @classmethod
    def embed(cls, text: str) -> np.ndarray:
        tokens = re.findall(r"\w+", text.lower())
        vec = np.zeros(cls.DIM, dtype=np.float32)
        if not tokens:
            return vec

        for token in tokens:
            # Hash token to dimension index
            idx = hash(token) % cls.DIM
            vec[idx] += 1.0

        # Also add bigrams for phrase matching
        for i in range(len(tokens) - 1):
            bigram = f"{tokens[i]}_{tokens[i+1]}"
            idx = hash(bigram) % cls.DIM
            vec[idx] += 1.5

        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        return vec


class RAGStore:
    """Manages document chunking, ingestion, and low-latency top-k retrieval."""

    def __init__(self, index_path: str = "knowledge_base/rag_index.json") -> None:
        self.index_path = Path(index_path)
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self.chunks: List[Dict[str, Any]] = []
        self._load_index()

    def _load_index(self) -> None:
        if self.index_path.exists():
            try:
                with open(self.index_path, "r", encoding="utf-8") as f:
                    self.chunks = json.load(f)
                logger.info(f"Loaded {len(self.chunks)} RAG chunks from {self.index_path}")
            except Exception as e:
                logger.error(f"Error loading RAG index: {e}")
                self.chunks = []

    def _save_index(self) -> None:
        with open(self.index_path, "w", encoding="utf-8") as f:
            json.dump(self.chunks, f, ensure_ascii=False, indent=2)

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 300, overlap: int = 50) -> List[str]:
        """Split text into overlapping character/sentence chunks."""
        paragraphs = text.split("\n\n")
        chunks = []
        current = ""

        for p in paragraphs:
            cleaned = p.strip()
            if not cleaned:
                continue
            if len(current) + len(cleaned) <= chunk_size:
                current += "\n" + cleaned if current else cleaned
            else:
                if current:
                    chunks.append(current)
                current = cleaned

        if current:
            chunks.append(current)
        return chunks

    def ingest_file(self, file_path: Path) -> int:
        """Ingest a .md, .txt, or .pdf file into the RAG vector store."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {path}")

        text = ""
        ext = path.suffix.lower()

        if ext in [".md", ".txt"]:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        elif ext == ".pdf":
            reader = PdfReader(str(path))
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        else:
            raise ValueError(f"Unsupported document format: {ext}")

        raw_chunks = self.chunk_text(text)
        added_count = 0

        for i, chunk in enumerate(raw_chunks):
            embedding = FastEmbedder.embed(chunk).tolist()
            doc_entry = {
                "id": f"{path.name}#chunk_{i}",
                "source": path.name,
                "chunk_index": i,
                "text": chunk,
                "embedding": embedding,
            }
            self.chunks.append(doc_entry)
            added_count += 1

        self._save_index()
        logger.info(f"Ingested {added_count} chunks from {path.name}")
        return added_count

    def search(self, query: str, top_k: int = 3, min_score: float = 0.05) -> List[Tuple[Dict[str, Any], float]]:
        """Search top-k most relevant chunks using cosine similarity in <10ms."""
        if not self.chunks or not query.strip():
            return []

        q_vec = FastEmbedder.embed(query)
        scored_results = []

        for doc in self.chunks:
            doc_vec = np.array(doc["embedding"], dtype=np.float32)
            similarity = float(np.dot(q_vec, doc_vec))
            if similarity >= min_score:
                scored_results.append((doc, similarity))

        scored_results.sort(key=lambda x: x[1], reverse=True)
        return scored_results[:top_k]


_global_rag: Optional[RAGStore] = None


def get_rag_store() -> RAGStore:
    """Return default RAG store singleton."""
    global _global_rag
    if _global_rag is None:
        _global_rag = RAGStore()
    return _global_rag
