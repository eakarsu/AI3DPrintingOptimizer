const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Valid statuses and allowed transitions
const VALID_STATUSES = ['queued', 'printing', 'completed', 'failed', 'cancelled'];
const ALLOWED_TRANSITIONS = {
  queued: ['printing', 'cancelled'],
  printing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

// GET all with pagination and filtering
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status || null;
    const priority = req.query.priority || null;

    const conditions = [];
    const countParams = [];
    if (status) { conditions.push(`status = $${countParams.length + 1}`); countParams.push(status); }
    if (priority) { conditions.push(`priority = $${countParams.length + 1}`); countParams.push(priority); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM print_jobs ${whereClause}`, countParams);
    const total = parseInt(countResult.rows[0].count);

    const queryParams = [...countParams, limit, offset];
    const result = await pool.query(
      `SELECT * FROM print_jobs ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_jobs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
router.post('/',
  auth,
  [
    body('job_name').notEmpty().withMessage('job_name is required'),
    body('priority').optional().isIn(['Low', 'Normal', 'High', 'Urgent']).withMessage('priority must be Low, Normal, High, or Urgent'),
    body('estimated_time').optional().isFloat({ min: 0 }).withMessage('estimated_time must be non-negative'),
    body('material_weight_used_g').optional().isFloat({ min: 0 }).withMessage('material_weight_used_g must be non-negative'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { job_name, printer_name, material_type, priority, estimated_time, material_weight_used_g, file_name, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO print_jobs (job_name, printer_name, material_type, status, priority, estimated_time, material_weight_used_g, file_name, notes)
         VALUES ($1,$2,$3,'queued',$4,$5,$6,$7,$8) RETURNING *`,
        [job_name, printer_name, material_type, priority || 'Normal', estimated_time, material_weight_used_g, file_name, notes]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT update
router.put('/:id',
  auth,
  [
    body('job_name').notEmpty().withMessage('job_name is required'),
    body('priority').optional().isIn(['Low', 'Normal', 'High', 'Urgent']),
    body('estimated_time').optional().isFloat({ min: 0 }),
    body('material_weight_used_g').optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { job_name, printer_name, material_type, status, priority, estimated_time, material_weight_used_g, file_name, notes } = req.body;
      const result = await pool.query(
        `UPDATE print_jobs SET job_name=$1, printer_name=$2, material_type=$3, status=$4, priority=$5, estimated_time=$6, material_weight_used_g=$7, file_name=$8, notes=$9, updated_at=NOW()
         WHERE id=$10 RETURNING *`,
        [job_name, printer_name, material_type, status, priority, estimated_time, material_weight_used_g, file_name, notes, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM print_jobs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/status - enforced state machine transition
router.patch('/:id/status',
  auth,
  [
    body('status').notEmpty().withMessage('status is required').isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { status } = req.body;
      const current = await pool.query('SELECT * FROM print_jobs WHERE id = $1', [req.params.id]);
      if (current.rows.length === 0) return res.status(404).json({ error: 'Not found' });

      const job = current.rows[0];
      const currentStatus = job.status;
      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(status)) {
        return res.status(409).json({
          error: `Invalid transition: cannot move from '${currentStatus}' to '${status}'`,
          current_status: currentStatus,
          allowed_transitions: allowed,
        });
      }

      const result = await pool.query(
        `UPDATE print_jobs SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [status, req.params.id]
      );

      res.json({
        success: true,
        previous_status: currentStatus,
        new_status: status,
        job: result.rows[0],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /:id/estimate-cost
router.post('/:id/estimate-cost',
  auth,
  [
    body('weight_g').optional().isFloat({ min: 0 }),
    body('price_per_g').optional().isFloat({ min: 0 }),
    body('print_hours').optional().isFloat({ min: 0 }),
    body('hourly_rate').optional().isFloat({ min: 0 }),
    body('overhead_rate').optional().isFloat({ min: 0, max: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const jobResult = await pool.query('SELECT * FROM print_jobs WHERE id = $1', [req.params.id]);
      if (jobResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const job = jobResult.rows[0];

      const {
        weight_g = job.material_weight_used_g || 50,
        price_per_g = 0.025,
        print_hours = null,
        hourly_rate = 0.50,
        overhead_rate = 0.10,
      } = req.body;

      const estimatedHours = print_hours !== null
        ? parseFloat(print_hours)
        : (job.estimated_time ? parseFloat(job.estimated_time) : 1);

      const filamentCost = parseFloat(weight_g) * parseFloat(price_per_g);
      const machineTimeCost = estimatedHours * parseFloat(hourly_rate);
      const overheadCost = filamentCost * parseFloat(overhead_rate);
      const total = filamentCost + machineTimeCost + overheadCost;

      res.json({
        job_id: job.id,
        job_name: job.job_name,
        cost_breakdown: {
          filament_cost: parseFloat(filamentCost.toFixed(4)),
          machine_time_cost: parseFloat(machineTimeCost.toFixed(4)),
          overhead_cost: parseFloat(overheadCost.toFixed(4)),
          total: parseFloat(total.toFixed(4)),
        },
        inputs_used: {
          weight_g: parseFloat(weight_g),
          price_per_g: parseFloat(price_per_g),
          print_hours: estimatedHours,
          hourly_rate: parseFloat(hourly_rate),
          overhead_rate: parseFloat(overhead_rate),
        },
        currency: 'USD',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /queue - sorted queue view
router.get('/queue/sorted', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *,
        CASE priority
          WHEN 'Urgent' THEN 1
          WHEN 'High' THEN 2
          WHEN 'Normal' THEN 3
          WHEN 'Low' THEN 4
          ELSE 5
        END as priority_order
      FROM print_jobs
      WHERE status IN ('queued', 'printing')
      ORDER BY priority_order, created_at ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
