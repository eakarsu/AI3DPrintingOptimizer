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

    let whereClause = '';
    const params = [limit, offset];
    if (status) {
      whereClause = 'WHERE status = $3';
      params.push(status);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM printers ${whereClause}`, status ? [status] : []);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(`SELECT * FROM printers ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM printers WHERE id = $1', [req.params.id]);
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
    body('name').notEmpty().withMessage('name is required'),
    body('build_volume_x').optional().isInt({ min: 1 }).withMessage('build_volume_x must be positive'),
    body('build_volume_y').optional().isInt({ min: 1 }).withMessage('build_volume_y must be positive'),
    body('build_volume_z').optional().isInt({ min: 1 }).withMessage('build_volume_z must be positive'),
    body('nozzle_diameter').optional().isFloat({ min: 0.1, max: 2.0 }).withMessage('nozzle_diameter must be 0.1-2.0mm'),
    body('max_temp').optional().isInt({ min: 100, max: 500 }).withMessage('max_temp must be 100-500°C'),
    body('total_print_hours').optional().isFloat({ min: 0 }).withMessage('total_print_hours must be non-negative'),
    body('status').optional().isIn(['Idle', 'Printing', 'Queued', 'Maintenance', 'Offline']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, model, manufacturer, build_volume_x, build_volume_y, build_volume_z, nozzle_diameter, max_temp, heated_bed, status, total_print_hours, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO printers (name, model, manufacturer, build_volume_x, build_volume_y, build_volume_z, nozzle_diameter, max_temp, heated_bed, status, total_print_hours, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [name, model, manufacturer, build_volume_x, build_volume_y, build_volume_z, nozzle_diameter, max_temp, heated_bed, status, total_print_hours, notes]
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
    body('name').notEmpty().withMessage('name is required'),
    body('build_volume_x').optional().isInt({ min: 1 }),
    body('build_volume_y').optional().isInt({ min: 1 }),
    body('build_volume_z').optional().isInt({ min: 1 }),
    body('nozzle_diameter').optional().isFloat({ min: 0.1, max: 2.0 }),
    body('max_temp').optional().isInt({ min: 100, max: 500 }),
    body('total_print_hours').optional().isFloat({ min: 0 }),
    body('status').optional().isIn(['Idle', 'Printing', 'Queued', 'Maintenance', 'Offline']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, model, manufacturer, build_volume_x, build_volume_y, build_volume_z, nozzle_diameter, max_temp, heated_bed, status, total_print_hours, notes } = req.body;
      const result = await pool.query(
        `UPDATE printers SET name=$1, model=$2, manufacturer=$3, build_volume_x=$4, build_volume_y=$5, build_volume_z=$6, nozzle_diameter=$7, max_temp=$8, heated_bed=$9, status=$10, total_print_hours=$11, notes=$12, updated_at=NOW()
         WHERE id=$13 RETURNING *`,
        [name, model, manufacturer, build_volume_x, build_volume_y, build_volume_z, nozzle_diameter, max_temp, heated_bed, status, total_print_hours, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM printers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
