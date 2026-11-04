"""Sentence chunker for streaming LLM text into spoken audio units."""

import re
from typing import AsyncIterator, List


class SentenceChunker:
    """Buffers streaming token streams and yields complete sentences or early clauses.

    Supports Latin and Devanagari sentence terminators (., !, ?, ।, ॥, \n).
    """

    # Primary sentence terminators (ignoring decimal points inside numbers like 1.5, 9.0)
    SENTENCE_END_REGEX = re.compile(r"([!?।॥\n]+|(?<!\d)\.(?!\d))")
    # Common Indic and English abbreviations to prevent premature, choppy splitting
    ABBREVIATIONS = {"dr", "mr", "mrs", "ms", "prof", "vs", "am", "pm", "rs", "no", "डॉ", "श्री", "सौ", "प्रा", "कु"}

    def __init__(self, min_clause_length: int = 35) -> None:
        self.buffer = ""
        self.min_clause_length = min_clause_length
        self._is_first_chunk = True

    def add_token(self, token: str) -> List[str]:
        """Add a token to the buffer and return any completed sentences."""
        self.buffer += token
        return self._extract_sentences()

    def flush(self) -> List[str]:
        """Flush and return any remaining text in the buffer."""
        remaining = self.buffer.strip()
        self.buffer = ""
        self._is_first_chunk = True
        if remaining:
            return [remaining]
        return []

    def _extract_sentences(self) -> List[str]:
        completed: List[str] = []

        while True:
            match = self.SENTENCE_END_REGEX.search(self.buffer)
            if match:
                end_pos = match.end()
                potential_sentence = self.buffer[:end_pos].strip()

                # Check if potential ends with an abbreviation
                last_word_match = re.search(r"([^\s.!?।॥]+)[.!?।॥]+$", potential_sentence)
                if last_word_match:
                    word = last_word_match.group(1).lower().strip(".")
                    if word in self.ABBREVIATIONS:
                        break

                if potential_sentence:
                    completed.append(potential_sentence)
                    self._is_first_chunk = False
                self.buffer = self.buffer[end_pos:]
                continue

            # Low-latency early clause split: for first chunk, split on comma/colon/dash after 18 chars
            threshold = 18 if self._is_first_chunk else self.min_clause_length
            if len(self.buffer) > threshold:
                clause_match = re.search(r"([,;:\-—]\s+)", self.buffer)
                if clause_match:
                    end_pos = clause_match.end()
                    clause = self.buffer[:end_pos].strip()
                    if clause:
                        completed.append(clause)
                        self._is_first_chunk = False
                    self.buffer = self.buffer[end_pos:]
                    continue

            break

        return completed

    async def chunk_stream(self, token_stream: AsyncIterator[str]) -> AsyncIterator[str]:
        """Consume an async token stream and yield complete sentence chunks."""
        async for token in token_stream:
            for sentence in self.add_token(token):
                if sentence:
                    yield sentence

        for remaining in self.flush():
            if remaining:
                yield remaining
