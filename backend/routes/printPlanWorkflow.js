'use strict';

const express = require('express');
const pool = require('../db');
const authenticate = require('../middleware/auth');
const { buildPrintPlan, evaluatePrintOutcome } = require('../domain/printPlanPolicy');

const router = express.Router();
const roles = (...allowed) => (req, res, next) => {
  const tenantId = req.user?.tenantId || req.user?.tenant_id;
  if (!tenantId) return res.status(403).json({ error: 'Tenant claim required' });
  if (!allowed.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient role' });
  req.tenantId = tenantId;
  next();
};

async function audit(client, workflowId, tenantId, actorId, action, details = {}) {
  await client.query(
    `INSERT INTO print_plan_audit (workflow_id, tenant_id, actor_id, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [workflowId, tenantId, String(actorId), action, details]
  );
}

router.use(authenticate);

router.get('/', roles('operator', 'approver', 'admin'), async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM print_plan_workflows WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 100',
    [req.tenantId]
  );
  res.json(result.rows);
});

router.post('/', roles('operator', 'admin'), async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 128) return res.status(400).json({ error: 'Valid Idempotency-Key required' });
  const decision = buildPrintPlan(req.body || {});
  const status = decision.compatible ? 'validated' : 'failed';
  const failureCode = decision.compatible ? null : 'compatibility_check_failed';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT * FROM print_plan_workflows WHERE tenant_id = $1 AND idempotency_key = $2 FOR UPDATE',
      [req.tenantId, idempotencyKey]
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return res.status(200).json(existing.rows[0]);
    }
    const result = await client.query(
      `INSERT INTO print_plan_workflows
       (tenant_id, idempotency_key, status, input, decision, failure_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.tenantId, idempotencyKey, status, req.body, decision, failureCode, String(req.user.id)]
    );
    await audit(client, result.rows[0].id, req.tenantId, req.user.id, status, { violations: decision.violations });
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Print-plan workflow could not be persisted', code: 'workflow_persistence_failed' });
  } finally {
    client.release();
  }
});

router.post('/:id/submit', roles('operator', 'admin'), async (req, res) => {
  const result = await pool.query(
    `UPDATE print_plan_workflows SET status = 'pending_approval', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'validated' RETURNING *`,
    [req.params.id, req.tenantId]
  );
  if (!result.rows[0]) return res.status(409).json({ error: 'Only validated plans can be submitted' });
  await pool.query(
    'INSERT INTO print_plan_audit (workflow_id, tenant_id, actor_id, action) VALUES ($1,$2,$3,$4)',
    [req.params.id, req.tenantId, String(req.user.id), 'submitted']
  );
  res.json(result.rows[0]);
});

router.post('/:id/decision', roles('approver', 'admin'), async (req, res) => {
  if (!['approve', 'reject'].includes(req.body?.decision) || !String(req.body?.reason || '').trim()) {
    return res.status(400).json({ error: 'decision and reason are required' });
  }
  const status = req.body.decision === 'approve' ? 'approved' : 'rejected';
  const result = await pool.query(
    `UPDATE print_plan_workflows SET status = $1, approved_by = $2, approval_reason = $3, updated_at = NOW()
     WHERE id = $4 AND tenant_id = $5 AND status = 'pending_approval' AND created_by <> $2 RETURNING *`,
    [status, String(req.user.id), req.body.reason.trim(), req.params.id, req.tenantId]
  );
  if (!result.rows[0]) return res.status(409).json({ error: 'Pending plan and independent approver required' });
  await pool.query(
    'INSERT INTO print_plan_audit (workflow_id, tenant_id, actor_id, action, details) VALUES ($1,$2,$3,$4,$5)',
    [req.params.id, req.tenantId, String(req.user.id), status, { reason: req.body.reason }]
  );
  res.json(result.rows[0]);
});

router.post('/:id/outcome', roles('operator', 'admin'), async (req, res) => {
  const assessment = evaluatePrintOutcome(req.body || {});
  if (!assessment.valid) return res.status(422).json(assessment);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const workflow = await client.query("SELECT * FROM print_plan_workflows WHERE id=$1 AND tenant_id=$2 AND status='approved' FOR UPDATE", [req.params.id, req.tenantId]);
    if (!workflow.rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Approved plan required' }); }
    const outcome = await client.query(`INSERT INTO print_plan_outcomes(workflow_id,tenant_id,outcome,evidence_checksum,recorded_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workflow_id) DO NOTHING RETURNING *`, [req.params.id, req.tenantId, assessment.benchmark, assessment.benchmark.evidenceChecksum, String(req.user.id)]);
    if (!outcome.rows[0]) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Outcome already recorded' }); }
    await client.query("UPDATE print_plan_workflows SET status='outcome_recorded',updated_at=NOW() WHERE id=$1", [req.params.id]);
    await audit(client, req.params.id, req.tenantId, req.user.id, 'outcome_recorded', assessment.benchmark);
    await client.query('COMMIT'); res.status(201).json(outcome.rows[0]);
  } catch (_) { await client.query('ROLLBACK'); res.status(500).json({ error: 'Outcome persistence failed', code: 'outcome_persistence_failed' }); }
  finally { client.release(); }
});

module.exports = router;
