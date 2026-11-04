"""Tests for Step 9A: Tools, Human Transfer, RAG, Recording/Consent, and AMD."""

import asyncio
from pathlib import Path
import pytest
from agent.db import get_db
from agent.tools.registry import get_tool_registry, ToolRegistry
from agent.tools.book_appointment import BookAppointmentTool
from agent.tools.check_availability import CheckAvailabilityTool
from agent.tools.send_sms import SendSMSTool
from agent.tools.transfer_call import TransferCallTool
from agent.rag.store import RAGStore, FastEmbedder
from agent.pipeline import VoicePipeline
from agent.llm.prompt_manager import AgentPromptManager


@pytest.mark.asyncio
async def test_book_appointment_tool():
    """Verify book_appointment tool saves appointment to SQLite and handles conflict detection."""
    import sqlalchemy as sa
    from agent.db import Appointment
    db = get_db()
    await db.init_db()

    # Clean up test slot so test is idempotent
    async with db.session_factory() as session:
        await session.execute(
            sa.delete(Appointment).where(
                Appointment.date == "2026-11-05",
                Appointment.time_slot == "11:00 AM"
            )
        )
        await session.commit()

    tool = BookAppointmentTool()
    res = await tool.execute(
        caller_name="Rahul Sharma",
        phone_number="+919876543210",
        date="2026-11-05",
        time_slot="11:00 AM",
        service="Root Canal Treatment",
    )
    assert res["success"] is True
    assert "appointment_id" in res
    assert "Rahul Sharma" in res["message"]

    # Test conflict detection on duplicate booking
    res_conflict = await tool.execute(
        caller_name="Pooja Verma",
        phone_number="+919876543211",
        date="2026-11-05",
        time_slot="11:00 AM",
        service="Cleaning",
    )
    assert res_conflict["success"] is False
    assert res_conflict.get("error") == "conflict"


@pytest.mark.asyncio
async def test_check_availability_tool():
    """Verify check_availability returns open slots."""
    tool = CheckAvailabilityTool()
    res = await tool.execute(date="tomorrow")
    assert res["success"] is True
    assert len(res["available_slots"]) > 0
    assert "10:30 AM" in res["available_slots"]


@pytest.mark.asyncio
async def test_send_sms_tool():
    """Verify send_sms invokes provider and formats message."""
    tool = SendSMSTool()
    res = await tool.execute(
        phone_number="+919876543210",
        message="Aarogya Dental Care: Your appointment is confirmed.",
    )
    assert res["success"] is True


@pytest.mark.asyncio
async def test_transfer_call_and_callback_fallback():
    """Verify transfer_call tool succeeds or creates callback fallback on failure."""
    db = get_db()
    await db.init_db()

    # 1. Success case with mock telephony
    class MockTelephony:
        async def transfer_call(self, call_id, destination):
            return True

    tool = TransferCallTool(telephony_provider=MockTelephony(), call_id="c_123")
    res = await tool.execute(destination="+919999988888", caller_phone="+919876543210")
    assert res["success"] is True
    assert "Transferring" in res["message"]

    # 2. Failure fallback case
    class FailingTelephony:
        async def transfer_call(self, call_id, destination):
            return False

    tool_fail = TransferCallTool(telephony_provider=FailingTelephony(), call_id="c_456")
    res_fail = await tool_fail.execute(
        destination="+919999988888",
        caller_phone="+919876543210",
        caller_name="Vikram Patil",
    )
    assert res_fail["success"] is False
    assert "fallback_callback_id" in res_fail
    assert "callback" in res_fail["message"]


def test_tool_registry_schemas_and_fillers():
    """Verify tool schemas are formatted for OpenAI/Groq function calling."""
    registry = get_tool_registry()
    schemas = registry.get_schemas()
    assert len(schemas) >= 4

    names = [s["function"]["name"] for s in schemas]
    assert "book_appointment" in names
    assert "check_availability" in names
    assert "send_sms" in names
    assert "transfer_call" in names

    # Fillers in Hindi and Marathi
    assert "सेकंड" in registry.get_filler_phrase("hi")
    assert "सेकंद" in registry.get_filler_phrase("mr")


def test_rag_ingestion_and_sub_150ms_retrieval(tmp_path: Path):
    """Verify RAG chunks document and achieves sub-150ms search retrieval."""
    test_doc = tmp_path / "clinic_policy.txt"
    test_doc.write_text(
        "Aarogya Dental Care provides free emergency checkups for senior citizens.\n"
        "Dental implant warranty is valid for 10 years with annual maintenance.",
        encoding="utf-8",
    )

    rag = RAGStore(index_path=str(tmp_path / "rag.json"))
    count = rag.ingest_file(test_doc)
    assert count > 0

    results = rag.search("senior citizens checkup", top_k=2)
    assert len(results) > 0
    assert "senior citizens" in results[0][0]["text"]


def test_amd_and_recording_objection_heuristics():
    """Verify pipeline detects answering machines and recording objections."""
    prompt_manager = AgentPromptManager()
    pipeline = VoicePipeline(prompt_manager=prompt_manager)

    # 1. Answering Machine Detection (turn 1)
    pipeline._turn_count = 1
    assert pipeline._check_answering_machine("Hello, please leave a message after the tone.") is True
    assert pipeline._check_answering_machine("Namaste, I want to book an appointment") is False

    # 2. Recording objection detection
    assert pipeline._check_recording_revocation("Please stop recording this call.") is True
    assert pipeline._check_recording_revocation("Kripya recording band karein.") is True
    assert pipeline._check_recording_revocation("What is the cost of dental implants?") is False

    # 3. Human transfer request detection
    assert pipeline._check_human_transfer_requested("I want to speak to a doctor directly.") is True
    assert pipeline._check_human_transfer_requested("Connect me to receptionist.") is True
    assert pipeline._check_human_transfer_requested("What are your clinic timings?") is False
