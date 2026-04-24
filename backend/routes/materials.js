const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM materials ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM materials WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
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
});

// Update
router.put('/:id', auth, async (req, res) => {
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
});

// Delete
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
