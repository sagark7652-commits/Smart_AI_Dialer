-- ============================================================================
-- CALLFORGE OPS
-- COMPLETE APPLICATION DATABASE
-- MySQL 8.0+
-- ============================================================================
--
-- PURPOSE
-- ----------------------------------------------------------------------------
-- This is the production-style application schema for local development.
--
-- It supports:
--
--   1. User registration / login
--   2. User-owned campaigns
--   3. Leads
--   4. Campaign-lead relationships
--   5. Calls
--   6. AI predictions
--   7. Agents
--   8. Campaign statistics
--   9. Audit logs
--  10. Real-time-friendly timestamps
--
-- IMPORTANT
-- ----------------------------------------------------------------------------
-- MySQL stores changes immediately.
--
-- Real-time browser updates are handled by your backend using:
--
--     REST API + WebSocket
-- or
--     REST API + Server-Sent Events (SSE)
--
-- This schema is designed so those mechanisms can easily consume the
-- created_at / updated_at timestamps and database records.
--
-- ============================================================================


-- ============================================================================
-- 1. CREATE DATABASE
-- ============================================================================

CREATE DATABASE IF NOT EXISTS callforge_ops
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE callforge_ops;


-- ============================================================================
-- 2. RESET TABLES
-- ============================================================================
-- Child tables must be removed before parent tables.
--
-- WARNING:
-- This section deletes existing CallForge tables if they already exist.
-- Use this only during development/reset.
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS call_events;
DROP TABLE IF EXISTS lead_predictions;
DROP TABLE IF EXISTS calls;
DROP TABLE IF EXISTS campaign_leads;
DROP TABLE IF EXISTS leads;
DROP TABLE IF EXISTS campaign_agents;
DROP TABLE IF EXISTS agents;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================================
-- 3. USERS
-- ============================================================================
-- Stores application users.
--
-- IMPORTANT:
-- password_hash stores a HASH, not the actual password.
--
-- Example:
--
-- User enters:
--     myPassword123
--
-- Backend hashes it using bcrypt/Argon2.
--
-- Database stores something like:
--     $2b$12$....
--
-- NEVER store plain-text passwords.
-- ============================================================================

CREATE TABLE users (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    role ENUM(
        'admin',
        'manager',
        'agent',
        'viewer'
    ) NOT NULL DEFAULT 'agent',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_login_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_users_email (email),

    INDEX idx_users_role (role),

    INDEX idx_users_active (is_active),

    INDEX idx_users_created_at (created_at)

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 4. CAMPAIGNS
-- ============================================================================
-- A campaign belongs to one user.
--
-- Example:
--
-- User A creates:
--     "Enterprise Renewal Campaign"
--
-- campaigns.created_by = User A's ID
-- ============================================================================

CREATE TABLE campaigns (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    created_by BIGINT UNSIGNED NOT NULL,

    name VARCHAR(255) NOT NULL,

    description TEXT NULL,

    dialer_mode ENUM(
        'predictive',
        'progressive',
        'preview',
        'manual'
    ) NOT NULL DEFAULT 'progressive',

    status ENUM(
        'draft',
        'queued',
        'running',
        'paused',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',

    calling_window JSON NULL,

    caller_id VARCHAR(50) NULL,

    script TEXT NULL,

    total_leads INT UNSIGNED NOT NULL DEFAULT 0,

    dialed INT UNSIGNED NOT NULL DEFAULT 0,

    connected INT UNSIGNED NOT NULL DEFAULT 0,

    qualified INT UNSIGNED NOT NULL DEFAULT 0,

    failed INT UNSIGNED NOT NULL DEFAULT 0,

    started_at DATETIME NULL,

    completed_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_campaign_created_by (created_by),

    INDEX idx_campaign_status (status),

    INDEX idx_campaign_dialer_mode (dialer_mode),

    INDEX idx_campaign_created_at (created_at),

    CONSTRAINT fk_campaign_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 5. AGENTS
-- ============================================================================
-- Represents human/AI calling agents.
--
-- An agent can participate in multiple campaigns.
-- ============================================================================

CREATE TABLE agents (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NULL,

    name VARCHAR(150) NOT NULL,

    agent_type ENUM(
        'human',
        'ai'
    ) NOT NULL DEFAULT 'human',

    provider VARCHAR(100) NULL,

    external_agent_id VARCHAR(150) NULL,

    status ENUM(
        'offline',
        'available',
        'busy',
        'paused'
    ) NOT NULL DEFAULT 'offline',

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_agents_user_id (user_id),

    INDEX idx_agents_type (agent_type),

    INDEX idx_agents_status (status),

    INDEX idx_agents_active (is_active),

    CONSTRAINT fk_agents_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 6. CAMPAIGN AGENTS
-- ============================================================================
-- Many-to-many relationship:
--
-- One campaign can have many agents.
-- One agent can work on many campaigns.
--
-- campaigns
--      |
--      | 1:N
--      v
-- campaign_agents
--      ^
--      | N:1
--      |
--    agents
-- ============================================================================

CREATE TABLE campaign_agents (

    campaign_id BIGINT UNSIGNED NOT NULL,

    agent_id BIGINT UNSIGNED NOT NULL,

    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (campaign_id, agent_id),

    CONSTRAINT fk_campaign_agents_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES campaigns(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_campaign_agents_agent
        FOREIGN KEY (agent_id)
        REFERENCES agents(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 7. LEADS
-- ============================================================================
-- Stores customer/prospect information.
--
-- A lead can participate in multiple campaigns.
-- Therefore campaigns and leads are connected through campaign_leads.
-- ============================================================================

CREATE TABLE leads (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    owner_user_id BIGINT UNSIGNED NULL,

    name VARCHAR(150) NOT NULL,

    phone VARCHAR(30) NOT NULL,

    email VARCHAR(255) NULL,

    company VARCHAR(255) NULL,

    source VARCHAR(100) NULL,

    stage ENUM(
        'New',
        'Contacted',
        'Interested',
        'Callback',
        'Qualified',
        'Converted',
        'Lost',
        'DNC'
    ) NOT NULL DEFAULT 'New',

    score DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    is_dnc BOOLEAN NOT NULL DEFAULT FALSE,

    notes TEXT NULL,

    last_contacted_at DATETIME NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_leads_owner (owner_user_id),

    INDEX idx_leads_phone (phone),

    INDEX idx_leads_email (email),

    INDEX idx_leads_stage (stage),

    INDEX idx_leads_score (score),

    INDEX idx_leads_dnc (is_dnc),

    INDEX idx_leads_updated_at (updated_at),

    CONSTRAINT fk_leads_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 8. CAMPAIGN LEADS
-- ============================================================================
-- Many-to-many relationship:
--
-- One lead can belong to multiple campaigns.
-- One campaign can contain many leads.
--
-- Example:
--
-- Lead #15
--     ↓
-- Campaign A
-- Campaign B
--
-- ============================================================================

CREATE TABLE campaign_leads (

    campaign_id BIGINT UNSIGNED NOT NULL,

    lead_id BIGINT UNSIGNED NOT NULL,

    status ENUM(
        'pending',
        'queued',
        'dialed',
        'connected',
        'qualified',
        'failed',
        'completed',
        'excluded'
    ) NOT NULL DEFAULT 'pending',

    priority INT NOT NULL DEFAULT 0,

    attempts INT UNSIGNED NOT NULL DEFAULT 0,

    last_attempt_at DATETIME NULL,

    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (campaign_id, lead_id),

    INDEX idx_campaign_leads_lead (lead_id),

    INDEX idx_campaign_leads_status (status),

    INDEX idx_campaign_leads_priority (priority),

    CONSTRAINT fk_campaign_leads_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES campaigns(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_campaign_leads_lead
        FOREIGN KEY (lead_id)
        REFERENCES leads(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 9. CALLS
-- ============================================================================
-- Stores actual call records.
--
-- Relationships:
--
-- calls.campaign_id -> campaigns.id
-- calls.lead_id     -> leads.id
-- calls.agent_id    -> agents.id
--
-- ============================================================================

CREATE TABLE calls (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    campaign_id BIGINT UNSIGNED NOT NULL,

    lead_id BIGINT UNSIGNED NOT NULL,

    agent_id BIGINT UNSIGNED NULL,

    provider VARCHAR(100) NULL,

    external_call_id VARCHAR(150) NULL,

    phone VARCHAR(30) NOT NULL,

    status ENUM(
        'queued',
        'ringing',
        'in_progress',
        'completed',
        'failed',
        'no_answer',
        'busy',
        'cancelled'
    ) NOT NULL DEFAULT 'queued',

    started_at DATETIME NULL,

    ended_at DATETIME NULL,

    duration INT UNSIGNED NULL,

    recording_url TEXT NULL,

    transcript LONGTEXT NULL,

    disposition VARCHAR(100) NULL,

    sentiment ENUM(
        'positive',
        'neutral',
        'negative',
        'mixed',
        'unknown'
    ) NOT NULL DEFAULT 'unknown',

    qa_score DECIMAL(5,2) NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_calls_external_id (external_call_id),

    INDEX idx_calls_campaign (campaign_id),

    INDEX idx_calls_lead (lead_id),

    INDEX idx_calls_agent (agent_id),

    INDEX idx_calls_status (status),

    INDEX idx_calls_started_at (started_at),

    INDEX idx_calls_updated_at (updated_at),

    CONSTRAINT fk_calls_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES campaigns(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_calls_lead
        FOREIGN KEY (lead_id)
        REFERENCES leads(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_calls_agent
        FOREIGN KEY (agent_id)
        REFERENCES agents(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 10. LEAD PREDICTIONS
-- ============================================================================
-- Stores AI-generated predictions.
--
-- A lead can have multiple predictions because a new prediction can be
-- generated after new call/activity data arrives.
--
-- ============================================================================

CREATE TABLE lead_predictions (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    lead_id BIGINT UNSIGNED NOT NULL,

    lead_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    contactability_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,

    best_call_time VARCHAR(100) NULL,

    segment VARCHAR(150) NULL,

    next_best_action TEXT NOT NULL,

    model_version VARCHAR(100) NOT NULL DEFAULT 'demo-model-v1',

    confidence DECIMAL(5,4) NOT NULL DEFAULT 0.9200,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_predictions_lead (lead_id),

    INDEX idx_predictions_contactability (contactability_score),

    INDEX idx_predictions_segment (segment),

    INDEX idx_predictions_created_at (created_at),

    CONSTRAINT fk_predictions_lead
        FOREIGN KEY (lead_id)
        REFERENCES leads(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 11. CALL EVENTS
-- ============================================================================
-- Useful for real-time call state changes.
--
-- Example:
--
-- queued
--   ↓
-- ringing
--   ↓
-- in_progress
--   ↓
-- completed
--
-- Each transition can be stored as an event.
--
-- This becomes especially useful when integrating a dialer API/webhook.
-- ============================================================================

CREATE TABLE call_events (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    call_id BIGINT UNSIGNED NOT NULL,

    event_type ENUM(
        'queued',
        'ringing',
        'answered',
        'in_progress',
        'completed',
        'failed',
        'no_answer',
        'busy',
        'cancelled'
    ) NOT NULL,

    event_data JSON NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_call_events_call (call_id),

    INDEX idx_call_events_type (event_type),

    INDEX idx_call_events_created_at (created_at),

    CONSTRAINT fk_call_events_call
        FOREIGN KEY (call_id)
        REFERENCES calls(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 12. AUDIT LOGS
-- ============================================================================
-- Tracks important application actions.
--
-- Examples:
--
-- user creates campaign
-- user updates campaign
-- user imports leads
-- campaign starts
-- campaign pauses
-- prediction generated
--
-- ============================================================================

CREATE TABLE audit_logs (

    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    user_id BIGINT UNSIGNED NULL,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100) NOT NULL,

    entity_id VARCHAR(100) NULL,

    old_data JSON NULL,

    new_data JSON NULL,

    ip_address VARCHAR(45) NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_audit_user (user_id),

    INDEX idx_audit_action (action),

    INDEX idx_audit_entity (
        entity_type,
        entity_id
    ),

    INDEX idx_audit_created_at (created_at),

    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 13. DEMO USER
-- ============================================================================
-- This is ONLY a development account.
--
-- DO NOT use a real password here.
--
-- Replace password_hash with a hash generated by your backend.
--
-- For example, bcrypt/Argon2 should be used by FastAPI.
-- ============================================================================

INSERT INTO users
(
    name,
    email,
    password_hash,
    role
)
VALUES
(
    'Demo Admin',
    'admin@example.com',
    'REPLACE_WITH_BCRYPT_OR_ARGON2_HASH',
    'admin'
);


-- ============================================================================
-- 14. DEMO AGENTS
-- ============================================================================

INSERT INTO agents
(
    user_id,
    name,
    agent_type,
    provider,
    external_agent_id,
    status
)
VALUES

(
    1,
    'Demo Human Agent',
    'human',
    'demo_provider',
    'demo-human-001',
    'available'
),

(
    1,
    'Demo AI Agent',
    'ai',
    'demo_ai_provider',
    'demo-ai-001',
    'available'
);


-- ============================================================================
-- 15. DEMO CAMPAIGNS
-- ============================================================================

INSERT INTO campaigns
(
    created_by,
    name,
    description,
    dialer_mode,
    status,
    calling_window,
    caller_id,
    script
)
VALUES

(
    1,
    'Demo Enterprise Outreach',
    'Synthetic development campaign.',
    'predictive',
    'draft',
    '{"startHour": 9, "endHour": 18, "timezone": "Asia/Kolkata"}',
    '+91-90000-10001',
    'Hello, this is a CallForge demonstration call.'
);


-- ============================================================================
-- 16. DEMO LEADS
-- ============================================================================

INSERT INTO leads
(
    owner_user_id,
    name,
    phone,
    email,
    company,
    source,
    stage,
    score,
    is_dnc
)
VALUES

(
    1,
    'Demo Customer 01',
    '+91-90000-00001',
    'customer01@example.com',
    'Demo Company Alpha',
    'Website',
    'New',
    75.00,
    FALSE
),

(
    1,
    'Demo Customer 02',
    '+91-90000-00002',
    'customer02@example.com',
    'Demo Company Beta',
    'Referral',
    'Interested',
    88.00,
    FALSE
),

(
    1,
    'Demo Customer 03',
    '+91-90000-00003',
    'customer03@example.com',
    'Demo Company Gamma',
    'Website',
    'Qualified',
    92.00,
    FALSE
);


-- ============================================================================
-- 17. ASSIGN LEADS TO CAMPAIGN
-- ============================================================================

INSERT INTO campaign_leads
(
    campaign_id,
    lead_id,
    status,
    priority
)
VALUES

(
    1,
    1,
    'pending',
    10
),

(
    1,
    2,
    'pending',
    20
),

(
    1,
    3,
    'pending',
    30
);


-- ============================================================================
-- 18. ASSIGN AGENTS TO CAMPAIGN
-- ============================================================================

INSERT INTO campaign_agents
(
    campaign_id,
    agent_id
)
VALUES

(
    1,
    1
),

(
    1,
    2
);


-- ============================================================================
-- 19. DEMO CALL
-- ============================================================================

INSERT INTO calls
(
    campaign_id,
    lead_id,
    agent_id,
    provider,
    external_call_id,
    phone,
    status,
    started_at,
    ended_at,
    duration,
    recording_url,
    transcript,
    disposition,
    sentiment,
    qa_score
)
VALUES

(
    1,
    1,
    2,
    'demo_provider',
    'demo-call-001',
    '+91-90000-00001',
    'completed',
    NOW() - INTERVAL 1 HOUR,
    NOW() - INTERVAL 1 HOUR + INTERVAL 120 SECOND,
    120,
    'https://example.com/demo-recording.mp3',
    'Agent: Hello, this is a CallForge demonstration call.
Customer: Hello.
Agent: Thank you for your time.',
    'Interested',
    'positive',
    92.00
);


-- ============================================================================
-- 20. DEMO CALL EVENT
-- ============================================================================

INSERT INTO call_events
(
    call_id,
    event_type,
    event_data
)
VALUES

(
    1,
    'completed',
    '{"source":"demo","message":"Demo call completed"}'
);


-- ============================================================================
-- 21. DEMO AI PREDICTION
-- ============================================================================

INSERT INTO lead_predictions
(
    lead_id,
    lead_score,
    contactability_score,
    best_call_time,
    segment,
    next_best_action,
    model_version,
    confidence
)
VALUES

(
    1,
    92.00,
    94.00,
    '11:00 AM - 01:00 PM IST',
    'High-Value Prospect',
    'Prioritize lead for follow-up conversation.',
    'demo-model-v1',
    0.9500
);


-- ============================================================================
-- 22. VALIDATION
-- ============================================================================

SELECT 'USERS' AS table_name, COUNT(*) AS records
FROM users

UNION ALL

SELECT 'CAMPAIGNS', COUNT(*)
FROM campaigns

UNION ALL

SELECT 'AGENTS', COUNT(*)
FROM agents

UNION ALL

SELECT 'LEADS', COUNT(*)
FROM leads

UNION ALL

SELECT 'CAMPAIGN_LEADS', COUNT(*)
FROM campaign_leads

UNION ALL

SELECT 'CALLS', COUNT(*)
FROM calls

UNION ALL

SELECT 'CALL_EVENTS', COUNT(*)
FROM call_events

UNION ALL

SELECT 'LEAD_PREDICTIONS', COUNT(*)
FROM lead_predictions

UNION ALL

SELECT 'AUDIT_LOGS', COUNT(*)
FROM audit_logs;


-- ============================================================================
-- 23. COMPLETE RELATIONSHIP QUERY
-- ============================================================================
-- This demonstrates how the application can retrieve the complete picture.
-- ============================================================================

SELECT

    c.id AS campaign_id,

    c.name AS campaign_name,

    c.status AS campaign_status,

    l.id AS lead_id,

    l.name AS lead_name,

    l.company,

    l.stage AS lead_stage,

    l.score AS lead_score,

    cl.status AS campaign_lead_status,

    cl.priority,

    call_data.call_id,

    call_data.call_status,

    call_data.duration,

    p.contactability_score,

    p.segment,

    p.best_call_time,

    p.next_best_action,

    p.confidence

FROM campaigns c

LEFT JOIN campaign_leads cl
    ON c.id = cl.campaign_id

LEFT JOIN leads l
    ON cl.lead_id = l.id

LEFT JOIN
(
    SELECT
        ca.id AS call_id,
        ca.campaign_id,
        ca.lead_id,
        ca.status AS call_status,
        ca.duration
    FROM calls ca
) AS call_data
    ON call_data.campaign_id = c.id
    AND call_data.lead_id = l.id

LEFT JOIN lead_predictions p
    ON p.lead_id = l.id

ORDER BY c.id, l.id;


-- ============================================================================
-- 24. USER -> CAMPAIGNS QUERY
-- ============================================================================
-- Useful for the logged-in user's dashboard.
-- ============================================================================

SELECT

    u.id AS user_id,

    u.name AS user_name,

    u.email,

    c.id AS campaign_id,

    c.name AS campaign_name,

    c.status,

    c.total_leads,

    c.dialed,

    c.connected,

    c.qualified,

    c.failed,

    c.created_at,

    c.updated_at

FROM users u

LEFT JOIN campaigns c
    ON c.created_by = u.id

ORDER BY c.created_at DESC;


-- ============================================================================
-- END OF CALLFORGE OPS SCHEMA
-- ============================================================================
