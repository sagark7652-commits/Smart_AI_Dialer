"""Tests for Part B: FastAPI service layer, API key auth, rate limiting, and Agent CRUD."""

import asyncio
import time
from fastapi.testclient import TestClient
import pytest
from agent.auth import hash_key, _rate_limit_buckets
from agent.db import get_db
from agent.engine import CallingAgentEngine
from server import app

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    asyncio.run(get_db().init_db())


@pytest.fixture
def auth_headers():
    """Create a unique test API key in DB and return request headers."""
    db = get_db()
    raw_key = f"ca_live_testsecret_{int(time.time()*1000)}"
    key_hash = hash_key(raw_key)

    async def _insert_key():
        await db.init_db()
        return await db.create_api_key(
            name="test-runner",
            key_hash=key_hash,
            prefix=raw_key[:14],
            rate_limit=5,  # Low rate limit for testing
        )

    asyncio.run(_insert_key())
    _rate_limit_buckets[key_hash].clear()
    return {"x-api-key": raw_key}


def test_health_check_unauthenticated():
    """Verify health endpoint is publicly accessible."""
    from agent.resilience.circuit_breaker import get_circuit_registry
    get_circuit_registry().reset_all()
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] in ("healthy", "degraded")


def test_api_key_authentication_failure():
    """Verify missing or invalid API key returns 401."""
    # 1. Missing header
    res_missing = client.get("/calls")
    assert res_missing.status_code == 422 or res_missing.status_code == 401

    # 2. Invalid key format
    res_bad = client.get("/calls", headers={"x-api-key": "invalid-key"})
    assert res_bad.status_code == 401

    # 3. Non-existent key
    res_wrong = client.get("/calls", headers={"x-api-key": "ca_live_wrongsecret9999999999"})
    assert res_wrong.status_code == 401


def test_api_key_rate_limiting(auth_headers):
    """Verify exceeding per-minute rate limit triggers 429 Too Many Requests."""
    key = auth_headers["x-api-key"]
    digest = hash_key(key)
    _rate_limit_buckets[digest].clear()

    # Rate limit is set to 5 in fixture
    for _ in range(5):
        res = client.get("/calls", headers=auth_headers)
        assert res.status_code == 200

    # 6th request must trigger 429
    res_blocked = client.get("/calls", headers=auth_headers)
    assert res_blocked.status_code == 429
    assert "Rate limit exceeded" in res_blocked.json()["detail"]


def test_agent_crud_endpoints(auth_headers):
    """Verify agent creation, retrieval, listing, and updates."""
    key = auth_headers["x-api-key"]
    _rate_limit_buckets[hash_key(key)].clear()

    agent_id = f"test_agent_{int(time.time()*1000)}"

    # 1. Create Agent
    create_payload = {
        "id": agent_id,
        "name": "Test Receptionist",
        "role": "Receptionist",
        "system_prompt": "You are a friendly clinic receptionist.",
        "greeting": "Hello, welcome to our clinic!",
        "default_language": "en",
        "tools_enabled": ["book_appointment"],
    }
    res_create = client.post("/agents", json=create_payload, headers=auth_headers)
    assert res_create.status_code == 201
    assert res_create.json()["agent"]["id"] == agent_id

    # 2. Get Agent
    res_get = client.get(f"/agents/{agent_id}", headers=auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "Test Receptionist"

    # 3. List Agents
    res_list = client.get("/agents", headers=auth_headers)
    assert res_list.status_code == 200
    agent_ids = [a["id"] for a in res_list.json()]
    assert agent_id in agent_ids

    # 4. Update Agent
    res_put = client.put(
        f"/agents/{agent_id}",
        json={"greeting": "Updated greeting message!"},
        headers=auth_headers,
    )
    assert res_put.status_code == 200

    # Verify update persisted
    res_verify = client.get(f"/agents/{agent_id}", headers=auth_headers)
    assert res_verify.json()["greeting"] == "Updated greeting message!"


def test_call_endpoints(auth_headers):
    """Verify listing calls and retrieving call details."""
    key = auth_headers["x-api-key"]
    _rate_limit_buckets[hash_key(key)].clear()

    # Pre-populate a test call in DB
    db = get_db()
    test_call_id = f"call_test_{int(time.time()*1000)}"

    async def _insert_call():
        await db.create_call(
            call_id=test_call_id,
            caller_number="+919876543210",
            direction="outbound",
            provider="twilio",
            status="completed",
        )
        await db.add_transcript_turn(
            call_id=test_call_id,
            speaker="caller",
            text="Hello, when do you open?",
        )
        await db.add_transcript_turn(
            call_id=test_call_id,
            speaker="agent",
            text="We open at 9 AM.",
        )

    asyncio.run(_insert_call())

    # 1. Get Call by ID
    res = client.get(f"/calls/{test_call_id}", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == test_call_id
    assert data["caller_number"] == "+919876543210"
    assert len(data["transcript"]) == 2

    # 2. List Calls with filters
    res_list = client.get("/calls?status=completed&provider=twilio", headers=auth_headers)
    assert res_list.status_code == 200
    call_ids = [c["id"] for c in res_list.json()]
    assert test_call_id in call_ids


def test_calling_agent_engine_import():
    """Verify CallingAgentEngine is directly importable from the agent package."""
    from agent import CallingAgentEngine
    eng = CallingAgentEngine()
    assert eng is not None
    assert eng.prompt_manager.config["name"] == "Priya"
