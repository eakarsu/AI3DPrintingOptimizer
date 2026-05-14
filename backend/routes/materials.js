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
    const inStock = req.query.in_stock;

    let whereClause = '';
    const params = [limit, offset];
    if (inStock !== undefined) {
      whereClause = 'WHERE in_stock = $3';
      params.push(inStock === 'true');
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM materials ${whereClause}`, inStock !== undefined ? [params[2]] : []);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(`SELECT * FROM materials ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
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
    body('type').optional().isString(),
    body('diameter').optional().isFloat({ min: 0.1, max: 5.0 }).withMessage('diameter must be 0.1-5.0mm'),
    body('weight_grams').optional().isInt({ min: 1 }).withMessage('weight_grams must be positive'),
    body('price').optional().isFloat({ min: 0 }).withMessage('price must be non-negative'),
    body('nozzle_temp_min').optional().isInt({ min: 100, max: 400 }).withMessage('nozzle_temp_min must be 100-400°C'),
    body('nozzle_temp_max').optional().isInt({ min: 100, max: 400 }).withMessage('nozzle_temp_max must be 100-400°C'),
    body('bed_temp_min').optional().isInt({ min: 0, max: 150 }).withMessage('bed_temp_min must be 0-150°C'),
    body('bed_temp_max').optional().isInt({ min: 0, max: 150 }).withMessage('bed_temp_max must be 0-150°C'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, type, brand, color, diameter, weight_grams, price, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, in_stock } = req.body;
      const result = await pool.query(
        `INSERT INTO materials (name, type, brand, color, diameter, weight_grams, price, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, in_stock)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [name, type, brand, color, diameter, weight_grams, price, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, in_stock]
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
    body('diameter').optional().isFloat({ min: 0.1, max: 5.0 }),
    body('weight_grams').optional().isInt({ min: 1 }),
    body('price').optional().isFloat({ min: 0 }),
    body('nozzle_temp_min').optional().isInt({ min: 100, max: 400 }),
    body('nozzle_temp_max').optional().isInt({ min: 100, max: 400 }),
    body('bed_temp_min').optional().isInt({ min: 0, max: 150 }),
    body('bed_temp_max').optional().isInt({ min: 0, max: 150 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, type, brand, color, diameter, weight_grams, price, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, in_stock } = req.body;
      const result = await pool.query(
        `UPDATE materials SET name=$1, type=$2, brand=$3, color=$4, diameter=$5, weight_grams=$6, price=$7, nozzle_temp_min=$8, nozzle_temp_max=$9, bed_temp_min=$10, bed_temp_max=$11, in_stock=$12, updated_at=NOW()
         WHERE id=$13 RETURNING *`,
        [name, type, brand, color, diameter, weight_grams, price, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, in_stock, req.params.id]
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
    const result = await pool.query('DELETE FROM materials WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
