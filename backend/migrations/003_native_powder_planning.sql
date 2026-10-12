CREATE TABLE IF NOT EXISTS powder_reuse_plans(
 id BIGSERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),tenant_id TEXT NOT NULL,
 lot_id TEXT NOT NULL,material TEXT,reuse_cycle INTEGER,virgin_blend_pct NUMERIC,moisture_ppm NUMERIC,
 tensile_risk TEXT NOT NULL DEFAULT 'unknown' CHECK(tensile_risk IN('unknown','low','medium','high')),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','needs_review','cancelled')),
 notes TEXT,idempotency_key TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,tenant_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS powder_reuse_actor ON powder_reuse_plans(user_id,tenant_id,created_at DESC);
