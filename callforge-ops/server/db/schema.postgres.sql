-- ============================================================================
-- CallForge Ops — PostgreSQL Database Schema
-- Task 1.1: leads
-- Task 1.2: calls
-- Task 1.3: campaigns
-- Task 1.4: lead_predictions
-- ============================================================================

-- Create database if not already created (Run in postgres terminal if needed):
-- CREATE DATABASE callforge_ops;

-- Connect to database:
-- \c callforge_ops;

-- Enable UUID extension (optional, works with gen_random_uuid in PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Task 1.3: campaigns table
-- (Created first so calls can reference campaigns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    dialer_mode VARCHAR(50) NOT NULL DEFAULT 'progressive', -- 'preview' | 'progressive' | 'predictive' | 'blast'
    status VARCHAR(50) NOT NULL DEFAULT 'queued',          -- 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled'
    calling_window JSONB DEFAULT '{"startHour": 9, "endHour": 21, "timezone": "Asia/Kolkata"}'::jsonb,
    caller_id VARCHAR(50) NOT NULL DEFAULT '+91-140-998822',
    script TEXT,
    total_leads INTEGER NOT NULL DEFAULT 0,
    dialed INTEGER NOT NULL DEFAULT 0,
    connected INTEGER NOT NULL DEFAULT 0,
    qualified INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================================================
-- Task 1.1: leads table
-- ============================================================================
CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255),
    company VARCHAR(255),
    source VARCHAR(100) DEFAULT 'Manual Entry',
    stage VARCHAR(50) NOT NULL DEFAULT 'New', -- 'New' | 'Interested' | 'Callback' | 'Converted' | 'Not Interested' | 'DNC'
    score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
    is_dnc BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_is_dnc ON leads(is_dnc);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

-- ============================================================================
-- Task 1.2: calls table
-- ============================================================================
CREATE TABLE IF NOT EXISTS calls (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) REFERENCES campaigns(id) ON DELETE SET NULL,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'tata_smartflo', -- 'tata_smartflo' | 'exotel' | 'twilio' | 'bolna' | 'mock'
    phone VARCHAR(50) NOT NULL,
    agent_id VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'ringing',         -- 'ringing' | 'in_progress' | 'completed' | 'busy' | 'no_answer' | 'failed' | 'abandoned'
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER NOT NULL DEFAULT 0,                   -- Duration in seconds
    recording_url TEXT,
    transcript TEXT,
    disposition VARCHAR(100),                              -- 'Interested' | 'Callback Requested' | 'Not Interested' | 'Wrong Number'
    sentiment VARCHAR(50) DEFAULT 'neutral',               -- 'positive' | 'neutral' | 'negative'
    qa_score NUMERIC(5, 2) CHECK (qa_score >= 0 AND qa_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_calls_lead_id ON calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id ON calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_calls_phone ON calls(phone);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at DESC);

-- ============================================================================
-- Task 1.4: lead_predictions table (AI Prediction Engine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_predictions (
    id VARCHAR(64) PRIMARY KEY,
    lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    lead_score INTEGER NOT NULL CHECK (lead_score >= 0 AND lead_score <= 100),
    contactability_score INTEGER NOT NULL CHECK (contactability_score >= 0 AND contactability_score <= 100),
    best_call_time VARCHAR(100) NOT NULL,                  -- e.g. "11:30 AM - 01:00 PM IST"
    segment VARCHAR(100) NOT NULL,                         -- e.g. "High Net-Worth Enterprise" | "Retail Micro-Loan"
    next_best_action TEXT NOT NULL,                        -- e.g. "Trigger Festive Loan Renewal Pitch via Tata Dialer"
    model_version VARCHAR(50) NOT NULL DEFAULT 'nemotron-voice-v2.4',
    confidence NUMERIC(5, 2) NOT NULL DEFAULT 0.92,        -- e.g. 0.94 (94% confidence)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predictions_lead_id ON lead_predictions(lead_id);
CREATE INDEX IF NOT EXISTS idx_predictions_contactability ON lead_predictions(contactability_score DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_segment ON lead_predictions(segment);

-- ============================================================================
-- Seed Sample Data (For Instant Validation in CallForge Ops)
-- ============================================================================
INSERT INTO campaigns (id, name, dialer_mode, status, calling_window, caller_id, script, total_leads, dialed, connected, qualified, failed)
VALUES 
    ('camp_01', 'Tata Smartflo Q4 Enterprise Renewal', 'predictive', 'running', '{"startHour": 9, "endHour": 21, "timezone": "Asia/Kolkata"}'::jsonb, '+91-22-66001234', 'Namaste, calling from Tata Dialer Voice Services regarding your festive loan pre-approval.', 500, 240, 185, 92, 12),
    ('camp_02', 'High-Touch SMB Growth Calling', 'progressive', 'queued', '{"startHour": 10, "endHour": 19, "timezone": "Asia/Kolkata"}'::jsonb, '+91-140-998822', 'Hello, this is CallForge Ops regarding cloud calling packages.', 250, 0, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads (id, name, phone, email, company, source, stage, score, is_dnc)
VALUES
    ('lead_01', 'Sanjay Singhania', '+91 98201 12345', 'sanjay@singhaniacorp.in', 'Singhania Logistics', 'Website Inbound', 'Interested', 94, FALSE),
    ('lead_02', 'Vikram Malhotra', '+91 97110 54321', 'vikram@malhotratech.com', 'Malhotra Enterprises', 'Tata Smartflo Trunk', 'Callback', 88, FALSE),
    ('lead_03', 'Ratan Tata', '+91 98203 77889', 'contact@bombayhouse.com', 'Bombay House Group', 'Enterprise Partner', 'Converted', 98, FALSE),
    ('lead_04', 'Anita Deshmukh', '+91 98450 67890', 'anita.d@puneauto.org', 'Deshmukh Auto Components', 'Trade Fair 2026', 'New', 72, FALSE),
    ('lead_05', 'Rajesh Kothari', '+91 91234 56789', 'rajesh@kotharifin.in', 'Kothari Capital', 'Direct Dial', 'DNC', 20, TRUE)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO calls (id, campaign_id, lead_id, provider, phone, agent_id, status, started_at, ended_at, duration, recording_url, transcript, disposition, sentiment, qa_score)
VALUES
    ('call_01', 'camp_01', 'lead_01', 'tata_smartflo', '+91 98201 12345', 'nv_agent_asha', 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '145 seconds', 145, 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3', 'Agent: Namaste Sanjay ji, Tata Smartflo se baat kar rahe hain.\nCustomer: Haan ji, loan balance bata dijiye.\nAgent: Aapka current balance ₹50,000 hai.', 'Interested', 'positive', 94.50),
    ('call_02', 'camp_01', 'lead_02', 'tata_smartflo', '+91 97110 54321', 'nv_agent_arjun', 'completed', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours' + INTERVAL '62 seconds', 62, 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3', 'Customer: Main abhi meeting mein hoon, 4 baje call karein.\nAgent: Bilkul sir, callback schedule kar diya hai.', 'Callback Requested', 'neutral', 88.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO lead_predictions (id, lead_id, lead_score, contactability_score, best_call_time, segment, next_best_action, model_version, confidence)
VALUES
    ('pred_01', 'lead_01', 94, 96, '11:00 AM - 01:00 PM IST', 'Tier-1 High Net-Worth Corporate', 'Deliver ₹50,000 Loan Pre-approved Renewal Pitch via Tata Dialer', 'nemotron-voice-v2.4', 0.96),
    ('pred_02', 'lead_02', 88, 89, '04:00 PM - 05:30 PM IST', 'Mid-Market Technology Founder', 'Trigger 4 PM Scheduled Callback with WhatsApp Brochure Follow-up', 'nemotron-voice-v2.4', 0.91),
    ('pred_03', 'lead_03', 98, 92, '02:30 PM - 04:00 PM IST', 'Enterprise Strategic Conglomerate', 'Connect Executive Voice Bot with Senior Relationship Manager Warm Transfer', 'nemotron-voice-v2.4', 0.99),
    ('pred_04', 'lead_04', 72, 78, '10:00 AM - 11:30 AM IST', 'Regional Automotive Supplier', 'Automated Hindi/Marathi Voice Discovery via Riva Magpie', 'nemotron-voice-v2.4', 0.84)
ON CONFLICT (id) DO NOTHING;
