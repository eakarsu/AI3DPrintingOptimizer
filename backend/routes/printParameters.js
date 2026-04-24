const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_parameters ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_parameters WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled } = req.body;
    const result = await pool.query(
      `INSERT INTO print_parameters (material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled } = req.body;
    const result = await pool.query(
      `UPDATE print_parameters SET material_type=$1, geometry_type=$2, layer_height=$3, nozzle_temp=$4, bed_temp=$5, print_speed=$6, infill_density=$7, support_enabled=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled, req.params.id]
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
    const result = await pool.query('DELETE FROM print_parameters WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI: Optimize parameters
router.post('/ai/optimize', auth, async (req, res) => {
  try {
    const { material_type, geometry_type, desired_quality, notes } = req.body;
    const systemPrompt = `You are an expert 3D printing parameter optimization AI. Given material type and geometry, recommend optimal print parameters. Provide specific numeric values and explain your reasoning. Format your response with clear sections: Recommended Parameters, Reasoning, and Tips.`;
    const userMessage = `Optimize 3D print parameters for:
- Material: ${material_type}
- Geometry Type: ${geometry_type}
- Desired Quality: ${desired_quality || 'Standard'}
- Additional Notes: ${notes || 'None'}

Please recommend: layer height, nozzle temperature, bed temperature, print speed, infill density, and whether supports are needed.`;

    const aiResponse = await queryOpenRouter(systemPrompt, userMessage);
    res.json({ ai_response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
