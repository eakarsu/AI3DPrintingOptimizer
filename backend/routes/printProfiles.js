const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_profiles ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_profiles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO print_profiles (profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes } = req.body;
    const result = await pool.query(
      `UPDATE print_profiles SET profile_name=$1, material_type=$2, layer_height=$3, nozzle_temp=$4, bed_temp=$5, print_speed=$6, infill_density=$7, retraction_enabled=$8, retraction_distance=$9, fan_speed=$10, notes=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM print_profiles WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
