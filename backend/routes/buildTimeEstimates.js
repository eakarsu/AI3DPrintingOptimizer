const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM build_time_estimates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM build_time_estimates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity } = req.body;
    const result = await pool.query(
      `INSERT INTO build_time_estimates (model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity } = req.body;
    const result = await pool.query(
      `UPDATE build_time_estimates SET model_name=$1, dimensions_x=$2, dimensions_y=$3, dimensions_z=$4, layer_height=$5, infill_density=$6, print_speed=$7, material_type=$8, estimated_hours=$9, complexity=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity, req.params.id]
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
    const result = await pool.query('DELETE FROM build_time_estimates WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI: Estimate build time
router.post('/ai/estimate', auth, async (req, res) => {
  try {
    const { model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, complexity } = req.body;
    const systemPrompt = `You are an expert 3D printing build time estimation AI. Given model dimensions and print parameters, provide detailed time estimates. Break down by phase (heating, printing layers, cooling). Format with sections: Total Estimate, Time Breakdown, Optimization Suggestions, and Cost Estimate.`;
    const userMessage = `Estimate build time for:
- Model: ${model_name}
- Dimensions: ${dimensions_x}x${dimensions_y}x${dimensions_z}mm
- Layer Height: ${layer_height}mm
- Infill: ${infill_density}%
- Speed: ${print_speed}mm/s
- Material: ${material_type}
- Complexity: ${complexity}`;

    const aiResponse = await queryOpenRouter(systemPrompt, userMessage);
    res.json({ ai_response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
