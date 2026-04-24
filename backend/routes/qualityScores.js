const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter } = require('../services/openrouter');

// Get all
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quality_scores ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quality_scores WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post('/', auth, async (req, res) => {
  try {
    const { print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO quality_scores (print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update
router.put('/:id', auth, async (req, res) => {
  try {
    const { print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes } = req.body;
    const result = await pool.query(
      `UPDATE quality_scores SET print_name=$1, surface_quality=$2, dimensional_accuracy=$3, layer_adhesion=$4, detail_resolution=$5, warping_level=$6, stringing_level=$7, overall_score=$8, material_type=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM quality_scores WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI: Analyze quality
router.post('/ai/analyze', auth, async (req, res) => {
  try {
    const { print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, material_type, notes } = req.body;
    const systemPrompt = `You are an expert 3D print quality analysis AI. Given quality metrics of a completed print, provide a comprehensive quality assessment. Identify issues, suggest improvements, and give an overall quality grade. Format with sections: Quality Grade, Issue Analysis, Improvement Recommendations, and Parameter Adjustments.`;
    const userMessage = `Analyze quality for print "${print_name}":
- Surface Quality: ${surface_quality}/10
- Dimensional Accuracy: ${dimensional_accuracy}/10
- Layer Adhesion: ${layer_adhesion}/10
- Detail Resolution: ${detail_resolution}/10
- Warping Level: ${warping_level}/10 (10=none)
- Stringing Level: ${stringing_level}/10 (10=none)
- Material: ${material_type}
- Notes: ${notes || 'None'}`;

    const aiResponse = await queryOpenRouter(systemPrompt, userMessage);
    res.json({ ai_response: aiResponse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
