const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET all with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const status = req.query.status || null;
    const printerName = req.query.printer_name || null;

    const conditions = [];
    const countParams = [];
    if (status) { conditions.push(`status = $${countParams.length + 1}`); countParams.push(status); }
    if (printerName) { conditions.push(`printer_name ILIKE $${countParams.length + 1}`); countParams.push(`%${printerName}%`); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM maintenance_logs ${whereClause}`, countParams);
    const total = parseInt(countResult.rows[0].count);

    const queryParams = [...countParams, limit, offset];
    const result = await pool.query(
      `SELECT * FROM maintenance_logs ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
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
    const result = await pool.query('SELECT * FROM maintenance_logs WHERE id = $1', [req.params.id]);
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
    body('printer_name').notEmpty().withMessage('printer_name is required'),
    body('maintenance_type').optional().isString(),
    body('cost').optional().isFloat({ min: 0 }).withMessage('cost must be non-negative'),
    body('next_maintenance_date').optional().isISO8601().withMessage('next_maintenance_date must be a valid date (YYYY-MM-DD)'),
    body('status').optional().isIn(['Completed', 'In Progress', 'Scheduled']).withMessage('status must be Completed, In Progress, or Scheduled'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO maintenance_logs (printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status || 'Completed', notes]
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
    body('printer_name').notEmpty().withMessage('printer_name is required'),
    body('cost').optional().isFloat({ min: 0 }),
    body('next_maintenance_date').optional().isISO8601(),
    body('status').optional().isIn(['Completed', 'In Progress', 'Scheduled']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes } = req.body;
      const result = await pool.query(
        `UPDATE maintenance_logs SET printer_name=$1, maintenance_type=$2, description=$3, performed_by=$4, cost=$5, next_maintenance_date=$6, status=$7, notes=$8, updated_at=NOW()
         WHERE id=$9 RETURNING *`,
        [printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM maintenance_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /overdue - maintenance that is past due
router.get('/alerts/overdue', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM maintenance_logs
      WHERE next_maintenance_date < CURRENT_DATE
        AND status != 'Completed'
      ORDER BY next_maintenance_date ASC
    `);
    res.json({ overdue: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /upcoming - maintenance due in next 30 days
router.get('/alerts/upcoming', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const result = await pool.query(`
      SELECT * FROM maintenance_logs
      WHERE next_maintenance_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '${days} days')
        AND status = 'Scheduled'
      ORDER BY next_maintenance_date ASC
    `);
    res.json({ upcoming: result.rows, count: result.rows.length, within_days: days });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
