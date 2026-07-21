BEGIN;
CREATE TABLE IF NOT EXISTS users(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id TEXT;
UPDATE users SET tenant_id = 'legacy-' || id::text WHERE tenant_id IS NULL;
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'operator';

CREATE TABLE IF NOT EXISTS print_plan_workflows (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('validated','pending_approval','approved','rejected','failed','outcome_recorded')),
  input JSONB NOT NULL,
  decision JSONB NOT NULL,
  failure_code TEXT,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approval_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_print_plan_tenant_status ON print_plan_workflows (tenant_id, status);

CREATE TABLE IF NOT EXISTS print_plan_audit (
  id BIGSERIAL PRIMARY KEY,
  workflow_id BIGINT NOT NULL REFERENCES print_plan_workflows(id),
  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS print_plan_outcomes (
  id BIGSERIAL PRIMARY KEY, workflow_id BIGINT NOT NULL UNIQUE REFERENCES print_plan_workflows(id),
  tenant_id TEXT NOT NULL, outcome JSONB NOT NULL, evidence_checksum TEXT NOT NULL,
  recorded_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMIT;
