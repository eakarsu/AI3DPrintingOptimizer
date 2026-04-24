const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM printers ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM printers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
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
});

// Update
router.put('/:id', auth, async (req, res) => {
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
});

// Delete
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
