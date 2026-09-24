
-- ============================================================
-- CALLFORGE OPS - POSTGRESQL DATABASE SCHEMA
-- PostgreSQL 14+
-- ============================================================

-- Create database separately if needed we may use any of mysql or postgres:
-- CREATE DATABASE callforge_ops;

-- Then connect to callforge_ops and run everything below.

-- ============================================================
-- 1. CLEANUP
-- ============================================================

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS call_events CASCADE;
DROP TABLE IF EXISTS lead_predictions CASCADE;
DROP TABLE IF EXISTS calls CASCADE;
DROP TABLE IF EXISTS campaign_leads CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS campaign_agents CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ============================================================
-- 2. USERS
-- ============================================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'agent'
        CHECK (role IN ('admin', 'manager', 'agent', 'viewer')),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    last_login_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role
    ON users(role);

CREATE INDEX idx_users_active
    ON users(is_active);

CREATE INDEX idx_users_created_at
    ON users(created_at);


-- ============================================================
-- 3. CAMPAIGNS
-- ============================================================

CREATE TABLE campaigns (
    id BIGSERIAL PRIMARY KEY,

    created_by BIGINT NOT NULL,

    name VARCHAR(200) NOT NULL,

    description TEXT,

    dialer_mode VARCHAR(20) NOT NULL DEFAULT 'progressive'
        CHECK (
            dialer_mode IN (
                'predictive',
                'progressive',
                'preview',
                'manual'
            )
        ),

    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'queued',
                'running',
                'paused',
                'completed',
                'cancelled'
            )
        ),

    calling_window JSONB,

    caller_id VARCHAR(50),

    script TEXT,

    total_leads INTEGER NOT NULL DEFAULT 0
        CHECK (total_leads >= 0),

    dialed INTEGER NOT NULL DEFAULT 0
        CHECK (dialed >= 0),

    connected INTEGER NOT NULL DEFAULT 0
        CHECK (connected >= 0),

    qualified INTEGER NOT NULL DEFAULT 0
        CHECK (qualified >= 0),

    failed INTEGER NOT NULL DEFAULT 0
        CHECK (failed >= 0),

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_campaign_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_campaigns_created_by
    ON campaigns(created_by);

CREATE INDEX idx_campaigns_status
    ON campaigns(status);

CREATE INDEX idx_campaigns_dialer_mode
    ON campaigns(dialer_mode);

CREATE INDEX idx_campaigns_created_at
    ON campaigns(created_at);


-- ============================================================
-- 4. AGENTS
-- ============================================================

CREATE TABLE agents (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT,

    name VARCHAR(150) NOT NULL,

    agent_type VARCHAR(20) NOT NULL DEFAULT 'human'
        CHECK (agent_type IN ('human', 'ai')),

    provider VARCHAR(100),

    external_agent_id VARCHAR(255),

    status VARCHAR(20) NOT NULL DEFAULT 'offline'
        CHECK (
            status IN (
                'offline',
                'available',
                'busy',
                'paused'
            )
        ),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_agent_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_agents_user_id
    ON agents(user_id);

CREATE INDEX idx_agents_status
    ON agents(status);

CREATE INDEX idx_agents_type
    ON agents(agent_type);

CREATE INDEX idx_agents_active
    ON agents(is_active);


-- ============================================================
-- 5. CAMPAIGN ↔ AGENTS
-- Many-to-many relationship
-- ============================================================

CREATE TABLE campaign_agents (
    campaign_id BIGINT NOT NULL,

    agent_id BIGINT NOT NULL,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

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
);

CREATE INDEX idx_campaign_agents_agent
    ON campaign_agents(agent_id);


-- ============================================================
-- 6. LEADS
-- ============================================================

CREATE TABLE leads (
    id BIGSERIAL PRIMARY KEY,

    owner_user_id BIGINT,

    name VARCHAR(150) NOT NULL,

    phone VARCHAR(30),

    email VARCHAR(255),

    company VARCHAR(200),

    source VARCHAR(100),

    stage VARCHAR(30) NOT NULL DEFAULT 'New'
        CHECK (
            stage IN (
                'New',
                'Contacted',
                'Interested',
                'Callback',
                'Qualified',
                'Converted',
                'Lost',
                'DNC'
            )
        ),

    score NUMERIC(5,2)
        CHECK (score >= 0 AND score <= 100),

    is_dnc BOOLEAN NOT NULL DEFAULT FALSE,

    notes TEXT,

    last_contacted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lead_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_leads_owner
    ON leads(owner_user_id);

CREATE INDEX idx_leads_phone
    ON leads(phone);

CREATE INDEX idx_leads_email
    ON leads(email);

CREATE INDEX idx_leads_stage
    ON leads(stage);

CREATE INDEX idx_leads_score
    ON leads(score);

CREATE INDEX idx_leads_dnc
    ON leads(is_dnc);

CREATE INDEX idx_leads_updated_at
    ON leads(updated_at);


-- ============================================================
-- 7. CAMPAIGN ↔ LEADS
-- Many-to-many relationship
-- ============================================================

CREATE TABLE campaign_leads (
    campaign_id BIGINT NOT NULL,

    lead_id BIGINT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'queued',
                'dialed',
                'connected',
                'qualified',
                'failed',
                'completed',
                'excluded'
            )
        ),

    priority INTEGER NOT NULL DEFAULT 0,

    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),

    last_attempt_at TIMESTAMPTZ,

    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (campaign_id, lead_id),

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
);

CREATE INDEX idx_campaign_leads_lead
    ON campaign_leads(lead_id);

CREATE INDEX idx_campaign_leads_status
    ON campaign_leads(status);

CREATE INDEX idx_campaign_leads_priority
    ON campaign_leads(priority);


-- ============================================================
-- 8. CALLS
-- ============================================================

CREATE TABLE calls (
    id BIGSERIAL PRIMARY KEY,

    campaign_id BIGINT NOT NULL,

    lead_id BIGINT NOT NULL,

    agent_id BIGINT,

    provider VARCHAR(100),

    external_call_id VARCHAR(255) UNIQUE,

    phone VARCHAR(30),

    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (
            status IN (
                'queued',
                'ringing',
                'in_progress',
                'completed',
                'failed',
                'no_answer',
                'busy',
                'cancelled'
            )
        ),

    started_at TIMESTAMPTZ,

    ended_at TIMESTAMPTZ,

    duration INTEGER
        CHECK (duration IS NULL OR duration >= 0),

    recording_url TEXT,

    transcript TEXT,

    disposition VARCHAR(100),

    sentiment VARCHAR(20)
        CHECK (
            sentiment IS NULL OR
            sentiment IN (
                'positive',
                'neutral',
                'negative',
                'mixed',
                'unknown'
            )
        ),

    qa_score NUMERIC(5,2)
        CHECK (
            qa_score IS NULL OR
            (qa_score >= 0 AND qa_score <= 100)
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_call_campaign
        FOREIGN KEY (campaign_id)
        REFERENCES campaigns(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_call_lead
        FOREIGN KEY (lead_id)
        REFERENCES leads(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_call_agent
        FOREIGN KEY (agent_id)
        REFERENCES agents(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_calls_campaign
    ON calls(campaign_id);

CREATE INDEX idx_calls_lead
    ON calls(lead_id);

CREATE INDEX idx_calls_agent
    ON calls(agent_id);

CREATE INDEX idx_calls_status
    ON calls(status);

CREATE INDEX idx_calls_created_at
    ON calls(created_at);


-- ============================================================
-- 9. LEAD AI PREDICTIONS
-- ============================================================

CREATE TABLE lead_predictions (
    id BIGSERIAL PRIMARY KEY,

    lead_id BIGINT NOT NULL,

    lead_score NUMERIC(5,2)
        CHECK (
            lead_score >= 0 AND
            lead_score <= 100
        ),

    contactability_score NUMERIC(5,2)
        CHECK (
            contactability_score >= 0 AND
            contactability_score <= 100
        ),

    best_call_time VARCHAR(100),

    segment VARCHAR(100),

    next_best_action VARCHAR(255),

    model_version VARCHAR(100),

    confidence NUMERIC(5,4)
        CHECK (
            confidence >= 0 AND
            confidence <= 1
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_prediction_lead
        FOREIGN KEY (lead_id)
        REFERENCES leads(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_predictions_lead
    ON lead_predictions(lead_id);

CREATE INDEX idx_predictions_created_at
    ON lead_predictions(created_at);


-- ============================================================
-- 10. CALL EVENTS
-- Stores complete call state history
-- ============================================================

CREATE TABLE call_events (
    id BIGSERIAL PRIMARY KEY,

    call_id BIGINT NOT NULL,

    event_type VARCHAR(30) NOT NULL
        CHECK (
            event_type IN (
                'queued',
                'ringing',
                'answered',
                'in_progress',
                'completed',
                'failed',
                'no_answer',
                'busy',
                'cancelled'
            )
        ),

    event_data JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_call_event_call
        FOREIGN KEY (call_id)
        REFERENCES calls(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_call_events_call
    ON call_events(call_id);

CREATE INDEX idx_call_events_type
    ON call_events(event_type);

CREATE INDEX idx_call_events_created_at
    ON call_events(created_at);


-- ============================================================
-- 11. AUDIT LOGS
-- Tracks important user/application changes
-- ============================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT,

    action VARCHAR(100) NOT NULL,

    entity_type VARCHAR(100),

    entity_id BIGINT,

    old_data JSONB,

    new_data JSONB,

    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_audit_user
    ON audit_logs(user_id);

CREATE INDEX idx_audit_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_created_at
    ON audit_logs(created_at);


-- ============================================================
-- 12. UPDATED_AT TRIGGER
-- Automatically updates updated_at whenever a row changes
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_campaigns_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_agents_updated_at
BEFORE UPDATE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_campaign_leads_updated_at
BEFORE UPDATE ON campaign_leads
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_calls_updated_at
BEFORE UPDATE ON calls
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 13. DEMO DATA
-- Synthetic data only
-- ============================================================

INSERT INTO users
    (name, email, password_hash, role)
VALUES
    (
        'Demo Admin',
        'admin@example.com',
        'REPLACE_WITH_BCRYPT_OR_ARGON2_HASH',
        'admin'
    );


INSERT INTO agents
    (name, agent_type, provider, status)
VALUES
    (
        'Demo Human Agent',
        'human',
        NULL,
        'available'
    ),
    (
        'Demo AI Agent',
        'ai',
        'internal',
        'available'
    );


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
        'Demo Outbound Campaign',
        'Synthetic campaign for local development',
        'progressive',
        'draft',
        '{"start":"09:00","end":"18:00","timezone":"Asia/Kolkata"}',
        '+910000000000',
        'Demo call script'
    );


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
        is_dnc,
        notes
    )
VALUES
    (
        1,
        'Demo Lead One',
        '+910000000001',
        'lead1@example.com',
        'Example Company',
        'website',
        'New',
        82.50,
        FALSE,
        'Synthetic demo lead'
    ),
    (
        1,
        'Demo Lead Two',
        '+910000000002',
        'lead2@example.com',
        'Sample Industries',
        'import',
        'Interested',
        74.20,
        FALSE,
        'Synthetic demo lead'
    );


INSERT INTO campaign_agents
    (campaign_id, agent_id)
VALUES
    (1, 1),
    (1, 2);


INSERT INTO campaign_leads
    (
        campaign_id,
        lead_id,
        status,
        priority
    )
VALUES
    (1, 1, 'pending', 10),
    (1, 2, 'pending', 5);


INSERT INTO calls
    (
        campaign_id,
        lead_id,
        agent_id,
        provider,
        phone,
        status,
        disposition,
        sentiment
    )
VALUES
    (
        1,
        1,
        1,
        'local-demo',
        '+910000000001',
        'completed',
        'interested',
        'positive'
    );


INSERT INTO call_events
    (
        call_id,
        event_type,
        event_data
    )
VALUES
    (
        1,
        'queued',
        '{"source":"local-demo"}'
    ),
    (
        1,
        'answered',
        '{"source":"local-demo"}'
    ),
    (
        1,
        'completed',
        '{"source":"local-demo"}'
    );


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
        86.40,
        78.20,
        '10:00-12:00',
        'high_intent',
        'Call within 24 hours',
        'demo-v1',
        0.9125
    );


-- ============================================================
-- 14. VALIDATION QUERIES
-- ============================================================

-- Users
SELECT * FROM users;

-- Campaigns
SELECT * FROM campaigns;

-- Agents
SELECT * FROM agents;

-- Leads
SELECT * FROM leads;

-- Campaign + leads
SELECT
    c.name AS campaign,
    l.name AS lead,
    cl.status,
    cl.priority
FROM campaign_leads cl
JOIN campaigns c
    ON c.id = cl.campaign_id
JOIN leads l
    ON l.id = cl.lead_id;

-- Calls
SELECT
    c.id,
    camp.name AS campaign,
    l.name AS lead,
    a.name AS agent,
    c.status,
    c.sentiment
FROM calls c
JOIN campaigns camp
    ON camp.id = c.campaign_id
JOIN leads l
    ON l.id = c.lead_id
LEFT JOIN agents a
    ON a.id = c.agent_id;

-- AI predictions
SELECT
    l.name,
    p.lead_score,
    p.contactability_score,
    p.segment,
    p.next_best_action
FROM lead_predictions p
JOIN leads l
    ON l.id = p.lead_id;

-- Call event history
SELECT
    ce.call_id,
    ce.event_type,
    ce.event_data,
    ce.created_at
FROM call_events ce
ORDER BY ce.created_at;
