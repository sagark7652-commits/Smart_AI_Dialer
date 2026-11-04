"""FastAPI Calling Agent Service with API key auth, CRUD, webhooks, and audio streaming."""



import asyncio

import base64

from contextlib import asynccontextmanager

from datetime import datetime

import hashlib

import hmac

import json

import time

from typing import Any, Dict, List, Optional

from fastapi import (

    BackgroundTasks,

    Depends,

    FastAPI,

    HTTPException,

    Query,

    Request,

    Response,

    WebSocket,

    WebSocketDisconnect,

    status,

)

from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from pydantic import BaseModel, Field

from agent.auth import verify_api_key

from agent.campaign import CampaignRunner

from agent.compliance import get_compliance_engine

from agent.concurrency import get_concurrency_manager

from agent.config import get_settings

from agent.cost_calculator import CostCalculator

from agent.cost_controller import CostController

from agent.db import APIKeyModel, get_db

from agent.engine import CallingAgentEngine

from agent.logger import setup_logger

from agent.telephony.exotel_provider import ExotelProvider

from agent.telephony.twilio_provider import TwilioProvider

from agent.webhooks import WebhookDispatcher



logger = setup_logger("server")

settings = get_settings()



# Singletons

engine = CallingAgentEngine()

campaign_runner = CampaignRunner(engine)

concurrency_mgr = get_concurrency_manager()

webhook_dispatcher = WebhookDispatcher()

cost_calculator = CostCalculator()

cost_controller = CostController()

processed_webhook_events = set()





@asynccontextmanager

async def lifespan(app: FastAPI):

    """Application startup and graceful shutdown."""

    db = get_db()

    await db.init_db()

    stale_cleared = await db.cleanup_stale_calls()

    logger.info(f"FastAPI Server started. Database initialized. Crash recovery: {stale_cleared} abandoned call(s) cleared.")

    yield

    # Graceful shutdown: terminate any in-flight active calls

    logger.info("Server shutting down. Hanging up active calls...")

    for call_id in list(engine._active_calls.keys()):

        try:

            await engine.hangup_call(call_id)

        except Exception as e:

            logger.error(f"Error terminating call {call_id} on shutdown: {e}")

    logger.info("Shutdown complete.")





app = FastAPI(

    title="Calling Agent Engine API",

    version="1.0.0",

    lifespan=lifespan,

)





@app.exception_handler(Exception)

async def global_exception_handler(request: Request, exc: Exception):

    """Sanitize internal errors to prevent stack trace leaks to external clients."""

    settings = get_settings()

    logger.error(f"Unhandled server exception on {request.method} {request.url.path}: {exc}", exc_info=True)

    if isinstance(exc, HTTPException):

        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    

    if settings.app_env == "development":

        return JSONResponse(

            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

            content={"error": "Internal Server Error", "detail": str(exc)},

        )

    return JSONResponse(

        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,

        content={"error": "Internal Server Error", "message": "An unexpected server error occurred."},

    )





# ============================================================================

# PYDANTIC SCHEMAS

# ============================================================================



class StartCallRequest(BaseModel):

    to_number: str = Field(..., description="Destination phone number with country code")

    agent_id: Optional[str] = Field(None, description="Registered agent ID to use")

    agent_config: Optional[Dict[str, Any]] = Field(None, description="Inline agent configuration override")

    variables: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dynamic per-call customer variables (e.g. customer_name, amount_due, due_date)")

    provider: Optional[str] = Field(None, description="Telephony provider override (twilio or exotel)")

    webhook_url: Optional[str] = Field(None, description="HMAC-signed webhook callback URL upon call completion")

    enforce_compliance: Optional[bool] = Field(True, description="Enforce DND and calling window rules")





class AddDNDRequest(BaseModel):

    phone_number: str = Field(..., description="Phone number to blacklist in DND registry")

    reason: Optional[str] = "Caller requested DND"





class CreateCampaignRequest(BaseModel):

    name: str = Field(..., description="Descriptive campaign title")

    agent_id: str = Field(..., description="Agent profile ID to use for calls")

    phone_numbers: Optional[List[str]] = Field(None, description="List of destination phone numbers")

    contacts: Optional[List[Dict[str, Any]]] = Field(None, description="List of contacts with phone_number and variables")

    csv_content: Optional[str] = Field(None, description="Raw CSV text with phone column and custom variables")

    provider: Optional[str] = Field("twilio", description="Telephony provider: twilio or exotel")

    max_concurrency: Optional[int] = Field(5, ge=1, le=20)

    allowed_hours_start: Optional[str] = "09:00"

    allowed_hours_end: Optional[str] = "21:00"

    retry_max_attempts: Optional[int] = 3

    retry_gap_minutes: Optional[int] = 15

    max_calls_per_day: Optional[int] = 500

    budget_usd: Optional[float] = 100.0

    budget_inr: Optional[float] = 8300.0





class CreateAgentRequest(BaseModel):

    id: str = Field(..., description="Unique alphanumeric slug identifier")

    name: str = Field(..., description="Agent display name")

    role: Optional[str] = "Voice Assistant"

    personality: Optional[str] = "Warm, polite, natural conversational voice assistant"

    mode: Optional[str] = Field("telecaller_sales", description="Operational mode: telecaller_sales, lead_qualification, appointment_booking, reminder_collection, support_faq, feedback_survey, custom")

    company: Optional[Dict[str, Any]] = Field(None, description="Company details: name, description")

    product: Optional[Dict[str, Any]] = Field(None, description="Product / offer details: name, price, benefits, validity, how_to_claim")

    faqs: Optional[List[Dict[str, str]]] = Field(None, description="List of FAQs and objection responses")

    system_prompt: Optional[str] = Field(None, description="System prompt instructions (auto-assembled from mode if omitted)")

    greeting: Optional[str] = Field(None, description="Spoken initial greeting text (auto-synthesized if omitted)")

    default_language: Optional[str] = "hi"

    calling_languages: Optional[List[str]] = Field(default_factory=lambda: ["hi", "en", "mr", "hinglish"])

    # Voice selection removed in Part H2: voice is locked internally per language (mr, hi, en)

    llm_model: Optional[str] = "llama-3.3-70b-versatile"

    tools_enabled: Optional[List[str]] = Field(default_factory=lambda: ["capture_lead", "schedule_callback", "mark_outcome", "transfer_call"])





class UpdateAgentRequest(BaseModel):

    name: Optional[str] = None

    role: Optional[str] = None

    personality: Optional[str] = None

    system_prompt: Optional[str] = None

    greeting: Optional[str] = None

    default_language: Optional[str] = None

    llm_model: Optional[str] = None

    tools_enabled: Optional[List[str]] = None





class RollbackAgentRequest(BaseModel):

    version: int = Field(..., description="Target version number to revert prompt and greeting to")





# ============================================================================

# BROWSER VOICE DEMO (GOOGLE CHROME DIRECT VOICE LOOP)

# ============================================================================



@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    from fastapi import Response
    return Response(content=b"", media_type="image/x-icon")

@app.get("/", response_class=HTMLResponse)

@app.get("/demo", response_class=HTMLResponse)

async def browser_voice_demo():

    """Interactive browser-based voice testing UI in Google Chrome."""

    from pathlib import Path

    html_path = Path(__file__).resolve().parent / "web" / "index.html"

    if html_path.is_file():

        return HTMLResponse(

            content=html_path.read_text(encoding="utf-8"),

            headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}

        )

    return HTMLResponse(content="<h1>Voice Demo HTML not found</h1>", status_code=404)





# ============================================================================

# HEALTH CHECK

# ============================================================================



@app.get("/health")

async def health_check():

    """Unauthenticated health probe with provider circuit breaker metrics."""

    from agent.resilience.circuit_breaker import get_circuit_registry

    registry = get_circuit_registry()

    resilience = registry.get_all_status()

    overall_status = "healthy" if resilience["all_healthy"] else "degraded"



    return {

        "status": overall_status,

        "env": settings.app_env,

        "default_telephony": settings.telephony_provider,

        "active_calls": len(engine._active_calls),

        "resilience": resilience,

    }





# ============================================================================

# CALL MANAGEMENT ENDPOINTS (AUTHENTICATED)

# ============================================================================



@app.post("/calls", status_code=status.HTTP_201_CREATED)

async def start_call(

    req: StartCallRequest,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Initiate an outbound call via Twilio or Exotel with compliance & concurrency checks."""

    logger.info(f"API key ID {api_key.id} requested outbound call to {req.to_number}")



    # 0. Pre-flight cost control check (API key daily and monthly limits)

    cost_allowed, limit_reason, warning_alert = await cost_controller.check_api_key_limits(api_key.id)

    if not cost_allowed:

        logger.warning(f"Outbound call blocked by cost control for API key {api_key.id}: {limit_reason}")

        raise HTTPException(

            status_code=status.HTTP_429_TOO_MANY_REQUESTS,

            detail=f"Cost control limit exceeded: {limit_reason}",

        )



    # 1. Pre-flight compliance validator (DND and calling hours)

    if req.enforce_compliance:

        compliance = get_compliance_engine()

        allowed, reason = await compliance.validate_outbound_call(req.to_number)

        if not allowed:

            logger.warning(f"Outbound call blocked by compliance: {reason}")

            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=reason)



    # 2. Concurrency slot check

    await concurrency_mgr.acquire_slot(timeout_sec=5.0)



    try:

        call_id = await engine.start_outbound_call(

            to_number=req.to_number,

            agent_id=req.agent_id,

        )

        if req.variables:

            db = get_db()

            await db.update_call(call_id, extracted_data=json.dumps(req.variables, ensure_ascii=False))

        return {

            "status": "initiated",

            "call_id": call_id,

            "to_number": req.to_number,

            "provider": req.provider or engine.telephony_provider_name,

        }

    except Exception as e:

        concurrency_mgr.release_slot()

        logger.error(f"Failed to initiate call to {req.to_number}: {e}")

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))





@app.get("/calls/{call_id}")

async def get_call_details(

    call_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Retrieve call status, duration, full transcript, and latency statistics."""

    try:

        return await engine.get_call_details(call_id)

    except KeyError:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Call '{call_id}' not found.")





@app.get("/calls")

async def list_calls(

    status: Optional[str] = Query(None, description="Filter by call status"),

    provider: Optional[str] = Query(None, description="Filter by telephony provider"),

    direction: Optional[str] = Query(None, description="Filter by direction (inbound/outbound)"),

    needs_review: Optional[bool] = Query(None, description="Filter calls needing review"),

    limit: int = Query(50, ge=1, le=100),

    offset: int = Query(0, ge=0),

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """List call history with optional status, provider, and review filters."""

    return await engine.list_calls(

        status=status,

        provider=provider,

        needs_review=needs_review,

        limit=limit,

        offset=offset,

    )





@app.post("/calls/{call_id}/hangup")

async def hangup_call(

    call_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Terminate an active call."""

    try:

        await engine.hangup_call(call_id)

        return {"status": "success", "call_id": call_id, "message": "Call terminated."}

    except Exception as e:

        logger.error(f"Error terminating call {call_id}: {e}")

        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))





# ============================================================================

# AGENT CRUD ENDPOINTS (AUTHENTICATED)

# ============================================================================



@app.post("/agents", status_code=status.HTTP_201_CREATED)

async def create_agent(

    req: CreateAgentRequest,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Register a new conversational agent profile."""

    db = get_db()

    existing = await db.get_agent(req.id)

    if existing:

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Agent '{req.id}' already exists.")



    agent_data = req.model_dump()

    if not agent_data.get("system_prompt"):

        from agent.llm.prompt_manager import AgentPromptManager

        pm = AgentPromptManager(config_dict=agent_data)

        agent_data["system_prompt"] = pm.build_system_prompt()

        if not agent_data.get("greeting"):

            agent_data["greeting"] = pm.get_greeting()



    agent = await db.create_agent(agent_data)

    return {"status": "created", "agent": {"id": agent.id, "name": agent.name, "mode": req.mode}}





@app.get("/agents")

async def list_agents(

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """List all registered agents."""

    db = get_db()

    agents = await db.list_agents()

    return [

        {

            "id": a.id,

            "name": a.name,

            "role": a.role,

            "language": a.default_language,

            "llm_model": a.llm_model,

        }

        for a in agents

    ]





@app.get("/agents/{agent_id}")

async def get_agent(

    agent_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Get full agent profile and prompt configuration."""

    db = get_db()

    agent = await db.get_agent(agent_id)

    if not agent:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found.")

    return {

        "id": agent.id,

        "name": agent.name,

        "role": agent.role,

        "personality": agent.personality,

        "system_prompt": agent.system_prompt,

        "greeting": agent.greeting,

        "default_language": agent.default_language,

        "voice_provider": agent.voice_provider,

        "tools_enabled": json.loads(agent.tools_enabled) if agent.tools_enabled else [],

    }





@app.put("/agents/{agent_id}")

async def update_agent(

    agent_id: str,

    req: UpdateAgentRequest,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Update agent configuration."""

    db = get_db()

    updates = {k: v for k, v in req.model_dump().items() if v is not None}

    agent = await db.update_agent(agent_id, updates)

    if not agent:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found.")

    return {"status": "updated", "agent_id": agent.id}





@app.get("/agents/{agent_id}/versions")

async def get_agent_prompt_versions(

    agent_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Retrieve all historical prompt and greeting versions for an agent."""

    db = get_db()

    agent = await db.get_agent(agent_id)

    if not agent:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent '{agent_id}' not found.")

    versions = await db.get_agent_versions(agent_id)

    return [

        {

            "version": v.version,

            "system_prompt": v.system_prompt,

            "greeting": v.greeting,

            "created_at": v.created_at.isoformat() if v.created_at else None,

        }

        for v in versions

    ]





@app.post("/agents/{agent_id}/rollback")

async def rollback_agent_prompt(

    agent_id: str,

    req: RollbackAgentRequest,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Roll back agent's system prompt and greeting to an earlier historical version."""

    db = get_db()

    agent = await db.rollback_agent_prompt(agent_id, req.version)

    if not agent:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail=f"Version {req.version} not found for agent '{agent_id}'.",

        )

    return {

        "status": "rolled_back",

        "agent_id": agent.id,

        "restored_version": req.version,

        "system_prompt": agent.system_prompt,

        "greeting": agent.greeting,

    }





# ============================================================================

# USAGE TRACKING & BILLING ENDPOINTS (AUTHENTICATED)

# ============================================================================



@app.get("/usage")

async def get_usage_metrics(

    from_date: Optional[str] = Query(None, alias="from", description="ISO start date e.g. 2026-01-01"),

    to_date: Optional[str] = Query(None, alias="to", description="ISO end date e.g. 2026-12-31"),

    api_key_param: Optional[str] = Query(None, alias="api_key", description="Optional API key prefix or id"),

    campaign_id: Optional[str] = Query(None, description="Filter by campaign ID"),

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Retrieve detailed usage and financial cost reporting with breakdowns by provider, mode, and day."""

    db = get_db()

    f_dt = None

    if from_date:

        try:

            f_dt = datetime.fromisoformat(from_date)

        except Exception:

            f_dt = datetime.strptime(from_date, "%Y-%m-%d")



    t_dt = None

    if to_date:

        try:

            t_dt = datetime.fromisoformat(to_date)

        except Exception:

            t_dt = datetime.strptime(to_date, "%Y-%m-%d")



    target_api_key_id = api_key.id

    if api_key_param:

        if api_key_param.isdigit():

            target_api_key_id = int(api_key_param)

        elif api_key_param.lower() in ("all", "*"):

            target_api_key_id = None



    detailed = await db.get_detailed_usage(

        from_date=f_dt,

        to_date=t_dt,

        api_key_id=target_api_key_id,

        campaign_id=campaign_id,

    )

    return {

        "status": "success",

        "api_key_prefix": api_key.prefix,

        "filters": {

            "from": from_date,

            "to": to_date,

            "api_key": api_key_param or api_key.prefix,

            "campaign_id": campaign_id,

        },

        "usage": detailed.get("summary", {}),

        **detailed,

    }





# ============================================================================

# DND & COMPLIANCE ENDPOINTS (AUTHENTICATED)

# ============================================================================



@app.post("/compliance/dnd", status_code=status.HTTP_201_CREATED)

async def add_dnd_number(

    req: AddDNDRequest,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Add a phone number to the Do Not Disturb (DND) blacklist."""

    db = get_db()

    entry = await db.add_dnd(req.phone_number, req.reason or "Added via API")

    return {

        "status": "added",

        "phone_number": entry.phone_number,

        "reason": entry.reason,

    }





@app.get("/compliance/dnd/{phone_number}")

async def check_dnd_status(

    phone_number: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Check if a phone number is registered on the DND blacklist."""

    db = get_db()

    is_blacklisted = await db.is_dnd(phone_number)

    return {

        "phone_number": phone_number,

        "is_dnd": is_blacklisted,

    }





@app.delete("/compliance/dnd/{phone_number}")

async def remove_dnd_number(

    phone_number: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Remove a phone number from the DND blacklist."""

    db = get_db()

    removed = await db.remove_dnd(phone_number)

    if not removed:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail=f"Phone number '{phone_number}' not found in DND registry.",

        )

    return {"status": "removed", "phone_number": phone_number}





# ============================================================================

# CAMPAIGN MODE ENDPOINTS (AUTHENTICATED)

# ============================================================================



@app.post("/campaigns", status_code=status.HTTP_201_CREATED)

async def create_campaign(

    req: CreateCampaignRequest,

    background_tasks: BackgroundTasks,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Create and launch a background outbound calling campaign with CSV mapping & E.164 validation."""

    from agent.campaign import parse_and_validate_campaign_csv, validate_e164_phone, get_campaign_runner

    db = get_db()

    agent = await db.get_agent(req.agent_id)

    if not agent:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail=f"Agent '{req.agent_id}' not found.",

        )



    prepared_contacts = []

    rejected_rows = []

    duplicates_count = 0



    if req.csv_content:

        csv_res = parse_and_validate_campaign_csv(req.csv_content)

        prepared_contacts = csv_res["valid_contacts"]

        rejected_rows = csv_res["invalid_rows"]

        duplicates_count = csv_res["duplicates_count"]

    elif req.contacts:

        seen = set()

        for idx, item in enumerate(req.contacts, start=1):

            raw_p = (item.get("phone_number") or item.get("phone") or "").strip()

            is_valid, norm, err = validate_e164_phone(raw_p)

            if not is_valid:

                rejected_rows.append({"row": idx, "data": item, "reason": err})

                continue

            if norm in seen:

                duplicates_count += 1

                continue

            seen.add(norm)

            vars_data = item.get("variables", {k: v for k, v in item.items() if k not in ["phone", "phone_number"]})

            prepared_contacts.append({"phone_number": norm, "variables": vars_data})

    elif req.phone_numbers:

        seen = set()

        for idx, raw_p in enumerate(req.phone_numbers, start=1):

            is_valid, norm, err = validate_e164_phone(raw_p)

            if not is_valid:

                rejected_rows.append({"row": idx, "data": raw_p, "reason": err})

                continue

            if norm in seen:

                duplicates_count += 1

                continue

            seen.add(norm)

            prepared_contacts.append({"phone_number": norm, "variables": {}})

    else:

        raise HTTPException(status_code=400, detail="Must provide phone_numbers, contacts, or csv_content.")



    if not prepared_contacts:

        raise HTTPException(

            status_code=400,

            detail={"error": "No valid phone numbers found after validation.", "rejected_rows": rejected_rows},

        )



    campaign_id = f"camp_{int(time.time()*1000)}"

    campaign = await db.create_campaign(

        campaign_id=campaign_id,

        name=req.name,

        agent_id=req.agent_id,

        contacts=prepared_contacts,

        provider=req.provider or "twilio",

        max_concurrency=min(req.max_concurrency or 5, 20),

        allowed_hours_start=req.allowed_hours_start or "09:00",

        allowed_hours_end=req.allowed_hours_end or "21:00",

        retry_max_attempts=req.retry_max_attempts or 3,

        retry_gap_minutes=req.retry_gap_minutes or 15,

        max_calls_per_day=req.max_calls_per_day or 500,

        budget_usd=req.budget_usd or 100.0,

        budget_inr=req.budget_inr or 8300.0,

    )



    runner = get_campaign_runner()

    background_tasks.add_task(runner.run_campaign, campaign_id)



    return {

        "status": "created",

        "campaign_id": campaign.id,

        "name": campaign.name,

        "total_contacts": campaign.total_contacts,

        "max_concurrency": campaign.max_concurrency,

        "duplicates_removed": duplicates_count,

        "rejected_count": len(rejected_rows),

        "rejected_rows": rejected_rows[:20],

    }





@app.get("/campaigns/{campaign_id}")

async def get_campaign_status(

    campaign_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Retrieve comprehensive execution metrics, progress, and outcomes for a campaign."""

    db = get_db()

    campaign = await db.get_campaign(campaign_id)

    if not campaign:

        raise HTTPException(

            status_code=status.HTTP_404_NOT_FOUND,

            detail=f"Campaign '{campaign_id}' not found.",

        )



    contacts = await db.get_campaign_contacts(campaign_id)

    total = len(contacts)

    pending = sum(1 for c in contacts if c.status in ["pending", "queued"])

    dialing = sum(1 for c in contacts if c.status == "dialing")

    completed = sum(1 for c in contacts if c.status == "completed")

    blocked = sum(1 for c in contacts if c.status == "blocked")

    failed = sum(1 for c in contacts if c.status == "failed")

    answered = completed + sum(1 for c in contacts if c.status == "answered")



    # Outcomes breakdown

    outcomes: Dict[str, int] = {}

    for c in contacts:

        if c.outcome:

            outcomes[c.outcome] = outcomes.get(c.outcome, 0) + 1



    # Query duration metrics from calls table for connected contacts

    import sqlalchemy as sa

    call_ids = [c.call_id for c in contacts if c.call_id]

    avg_duration_sec = 0.0

    total_cost_usd = 0.0

    if call_ids:

        async with db.session_factory() as session:

            stmt = sa.select(

                sa.func.avg(CallModel.duration_sec),

                sa.func.count(CallModel.id),

            ).where(CallModel.id.in_(call_ids))

            row = (await session.execute(stmt)).one()

            avg_duration_sec = round(float(row[0] or 0.0), 1)



            # Cost lookup

            stmt_cost = sa.select(sa.func.sum(UsageRecord.estimated_cost_usd)).where(

                UsageRecord.call_id.in_(call_ids)

            )

            total_cost_usd = round(float((await session.execute(stmt_cost)).scalar() or 0.0), 4)



    progress_pct = round((completed + failed + blocked) / total * 100, 1) if total > 0 else 0.0



    return {

        "id": campaign.id,

        "name": campaign.name,

        "status": campaign.status,

        "agent_id": campaign.agent_id,

        "provider": campaign.provider,

        "progress_percent": progress_pct,

        "total_contacts": total,

        "answered": answered,

        "connected": len(call_ids),

        "completed": completed,

        "failed": failed,

        "blocked": blocked,

        "pending": pending,

        "dialing": dialing,

        "avg_duration_sec": avg_duration_sec,

        "outcomes_breakdown": outcomes,

        "cost_so_far_usd": total_cost_usd,

    }





@app.get("/campaigns/{campaign_id}/results")

async def export_campaign_results_csv(

    campaign_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Export complete campaign results as a downloadable CSV report."""

    from fastapi.responses import Response

    db = get_db()

    campaign = await db.get_campaign(campaign_id)

    if not campaign:

        raise HTTPException(status_code=404, detail="Campaign not found.")



    contacts = await db.get_campaign_contacts(campaign_id)

    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow([

        "phone_number",

        "status",

        "attempts",

        "outcome",

        "summary",

        "blocked_reason",

        "call_id",

        "variables",

        "created_at",

    ])



    for c in contacts:

        writer.writerow([

            c.phone_number,

            c.status,

            c.attempts,

            c.outcome or "",

            c.summary or "",

            c.blocked_reason or "",

            c.call_id or "",

            c.variables_json or "",

            c.created_at.isoformat() if c.created_at else "",

        ])



    csv_data = output.getvalue()

    return Response(

        content=csv_data,

        media_type="text/csv",

        headers={"Content-Disposition": f"attachment; filename=campaign_{campaign_id}_results.csv"},

    )





@app.post("/campaigns/{campaign_id}/pause")

async def pause_campaign(

    campaign_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Pause an active campaign."""

    from agent.campaign import get_campaign_runner

    db = get_db()

    campaign = await db.get_campaign(campaign_id)

    if not campaign:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")

    get_campaign_runner().pause_campaign(campaign_id)

    await db.update_campaign_status(campaign_id, "paused")

    return {"status": "paused", "campaign_id": campaign_id}





@app.post("/campaigns/{campaign_id}/resume")

async def resume_campaign(

    campaign_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Resume a paused campaign."""

    from agent.campaign import get_campaign_runner

    db = get_db()

    campaign = await db.get_campaign(campaign_id)

    if not campaign:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")

    get_campaign_runner().resume_campaign(campaign_id)

    await db.update_campaign_status(campaign_id, "running")

    return {"status": "resumed", "campaign_id": campaign_id}





@app.post("/campaigns/{campaign_id}/cancel")

async def cancel_campaign(

    campaign_id: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Cancel a campaign and halt pending contacts."""

    from agent.campaign import get_campaign_runner

    db = get_db()

    campaign = await db.get_campaign(campaign_id)

    if not campaign:

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found.")

    get_campaign_runner().cancel_campaign(campaign_id)

    await db.update_campaign_status(campaign_id, "cancelled")

    return {"status": "cancelled", "campaign_id": campaign_id}





# ============================================================================

# CALLBACK SCHEDULER ENDPOINTS

# ============================================================================



@app.get("/callbacks")

async def list_callbacks(

    status: Optional[str] = None,

    phone_number: Optional[str] = None,

    limit: int = 50,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """List scheduled, pending, completed, or cancelled callback requests."""

    from agent.db import CallbackRequest

    import sqlalchemy as sa

    db = get_db()

    async with db.session_factory() as session:

        stmt = sa.select(CallbackRequest).order_by(CallbackRequest.requested_at.desc()).limit(min(limit, 100))

        if status:

            stmt = stmt.where(CallbackRequest.status == status)

        if phone_number:

            stmt = stmt.where(CallbackRequest.phone_number == phone_number)

        results = (await session.execute(stmt)).scalars().all()

        return [

            {

                "id": cb.id,

                "caller_name": cb.caller_name,

                "phone_number": cb.phone_number,

                "scheduled_time": cb.scheduled_time.isoformat() if cb.scheduled_time else None,

                "timezone": cb.timezone,

                "reason": cb.reason,

                "previous_call_id": cb.previous_call_id,

                "context_summary": cb.context_summary,

                "status": cb.status,

                "attempts": cb.attempts,

                "max_attempts": cb.max_attempts,

                "requested_at": cb.requested_at.isoformat() if cb.requested_at else None,

                "completed_at": cb.completed_at.isoformat() if cb.completed_at else None,

            }

            for cb in results

        ]





@app.post("/callbacks")

async def create_callback(

    payload: Dict[str, Any],

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Schedule a callback via API."""

    phone = payload.get("phone_number")

    preferred_time = payload.get("preferred_time") or payload.get("scheduled_time")

    if not phone or not preferred_time:

        raise HTTPException(status_code=400, detail="phone_number and preferred_time are required.")



    from agent.callback_scheduler import get_callback_scheduler

    scheduler = get_callback_scheduler()

    res = await scheduler.schedule(

        phone_number=phone,

        preferred_time_str=str(preferred_time),

        reason=payload.get("reason"),

        previous_call_id=payload.get("previous_call_id"),

        caller_name=payload.get("caller_name"),

    )

    return res





@app.post("/callbacks/{callback_id}/cancel")

async def cancel_callback(

    callback_id: int,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Cancel a scheduled callback."""

    from agent.db import CallbackRequest

    import sqlalchemy as sa

    db = get_db()

    async with db.session_factory() as session:

        stmt = sa.select(CallbackRequest).where(CallbackRequest.id == callback_id)

        cb = (await session.execute(stmt)).scalar_one_or_none()

        if not cb:

            raise HTTPException(status_code=404, detail="Callback request not found.")

        cb.status = "cancelled"

        await session.commit()

        return {"status": "cancelled", "callback_id": callback_id}





# ============================================================================

# TELEPHONY WEBHOOKS & STATUS CALLBACKS

# ============================================================================



@app.post("/webhooks/{provider}")

@app.post("/webhooks/{provider}/voice")

@app.post("/webhooks/{provider}/status")

async def telephony_webhook(provider: str, request: Request):

    """Unified inbound voice webhook and status callback handler with deduplication and signature verification."""

    provider_name = provider.lower()

    form_data = {}

    try:

        form_data = await request.form()

    except Exception:

        pass



    # Signature verification for Twilio webhooks

    if provider_name == "twilio" and settings.twilio_auth_token:

        sig = request.headers.get("X-Twilio-Signature")

        if not sig and settings.app_env == "production":

            logger.warning("Missing X-Twilio-Signature header on production Twilio webhook.")

            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing Twilio signature.")

        if sig:

            url = str(request.url)

            dict_form = dict(form_data)

            s = url + "".join(f"{k}{dict_form[k]}" for k in sorted(dict_form.keys()))

            expected_sig = base64.b64encode(

                hmac.new(settings.twilio_auth_token.encode("utf-8"), s.encode("utf-8"), hashlib.sha1).digest()

            ).decode("utf-8")

            if not hmac.compare_digest(expected_sig, sig):

                logger.warning(f"Invalid X-Twilio-Signature on webhook request to {url}")

                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature.")



    # Token verification for Exotel webhooks (query param ?token=...)

    elif provider_name == "exotel" and settings.webhook_secret:

        token = request.query_params.get("token") or request.headers.get("x-exotel-token")

        if token and not hmac.compare_digest(token, settings.webhook_secret):

            logger.warning("Invalid Exotel webhook token provided.")

            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Exotel token.")



    call_sid = form_data.get("CallSid") or form_data.get("call_sid") or form_data.get("Sid")

    event_status = form_data.get("CallStatus") or form_data.get("Status") or form_data.get("event")

    answered_by = form_data.get("AnsweredBy")



    # Twilio Answering Machine Detection (AMD) handling

    if answered_by:

        logger.info(f"Twilio AMD event for CallSid {call_sid}: AnsweredBy={answered_by}")

        if "machine" in str(answered_by).lower():

            logger.warning(f"Twilio AMD flagged voicemail/machine for CallSid {call_sid}")

            db = get_db()

            if call_sid:

                await db.update_call(call_id=str(call_sid), outcome="voicemail")



    # Deduplicate repeated webhook triggers

    event_key = f"{call_sid}_{event_status}"

    if event_key in processed_webhook_events:

        logger.debug(f"Ignoring duplicate webhook event: {event_key}")

        return Response(status_code=200)

    processed_webhook_events.add(event_key)



    logger.info(f"Received {provider_name.upper()} webhook for CallSid: {call_sid}, status: {event_status}")



    # Update database record if status update

    if call_sid and event_status:

        db = get_db()

        await db.update_call(call_id=str(call_sid), status=str(event_status).lower())



    # Terminal statuses (completed, busy, no-answer, failed): ack without TwiML

    if str(event_status).lower() in ("completed", "busy", "no-answer", "failed", "canceled"):

        return Response(status_code=200, content="Status recorded.")



    # Return initial TwiML if inbound/answered Twilio voice call

    if provider_name == "twilio":

        public_url = settings.public_url.rstrip("/")

        ws_url = public_url.replace("http://", "ws://").replace("https://", "wss://")

        stream_url = f"{ws_url}/webhooks/twilio/stream"

        twiml = TwilioProvider.generate_twiml(stream_url)

        return Response(content=twiml, media_type="application/xml")



    # Return Exotel Voicebot direction

    elif provider_name == "exotel":

        public_url = settings.public_url.rstrip("/")

        ws_url = public_url.replace("http://", "ws://").replace("https://", "wss://")

        stream_url = f"{ws_url}/webhooks/exotel/stream"

        return {"status": "success", "stream_url": stream_url}



    return {"status": "received"}





@app.post("/webhooks/exotel/dtmf")

async def exotel_dtmf_webhook(request: Request):

    """Exotel IVR Flow 'Gather' Applet HTTP webhook handler.



    NOTE ON EXOTEL DTMF MECHANISM:

    Unlike Twilio, Exotel does NOT stream DTMF events inside the Voicebot WebSocket.

    Exotel flows collect keypad digits via a Gather Applet and send them via HTTP POST here.

    """

    try:

        content_type = request.headers.get("content-type", "")

        if "application/json" in content_type:

            body = await request.json()

        else:

            form = await request.form()

            body = dict(form)

    except Exception:

        body = {}



    call_sid = body.get("CallSid") or body.get("call_sid") or request.query_params.get("CallSid")

    digits = body.get("Digits") or body.get("digits") or request.query_params.get("Digits") or ""

    digits = str(digits).strip()



    logger.info(f"Received Exotel DTMF Gather callback: CallSid={call_sid}, Digits='{digits}'")



    if not digits:

        return {"status": "ignored", "reason": "no_digits"}



    # Locate active pipeline by call_sid or matching call_id

    pipeline = None

    for cid, pipe in list(engine._active_calls.items()):

        if cid == call_sid or (getattr(pipe, "telephony", None) and getattr(pipe.telephony, "call_sid", None) == call_sid):

            pipeline = pipe

            break



    if pipeline:

        res = await pipeline.handle_dtmf_digit(digits)

        return {"status": "processed", "result": res}

    else:

        logger.warning(f"No active pipeline found for Exotel CallSid {call_sid}")

        return {"status": "call_not_found", "call_sid": call_sid}





@app.post("/calls/{call_id}/dtmf")

async def send_call_dtmf(call_id: str, payload: Dict[str, Any]):

    """Manually send keypad DTMF digits to an active call (supports testing and web dials)."""

    digit = str(payload.get("digit", "")).strip()

    if not digit:

        raise HTTPException(status_code=400, detail="Missing 'digit' in payload.")



    pipeline = engine._active_calls.get(call_id)

    if not pipeline:

        raise HTTPException(status_code=404, detail=f"No active call session found for {call_id}")



    res = await pipeline.handle_dtmf_digit(digit)

    return {"status": "success", "call_id": call_id, "result": res}





# ============================================================================

# WEBSOCKET STREAMING AUDIO HANDLERS

# ============================================================================



@app.websocket("/webhooks/twilio/stream")

async def twilio_stream_websocket(websocket: WebSocket):

    """Twilio Media Stream WebSocket audio connection."""

    await websocket.accept()

    logger.info("Twilio WebSocket connection established.")



    telephony = TwilioProvider()

    telephony.websocket = websocket

    telephony._is_active = True



    call_id = f"tw_{int(asyncio.get_event_loop().time()*1000)}"

    pipeline = engine.create_pipeline(telephony_provider=telephony, call_id=call_id)



    try:

        await pipeline.stt.start(language="multi")

    except Exception as e:

        logger.error(f"[{call_id}] Failed to start STT: {e}")

        await websocket.close()

        return



    pipeline_task = asyncio.create_task(pipeline.run_loop(telephony.audio_in()))



    try:

        while True:

            msg = await websocket.receive_text()

            await telephony.handle_inbound_message(msg)

    except WebSocketDisconnect:

        logger.info(f"[{call_id}] Twilio WebSocket disconnected (caller hung up).")

    except Exception as e:

        logger.error(f"[{call_id}] WebSocket error: {e}")

    finally:

        stt_task.cancel()
        pipeline_task.cancel()

        await pipeline.stt.stop()

        if call_id in engine._active_calls:

            del engine._active_calls[call_id]





@app.websocket("/webhooks/exotel/stream")

async def exotel_stream_websocket(websocket: WebSocket):

    """Exotel Voicebot WebSocket audio connection."""

    await websocket.accept()

    logger.info("Exotel WebSocket connection established.")



    telephony = ExotelProvider()

    telephony.websocket = websocket

    telephony._is_active = True



    call_id = f"exo_{int(asyncio.get_event_loop().time()*1000)}"

    pipeline = engine.create_pipeline(telephony_provider=telephony, call_id=call_id)



    try:

        await pipeline.stt.start(language="multi")

    except Exception as e:

        logger.error(f"[{call_id}] Failed to start STT: {e}")

        await websocket.close()

        return



    pipeline_task = asyncio.create_task(pipeline.run_loop(telephony.audio_in()))



    try:

        while True:

            msg = await websocket.receive_text()

            await telephony.handle_inbound_message(msg)

    except WebSocketDisconnect:

        logger.info(f"[{call_id}] Exotel WebSocket disconnected (caller hung up).")

    except Exception as e:

        logger.error(f"[{call_id}] WebSocket error: {e}")

    finally:

        pipeline_task.cancel()

        await pipeline.stt.stop()

        if call_id in engine._active_calls:

            del engine._active_calls[call_id]





@app.websocket("/ws/browser-voice")

async def browser_voice_websocket(websocket: WebSocket):

    """Direct in-browser WebAudio WebSocket connection for Google Chrome."""

    await websocket.accept()

    call_id = f"browser_{int(asyncio.get_event_loop().time() * 1000)}"

    logger.info(f"[{call_id}] Browser voice connection established from Google Chrome.")



    from agent.telephony.browser_provider import BrowserWebAudioProvider



    browser_provider = BrowserWebAudioProvider(websocket=websocket, call_id=call_id)



    # Dynamic operational mode and preset selection from browser query parameters

    preset_name = websocket.query_params.get("preset")

    mode_name = websocket.query_params.get("mode")

    lang_name = websocket.query_params.get("lang", "en")

    gender_name = websocket.query_params.get("gender", "female")



    custom_cfg = None

    from pathlib import Path

    import yaml



    file_to_load = None

    if preset_name:

        for folder in [Path("modes/examples"), Path("modes")]:

            cand = folder / f"{preset_name}.yaml"

            if cand.is_file():

                file_to_load = cand

                break

    elif mode_name:

        for folder in [Path("modes"), Path("modes/examples")]:

            cand = folder / f"{mode_name}.yaml"

            if cand.is_file():

                file_to_load = cand

                break



    if not file_to_load:

        file_to_load = Path("modes/examples/mobile_recharge_promo.yaml")



    if file_to_load and file_to_load.is_file():

        with open(file_to_load, "r", encoding="utf-8") as f_cfg:

            custom_cfg = yaml.safe_load(f_cfg) or {}

        logger.info(f"[{call_id}] Successfully loaded agent mode from {file_to_load}: name='{custom_cfg.get('name')}', company='{custom_cfg.get('company')}'")



    if custom_cfg:

        active_preset = preset_name or mode_name or "mobile_recharge_promo"
        custom_cfg["preset_key"] = active_preset
        custom_cfg["mode_name"] = active_preset
        if lang_name:
            custom_cfg["default_language"] = lang_name
        custom_cfg["gender"] = gender_name

        # Unlimited interactive test duration for browser voice sessions

        custom_cfg["enable_cost_guard"] = False

        custom_cfg["max_call_duration_sec"] = 3600.0

        custom_cfg["max_call_cost_usd"] = 9999.0

        custom_cfg["pickup_wait_ms"] = 0

        custom_cfg["greeting_delay_ms"] = 0
        custom_cfg["language_policy"] = "strict"



    pipeline = engine.create_pipeline(

        telephony_provider=browser_provider,

        call_id=call_id,

        agent_config=custom_cfg,

    )
    pipeline.current_language = lang_name
    pipeline.language_locked = True
    if pipeline.session:
        pipeline.session.set_active_language(lang_name)
    if pipeline.tts and hasattr(pipeline.tts, "set_language"):
        pipeline.tts.set_language(lang_name)




    # State transition hook to update browser UI badge

    def on_state(state):

        try:

            asyncio.create_task(browser_provider.send_state_update(state.value))

        except RuntimeError:

            pass



    pipeline.on_state_change = on_state



    # Hook transcript recording to update browser chat bubble in real time

    orig_record_transcript = pipeline._record_transcript



    def hooked_record_transcript(role, text, interrupted=False, latency=None, tool_calls=None):

        orig_record_transcript(role, text, interrupted=interrupted, latency=latency, tool_calls=tool_calls)

        try:

            asyncio.create_task(browser_provider.send_transcript(role, text, latency=latency))

        except RuntimeError:

            pass



    pipeline._record_transcript = hooked_record_transcript



    # Send configuration status to browser UI

    settings = get_settings()

    has_cloud_tts = bool(settings.cartesia_api_key or settings.sarvam_api_key or settings.openai_api_key or settings.elevenlabs_api_key or getattr(settings, "huggingface_api_key", None))

    has_keys = bool((settings.groq_api_key or getattr(settings, "huggingface_api_key", None)) and has_cloud_tts)

    await browser_provider.send_status_info({

        "mode": "cloud_ai" if has_keys else "browser_demo",

        "has_groq": bool(settings.groq_api_key),

        "has_deepgram": bool(settings.deepgram_api_key),

        "has_cartesia": bool(settings.cartesia_api_key),

        "has_sarvam": bool(settings.sarvam_api_key),

        "has_openai": bool(settings.openai_api_key),

        "has_elevenlabs": bool(settings.elevenlabs_api_key),

        "has_huggingface": bool(getattr(settings, "huggingface_api_key", None)),

    })



    # Start STT initialization concurrently in background so greeting audio streams with 0ms delay!
    async def init_stt():
        try:
            await pipeline.stt.start(language="multi")
        except Exception as e:
            logger.error(f"[{call_id}] Failed to start STT: {e}")

    stt_task = asyncio.create_task(init_stt())

    # Start audio pipeline loop in background (run_loop handles greeting instantly)
    pipeline_task = asyncio.create_task(pipeline.run_loop(browser_provider.audio_in()))



    try:

        while True:

            msg = await websocket.receive()

            if "bytes" in msg and msg["bytes"]:

                await browser_provider.push_inbound_audio(msg["bytes"])

            elif "text" in msg and msg["text"]:

                try:

                    data = json.loads(msg["text"])

                    if data.get("type") == "barge_in":

                        pipeline.trigger_barge_in()

                    elif data.get("type") == "set_language":
                        req_lang = str(data.get("lang", "en")).lower().split("-")[0]
                        if req_lang in ("en", "hi", "mr"):
                            logger.info(f"[{call_id}] Browser explicit language pill switch: {pipeline.current_language} -> {req_lang}")
                            pipeline.current_language = req_lang
                            pipeline.language_locked = True
                            if pipeline.session:
                                pipeline.session.set_active_language(req_lang)
                            if pipeline.tts and hasattr(pipeline.tts, "set_language"):
                                pipeline.tts.set_language(req_lang)
                    elif data.get("type") == "user_transcript":

                        user_text = data.get("text", "").strip()

                        if user_text:

                            await pipeline.process_user_turn(user_text)

                    elif data.get("type") == "dtmf":

                        digit = str(data.get("digit", "")).strip()

                        if digit:

                            await pipeline.handle_dtmf_digit(digit)

                    elif data.get("type") == "agent_speaking_started":

                        from agent.pipeline import AgentState

                        pipeline._set_state(AgentState.SPEAKING)

                        pipeline._last_user_activity_time = time.time()

                    elif data.get("type") == "agent_speaking_finished":

                        from agent.pipeline import AgentState

                        if pipeline.state != AgentState.DISCONNECTED:

                            pipeline._set_state(AgentState.LISTENING)

                        pipeline._last_user_activity_time = time.time()

                except Exception:

                    pass

    except WebSocketDisconnect:

        logger.info(f"[{call_id}] Browser voice session closed by user.")

    except Exception as e:

        logger.error(f"[{call_id}] Browser voice WebSocket error: {e}")

    finally:

        browser_provider._is_active = False

        pipeline_task.cancel()

        await pipeline.stt.stop()

        pipeline.save_session_transcript()

        pipeline.print_session_summary()

        if call_id in engine._active_calls:

            del engine._active_calls[call_id]





# ---------------------------------------------------------

# Result Webhook Management & Fallback Polling Endpoints

# ---------------------------------------------------------



@app.get("/webhooks/events")

async def list_webhook_events(

    status: Optional[str] = None,

    event_type: Optional[str] = None,

    limit: int = 50,

):

    """Fallback polling endpoint for consumers unable to receive inbound HTTP webhooks."""

    from agent.db import WebhookEventModel

    import sqlalchemy as sa

    db = get_db()

    async with db.session_factory() as session:

        stmt = sa.select(WebhookEventModel).order_by(WebhookEventModel.created_at.desc()).limit(min(limit, 100))

        if status:

            stmt = stmt.where(WebhookEventModel.status == status)

        if event_type:

            stmt = stmt.where(WebhookEventModel.event_type == event_type)

        events = (await session.execute(stmt)).scalars().all()

        return [

            {

                "id": e.id,

                "event_type": e.event_type,

                "idempotency_key": e.idempotency_key,

                "agent_id": e.agent_id,

                "call_id": e.call_id,

                "status": e.status,

                "attempts": e.attempts,

                "payload": json.loads(e.payload_json) if e.payload_json else {},

                "created_at": e.created_at.isoformat() if e.created_at else None,

                "delivered_at": e.delivered_at.isoformat() if e.delivered_at else None,

            }

            for e in events

        ]





@app.get("/webhooks/dead-letter")

async def list_dead_letter_webhooks(limit: int = 50):

    """List failed webhooks in dead-letter table that exhausted all 5 attempts."""

    from agent.db import WebhookDeadLetterModel

    import sqlalchemy as sa

    db = get_db()

    async with db.session_factory() as session:

        stmt = sa.select(WebhookDeadLetterModel).order_by(WebhookDeadLetterModel.created_at.desc()).limit(min(limit, 100))

        items = (await session.execute(stmt)).scalars().all()

        return [

            {

                "id": d.id,

                "event_type": d.event_type,

                "idempotency_key": d.idempotency_key,

                "url": d.url,

                "attempts": d.attempts,

                "last_error": d.last_error,

                "payload": json.loads(d.payload_json) if d.payload_json else {},

                "created_at": d.created_at.isoformat() if d.created_at else None,

            }

            for d in items

        ]





@app.post("/webhooks/dead-letter/replay")

async def trigger_dead_letter_replay(limit: int = 50):

    """Trigger programmatic replay of dead-letter webhooks."""

    from scripts.replay_webhooks import replay_dead_letter_webhooks

    asyncio.create_task(replay_dead_letter_webhooks(limit=limit, dry_run=False))

    return {"status": "replaying", "message": f"Replay initiated for up to {limit} dead-letter webhooks."}





@app.post("/webhooks/configs")

async def create_webhook_config(payload: Dict[str, Any]):

    """Register a new webhook URL and signing secret per agent or global."""

    from agent.db import WebhookConfigModel

    url = payload.get("url")

    signing_secret = payload.get("signing_secret")

    if not url or not signing_secret:

        raise HTTPException(status_code=400, detail="url and signing_secret are required.")



    db = get_db()

    async with db.session_factory() as session:

        cfg = WebhookConfigModel(

            agent_id=payload.get("agent_id"),

            url=url,

            signing_secret=signing_secret,

            is_active=payload.get("is_active", True),

            events=json.dumps(payload.get("events", ["call.started", "call.ended", "lead.captured", "callback.scheduled", "campaign.completed"])),

        )

        session.add(cfg)

        await session.commit()

        return {"status": "created", "id": cfg.id, "url": cfg.url}





@app.get("/webhooks/configs")

async def list_webhook_configs():

    """List registered webhook endpoint configurations."""

    from agent.db import WebhookConfigModel

    import sqlalchemy as sa

    db = get_db()

    async with db.session_factory() as session:

        stmt = sa.select(WebhookConfigModel)

        configs = (await session.execute(stmt)).scalars().all()

        return [

            {

                "id": c.id,

                "agent_id": c.agent_id,

                "url": c.url,

                "is_active": c.is_active,

                "events": json.loads(c.events) if c.events else [],

                "created_at": c.created_at.isoformat() if c.created_at else None,

            }

            for c in configs

        ]





# ============================================================================

# DATA GOVERNANCE & PRIVACY (TIER 1 ITEM 2)

# ============================================================================



@app.post("/calls/{call_id}/consent")

async def record_call_consent(

    call_id: str,

    payload: Dict[str, Any],

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Record consent status for call recording, callbacks, or telemarketing."""

    from agent.governance.consent import get_consent_manager

    phone = payload.get("phone", "")

    consent_type = payload.get("consent_type", "recording")

    status_str = payload.get("status", "granted")

    channel = payload.get("channel", "verbal")



    mgr = get_consent_manager()

    record = mgr.record_consent(

        call_id=call_id,

        phone=phone,

        consent_type=consent_type,

        status=status_str,

        channel=channel,

    )

    return {"status": "recorded", "consent": record}





@app.get("/recordings/{call_id}/signed-url")

async def get_recording_signed_url(

    call_id: str,

    track: str = Query(default="agent"),

    ttl_sec: int = Query(default=900),

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Generate time-limited signed URL for streaming recording audio."""

    from agent.governance.access_control import get_access_controller

    controller = get_access_controller()

    url = controller.generate_signed_url(call_id=call_id, track=track, ttl_sec=ttl_sec)

    controller.log_access(api_key.name or "api_user", "get_signed_url", f"rec_{call_id}_{track}")

    return {"signed_url": url, "expires_in_sec": ttl_sec}





@app.get("/recordings/{call_id}/stream")

async def stream_recording(

    call_id: str,

    track: str = Query(default="agent"),

    expires: int = Query(...),

    signature: str = Query(...),

):

    """Stream audio file using signed URL token validation."""

    from pathlib import Path

    from agent.governance.access_control import get_access_controller

    controller = get_access_controller()

    if not controller.verify_token(call_id=call_id, track=track, expires_at=expires, provided_signature=signature):

        raise HTTPException(status_code=403, detail="Invalid or expired recording stream token.")



    rec_path = Path("recordings") / f"{call_id}_{track}.wav"

    if not rec_path.is_file():

        rec_path = Path("recordings") / f"{call_id}.wav"

        if not rec_path.is_file():

            raise HTTPException(status_code=404, detail="Recording audio file not found on server.")



    controller.log_access("signed_url_holder", "stream_recording", f"rec_{call_id}_{track}")

    return FileResponse(rec_path, media_type="audio/wav")





@app.get("/data/{phone}/export")

async def export_data_by_phone(

    phone: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Data Subject Access / Portability: Export all data associated with phone number."""

    from agent.governance.retention import get_governance_manager

    gov_mgr = get_governance_manager()

    data = await gov_mgr.export_data_for_phone(phone=phone, db=get_db())

    return data





@app.delete("/data/{phone}")

async def delete_data_by_phone(

    phone: str,

    api_key: APIKeyModel = Depends(verify_api_key),

):

    """Right to Erasure: Purge all DB records, transcripts, and audio files for phone number."""

    from agent.governance.retention import get_governance_manager

    gov_mgr = get_governance_manager()

    res = await gov_mgr.delete_data_for_phone(phone=phone, db=get_db())

    return res





if __name__ == '__main__':

    import uvicorn

    uvicorn.run('server:app', host='0.0.0.0', port=8000, reload=False)

