const persistNativeAI=require('../services/persistNativeAI');
const safe=handler=>(req,res,next)=>Promise.resolve(handler(req,res,next)).catch(error=>{if(res.headersSent)return next(error);res.status(error.status||503).json({error:error.status?error.message:'Native planning storage is unavailable. Retry when the database is available.',code:'native_planning_request_failed'});});
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

router.get('/', roles('operator', 'approver', 'admin'), safe(async (req, res) => {
  const mineOnly = req.query.scope === 'mine';
  const result = await pool.query(
    `SELECT * FROM print_plan_workflows
     WHERE tenant_id = $1 AND ($2::boolean = FALSE OR created_by = $3)
     ORDER BY created_at DESC, id DESC LIMIT 100`,
    [req.tenantId, mineOnly, String(req.user.id)]
  );
  res.json(result.rows);
}));

router.post('/', roles('operator', 'admin'), safe(async (req, res) => {
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
}));

router.patch('/:id', roles('operator', 'admin'), safe(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Valid plan id required' });
  const decision = buildPrintPlan(req.body || {});
  const status = decision.compatible ? 'validated' : 'failed';
  const failureCode = decision.compatible ? null : 'compatibility_check_failed';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id FROM print_plan_workflows
       WHERE id=$1 AND tenant_id=$2 AND created_by=$3 AND status IN ('validated','failed') FOR UPDATE`,
      [req.params.id, req.tenantId, String(req.user.id)]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only your unsubmitted planning drafts can be edited' });
    }
    const updated = await client.query(
      `UPDATE print_plan_workflows SET input=$1, decision=$2, status=$3, failure_code=$4, updated_at=NOW()
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [req.body, decision, status, failureCode, req.params.id, req.tenantId]
    );
    await audit(client, req.params.id, req.tenantId, req.user.id, 'draft_revised', { status, violations: decision.violations });
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (_) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Planning draft could not be updated', code: 'workflow_update_failed' });
  } finally {
    client.release();
  }
}));

router.delete('/:id', roles('operator', 'admin'), safe(async (req, res) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(400).json({ error: 'Valid plan id required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT id FROM print_plan_workflows
       WHERE id=$1 AND tenant_id=$2 AND created_by=$3 AND status IN ('validated','failed') FOR UPDATE`,
      [req.params.id, req.tenantId, String(req.user.id)]
    );
    if (!existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Only your unsubmitted planning drafts can be deleted' });
    }
    await client.query('DELETE FROM print_plan_audit WHERE workflow_id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    await client.query('DELETE FROM print_plan_workflows WHERE id=$1 AND tenant_id=$2', [req.params.id, req.tenantId]);
    await client.query('COMMIT');
    res.json({ deleted: true, id: Number(req.params.id) });
  } catch (_) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Planning draft could not be deleted', code: 'workflow_delete_failed' });
  } finally {
    client.release();
  }
}));

router.post('/:id/submit', roles('operator', 'admin'), safe(async (req, res) => {
  const updated=await persistNativeAI(pool,undefined,async client=>{
  const result = await client.query(
    `UPDATE print_plan_workflows SET status = 'pending_approval', updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2 AND status = 'validated' RETURNING *`,
    [req.params.id, req.tenantId]
  );
  if (!result.rows[0]) throw Object.assign(new Error('Only validated plans can be submitted'),{status:409});
  await client.query(
    'INSERT INTO print_plan_audit (workflow_id, tenant_id, actor_id, action) VALUES ($1,$2,$3,$4)',
    [req.params.id, req.tenantId, String(req.user.id), 'submitted']
  );
    return result.rows[0];
  });
  res.json(updated);
}));

router.post('/:id/decision', roles('approver', 'admin'), safe(async (req, res) => {
  if (!['approve', 'reject'].includes(req.body?.decision) || !String(req.body?.reason || '').trim()) {
    return res.status(400).json({ error: 'decision and reason are required' });
  }
  const status = req.body.decision === 'approve' ? 'approved' : 'rejected';
  const updated=await persistNativeAI(pool,undefined,async client=>{
  const result = await client.query(
    `UPDATE print_plan_workflows SET status = $1, approved_by = $2, approval_reason = $3, updated_at = NOW()
     WHERE id = $4 AND tenant_id = $5 AND status = 'pending_approval' AND created_by <> $2 RETURNING *`,
    [status, String(req.user.id), req.body.reason.trim(), req.params.id, req.tenantId]
  );
  if (!result.rows[0]) throw Object.assign(new Error('Pending plan and independent approver required'),{status:409});
  await client.query(
    'INSERT INTO print_plan_audit (workflow_id, tenant_id, actor_id, action, details) VALUES ($1,$2,$3,$4,$5)',
    [req.params.id, req.tenantId, String(req.user.id), status, { reason: req.body.reason }]
  );
    return result.rows[0];
  });
  res.json(updated);
}));

router.post('/:id/outcome', roles('operator', 'admin'), safe(async (req, res) => {
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
}));

module.exports = router;
