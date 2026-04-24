const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM failure_predictions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM failure_predictions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, risk_level, failure_type, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO failure_predictions (print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, risk_level, failure_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, risk_level, failure_type, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, risk_level, failure_type, notes } = req.body;
    const result = await pool.query(
      `UPDATE failure_predictions SET print_name=$1, material_type=$2, layer_height=$3, nozzle_temp=$4, bed_temp=$5, print_speed=$6, geometry_complexity=$7, risk_level=$8, failure_type=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, risk_level, failure_type, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM failure_predictions WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI: Predict failure
router.post('/ai/predict', auth, async (req, res) => {
  try {
    const { material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, notes } = req.body;
    const systemPrompt = `You are an expert 3D printing failure prediction AI. Analyze the given print parameters and predict potential failures. Rate risk level (Low/Medium/High/Critical), identify likely failure types, and provide prevention recommendations. Format with clear sections: Risk Assessment, Potential Failures, Prevention Steps, and Confidence Level.`;
    const userMessage = `Predict failures for this 3D print setup:
- Material: ${material_type}
- Layer Height: ${layer_height}mm
- Nozzle Temp: ${nozzle_temp}°C
- Bed Temp: ${bed_temp}°C
- Print Speed: ${print_speed}mm/s
- Geometry Complexity: ${geometry_complexity}
- Notes: ${notes || 'None'}`;

    const aiResponse = await queryOpenRouter(systemPrompt, userMessage);
    res.json({ ai_response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
