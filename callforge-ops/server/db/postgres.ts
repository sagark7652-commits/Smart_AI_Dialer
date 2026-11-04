/**
 * PostgreSQL Database Connection & Call Persistence Module
 * Connects to PostgreSQL to store call records with transcripts, summaries, and customer feedback.
 */

export interface PostgresCallInsert {
  externalCallId?: string;
  provider?: string;
  phone: string;
  customerName?: string;
  status?: string;
  startedAt?: Date | string;
  endedAt?: Date | string;
  durationSeconds?: number;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  customerFeedback?: string;
  extractedData?: Record<string, any>;
  disposition?: string;
  sentiment?: string;
  qaScore?: number;
  campaignId?: number | null;
  leadId?: number | null;
  agentId?: number | null;
}

let pool: any = null;
let isInitialized = false;

/**
 * Returns or initializes a PostgreSQL Pool.
 * Dynamically imports 'pg' so that the server remains resilient in environments
 * before 'pg' is installed.
 */
export async function getPostgresPool() {
  if (pool) return pool;

  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    (process.env.PGHOST
      ? `postgres://${process.env.PGUSER || "postgres"}:${encodeURIComponent(process.env.PGPASSWORD || "")}@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || "callforge_ops"}`
      : null);

  if (!connectionString) {
    return null;
  }

  try {
    // @ts-ignore
    const pgModule = await import("pg");
    const { Pool } = (pgModule.default || pgModule) as any;

    pool = new Pool({
      connectionString,
      ssl: process.env.PGSSLMODE === "require" || (connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : false),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err: any) => {
      console.warn("[PostgreSQL] Unexpected pool error:", err.message);
    });

    await ensureSchema();
    return pool;
  } catch (err: any) {
    console.warn("[PostgreSQL] Driver 'pg' or connection unavailable:", err.message);
    return null;
  }
}

/**
 * Ensures the 'calls' table has the summary, customer_feedback, and extracted_data columns.
 */
async function ensureSchema() {
  if (isInitialized || !pool) return;
  try {
    const client = await pool.connect();
    try {
      // 1. Create table if not exists with summary columns
      await client.query(`
        CREATE TABLE IF NOT EXISTS calls (
          id BIGSERIAL PRIMARY KEY,
          campaign_id BIGINT NULL,
          lead_id BIGINT NULL,
          agent_id BIGINT NULL,
          provider VARCHAR(100) DEFAULT 'tata_smartflo',
          external_call_id VARCHAR(255) UNIQUE,
          phone VARCHAR(30) NOT NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'completed',
          started_at TIMESTAMPTZ,
          ended_at TIMESTAMPTZ,
          duration INTEGER DEFAULT 0,
          recording_url TEXT,
          transcript TEXT,
          summary TEXT,
          customer_feedback TEXT,
          extracted_data JSONB,
          disposition VARCHAR(100),
          sentiment VARCHAR(20) DEFAULT 'neutral',
          qa_score NUMERIC(5,2),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Add columns if table already existed without them
      await client.query(`
        ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary TEXT;
        ALTER TABLE calls ADD COLUMN IF NOT EXISTS customer_feedback TEXT;
        ALTER TABLE calls ADD COLUMN IF NOT EXISTS extracted_data JSONB;
        ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript TEXT;
        ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
      `);

      // 3. Create index for fast phone & status lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_calls_phone ON calls(phone);
        CREATE INDEX IF NOT EXISTS idx_calls_external_id ON calls(external_call_id);
        CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
      `);

      isInitialized = true;
      console.log("[PostgreSQL] 'calls' schema verified (with summary & feedback columns).");
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("[PostgreSQL] Schema verification skipped or failed:", err.message);
  }
}

/**
 * Persists a completed call with its text summary and customer feedback into PostgreSQL.
 */
export async function saveCallToPostgres(
  call: PostgresCallInsert
): Promise<{ success: boolean; id?: number | string; error?: string }> {
  try {
    const clientPool = await getPostgresPool();
    if (!clientPool) {
      return { success: false, error: "PostgreSQL pool is not configured or available." };
    }

    const query = `
      INSERT INTO calls (
        external_call_id,
        provider,
        phone,
        status,
        started_at,
        ended_at,
        duration,
        recording_url,
        transcript,
        summary,
        customer_feedback,
        extracted_data,
        disposition,
        sentiment,
        qa_score,
        campaign_id,
        lead_id,
        agent_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (external_call_id) DO UPDATE SET
        summary = EXCLUDED.summary,
        customer_feedback = EXCLUDED.customer_feedback,
        extracted_data = EXCLUDED.extracted_data,
        transcript = EXCLUDED.transcript,
        duration = EXCLUDED.duration,
        status = EXCLUDED.status,
        recording_url = COALESCE(EXCLUDED.recording_url, calls.recording_url),
        sentiment = EXCLUDED.sentiment,
        qa_score = EXCLUDED.qa_score,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id;
    `;

    const values = [
      call.externalCallId || null,
      call.provider || "tata_smartflo",
      call.phone,
      call.status || "completed",
      call.startedAt ? new Date(call.startedAt) : new Date(),
      call.endedAt ? new Date(call.endedAt) : new Date(),
      call.durationSeconds || 0,
      call.recordingUrl || null,
      call.transcript || null,
      call.summary || null,
      call.customerFeedback || null,
      call.extractedData ? JSON.stringify(call.extractedData) : null,
      call.disposition || "Completed",
      call.sentiment || "neutral",
      call.qaScore || null,
      call.campaignId || null,
      call.leadId || null,
      call.agentId || null,
    ];

    const res = await clientPool.query(query, values);
    const insertedId = res.rows[0]?.id;

    console.log(`[PostgreSQL] Call record saved. ID: ${insertedId}, Summary length: ${call.summary?.length || 0}`);
    return { success: true, id: insertedId };
  } catch (err: any) {
    console.error("[PostgreSQL] Error saving call record:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch recent call summaries directly from PostgreSQL
 */
export async function getCallSummariesFromPostgres(limit = 50) {
  try {
    const clientPool = await getPostgresPool();
    if (!clientPool) return [];

    const query = `
      SELECT 
        id,
        external_call_id AS "callId",
        provider,
        phone,
        status,
        duration,
        summary,
        customer_feedback AS "customerFeedback",
        transcript,
        recording_url AS "recordingUrl",
        sentiment,
        qa_score AS "qaScore",
        created_at AS "createdAt"
      FROM calls
      WHERE summary IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $1;
    `;
    const res = await clientPool.query(query, [limit]);
    return res.rows;
  } catch (err: any) {
    console.warn("[PostgreSQL] Could not fetch call summaries:", err.message);
    return [];
  }
}
