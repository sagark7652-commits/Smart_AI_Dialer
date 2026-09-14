# CallForge Ops — MVP handoff

CallForge Ops is an India-first calling operations console inspired by the shared CreatorAI Calling Agent specification and products such as Tata Smartflo, Exotel, and Ozonetel. The current build intentionally starts with the operator experience: a polished workspace where a team can understand performance, manage campaigns, review leads, configure AI voice agents, supervise live calls, inspect analytics, and monitor compliance readiness.

## Implemented in this build

The application is a full-stack WebDev project with React, Tailwind, Express, tRPC, Drizzle, storage, and Manus authentication scaffolding already enabled. The main experience is a responsive dark operations console with a compact desktop sidebar and an icon rail on mobile.

The Overview screen includes KPI cards, calls-over-time activity, live floor metrics, campaign health, recent activity, a pause/resume dialer control, and export/new-campaign actions. The Campaigns screen includes campaign cards, status filters, CSV-import affordances, progress metrics, caller-ID context, and navigation into the live console. Leads includes searchable contact data with sources, stages, AI scores, and lead actions. AI agents includes a voice library, agent selection, voice-preview treatment, objective/opening-line/guardrail configuration, knowledge-base state, and a simulated test-call action. Live calls includes active-call monitoring, sentiment, AI confidence, supervisor whisper actions, queue metrics, and floor insights. Analytics includes a conversion funnel and disposition mix. Compliance includes readiness scoring, calling-hour/DNC/disclosure checks, renewal warnings, and an audit trail.

All key buttons have demo-safe behavior with toast feedback. No action initiates a real outbound call, sends a message, changes an external account, or pretends that a carrier is connected.

## Deliberate changes from the PDF

The specification describes a production telephony platform spanning two distinct layers: cloud contact-center orchestration and autonomous AI voice. Building every telephony primitive in one first pass would create a high-risk demo that implies production readiness without carrier credentials, regulatory registration, number inventory, or voice-platform configuration.

This build therefore ships the control-plane UX first, with explicit adapter points for the next phase. That gives a user a coherent product to review and lets the implementation connect to a carrier or CPaaS later without redesigning the information architecture. The first integrations should be selected based on India number availability, DLT workflow support, recording/transcription capabilities, concurrency limits, and webhook coverage.

## Next production phase

1. Add organization, workspace membership, campaign, lead, call, disposition, agent, policy, and audit tables to the Drizzle schema.
2. Add protected tRPC procedures for campaign CRUD, lead import/de-duplication, DNC suppression, disposition updates, callback scheduling, and dashboard aggregates.
3. Connect a CPaaS/carrier adapter for number provisioning, outbound calls, recording callbacks, AMD, caller-ID pools, click-to-call, and inbound routing.
4. Connect a voice-agent provider adapter for streaming STT → LLM → TTS, barge-in, multilingual voices, warm transfer, voicemail drop, and post-call artifacts.
5. Connect transcription and structured conversation intelligence for summaries, sentiment, QA scoring, next-best action, and lead-note updates.
6. Add India compliance enforcement as server-side policy: calling hours in lead timezone, DNC registry/suppression checks, locked disclosure preamble, number-series rules, consent evidence, recording retention, and audit exports.
7. Add webhook verification, idempotency keys, provider retry handling, signed recording URLs, and a background queue. The production runtime should use managed persistent hosting for realtime WebSocket/SSE and queue workers rather than relying on a short-lived request.

## Important production note

The current data on the screen is demo data so the product can be reviewed without external credentials. A real dialer must not be enabled until telephony numbers, DLT registration, consent policy, provider webhooks, recording retention, and organization-level access controls are configured and tested.

## Verification

- `pnpm check` passes.
- `pnpm build` passes.
- `pnpm test` passes with the scaffolded authentication test.
- Desktop and mobile preview screenshots were captured successfully.
