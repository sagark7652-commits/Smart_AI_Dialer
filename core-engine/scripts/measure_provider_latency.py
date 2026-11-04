"""Measure real network connect and round-trip ping latency from host to provider endpoints."""

import asyncio
from pathlib import Path
import ssl
import sys
import time
from typing import Dict, List
import urllib.parse
import httpx

ENDPOINTS = [
    ("Groq Cloud (LLM)", "https://api.groq.com/openai/v1/models"),
    ("Deepgram (STT)", "https://api.deepgram.com/v1/listen"),
    ("Cartesia (TTS)", "https://api.cartesia.ai/voices"),
    ("Sarvam AI (STT/TTS)", "https://api.sarvam.ai/v1/status"),
]


async def measure_endpoint_ping(name: str, url: str, num_pings: int = 3) -> dict:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)

    # 1. TCP / TLS Handshake ping
    handshake_times: List[float] = []
    for _ in range(num_pings):
        t0 = time.perf_counter()
        try:
            ssl_ctx = ssl.create_default_context() if parsed.scheme == "https" else None
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port, ssl=ssl_ctx),
                timeout=5.0,
            )
            writer.close()
            await writer.wait_closed()
            handshake_times.append((time.perf_counter() - t0) * 1000)
        except Exception as e:
            handshake_times.append(-1.0)
        await asyncio.sleep(0.1)

    valid_handshakes = [t for t in handshake_times if t > 0]
    avg_tcp_tls_ms = sum(valid_handshakes) / len(valid_handshakes) if valid_handshakes else 0.0

    # 2. HTTP Round-Trip Time
    http_times: List[float] = []
    async with httpx.AsyncClient(timeout=6.0) as client:
        for _ in range(num_pings):
            t0 = time.perf_counter()
            try:
                res = await client.head(url)
                http_times.append((time.perf_counter() - t0) * 1000)
            except Exception:
                try:
                    res = await client.get(url)
                    http_times.append((time.perf_counter() - t0) * 1000)
                except Exception:
                    http_times.append(-1.0)
            await asyncio.sleep(0.1)

    valid_http = [t for t in http_times if t > 0]
    avg_http_ms = sum(valid_http) / len(valid_http) if valid_http else 0.0

    return {
        "provider": name,
        "host": host,
        "tcp_tls_handshake_ms": round(avg_tcp_tls_ms, 1) if avg_tcp_tls_ms else "UNREACHABLE",
        "http_rtt_ms": round(avg_http_ms, 1) if avg_http_ms else "UNREACHABLE",
    }


async def run_diagnostics():
    print("\n" + "=" * 70)
    print("      REAL HOST-TO-PROVIDER NETWORK LATENCY DIAGNOSTIC (MEASURED)      ")
    print("=" * 70)

    results = []
    for name, url in ENDPOINTS:
        print(f"[*] Measuring latency to {name} ({url})...")
        res = await measure_endpoint_ping(name, url)
        results.append(res)
        print(f"    -> TCP/TLS Handshake: {res['tcp_tls_handshake_ms']} ms | HTTP RTT: {res['http_rtt_ms']} ms")

    log_path = Path("recordings/network_ping_report.json")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    import json
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 70)
    print(f"DIAGNOSTIC COMPLETE: Log saved to '{log_path.resolve()}'.")
    print("=" * 70 + "\n")
    return results


if __name__ == "__main__":
    asyncio.run(run_diagnostics())
