"""CLI tool for ingesting documents (.md, .txt, .pdf) and testing RAG retrieval."""

import argparse
from pathlib import Path
import time
from agent.rag.store import get_rag_store


def main() -> None:
    parser = argparse.ArgumentParser(description="Knowledge Base / RAG Management CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Ingest command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest a .md, .txt, or .pdf file into the vector store")
    ingest_parser.add_argument("file_path", help="Path to document file to ingest")

    # Query command
    query_parser = subparsers.add_parser("query", help="Query the vector store and test retrieval latency")
    query_parser.add_argument("query_text", help="Question or search query")
    query_parser.add_argument("--top-k", type=int, default=3, help="Number of results to retrieve (default: 3)")

    args = parser.parse_args()
    store = get_rag_store()

    if args.command == "ingest":
        path = Path(args.file_path)
        print(f"Ingesting: {path} ...")
        count = store.ingest_file(path)
        print(f"[SUCCESS] Ingested {count} chunks from {path.name} into vector store.")

    elif args.command == "query":
        print(f"Query: '{args.query_text}'")
        t0 = time.perf_counter()
        results = store.search(args.query_text, top_k=args.top_k)
        latency_ms = (time.perf_counter() - t0) * 1000

        print(f"[RAG Latency]: {latency_ms:.2f}ms (Target: <150ms)\n" + "-" * 60)
        if not results:
            print("No matching knowledge base chunks found.")
        for i, (doc, score) in enumerate(results, start=1):
            print(f"[{i}] Score: {score:.3f} | Source: {doc['source']}")
            safe_text = doc["text"].strip().encode("ascii", errors="replace").decode("ascii")
            print(safe_text)
            print("-" * 60)


if __name__ == "__main__":
    main()
