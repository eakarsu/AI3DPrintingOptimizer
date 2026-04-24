const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM material_selections ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM material_selections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO material_selections (project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes } = req.body;
    const result = await pool.query(
      `UPDATE material_selections SET project_name=$1, application=$2, strength_required=$3, flexibility_required=$4, heat_resistance=$5, chemical_resistance=$6, recommended_material=$7, budget_level=$8, notes=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM material_selections WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI: Recommend material
router.post('/ai/recommend', auth, async (req, res) => {
  try {
    const { application, strength_required, flexibility_required, heat_resistance, chemical_resistance, budget_level, notes } = req.body;
    const systemPrompt = `You are an expert 3D printing material selection AI advisor. Given project requirements, recommend the best material(s). Provide detailed comparisons, pros/cons, and cost estimates. Format with sections: Top Recommendation, Alternative Options, Comparison Table, and Usage Tips.`;
    const userMessage = `Recommend materials for this project:
- Application: ${application}
- Strength Required: ${strength_required}/10
- Flexibility Required: ${flexibility_required}/10
- Heat Resistance: ${heat_resistance}
- Chemical Resistance: ${chemical_resistance}
- Budget: ${budget_level}
- Notes: ${notes || 'None'}`;

    const aiResponse = await queryOpenRouter(systemPrompt, userMessage);
    res.json({ ai_response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
