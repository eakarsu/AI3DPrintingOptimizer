const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, DEFAULT_MODEL } = require('../services/openrouter');
const { body, validationResult } = require('express-validator');

// Validation rules for AI predict endpoint
const aiPredictValidation = [
  body('nozzle_temp')
    .isFloat({ min: 150, max: 300 })
    .withMessage('nozzle_temp must be between 150 and 300°C'),
  body('bed_temp')
    .isFloat({ min: 0, max: 120 })
    .withMessage('bed_temp must be between 0 and 120°C'),
  body('layer_height')
    .isFloat({ min: 0.05, max: 0.4 })
    .withMessage('layer_height must be between 0.05 and 0.4mm'),
  body('print_speed')
    .isFloat({ min: 10, max: 200 })
    .withMessage('print_speed must be between 10 and 200 mm/s'),
  body('material_type')
    .notEmpty()
    .withMessage('material_type is required'),
];

// Get all with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const riskLevel = req.query.risk_level || null;

    let whereClause = '';
    const params = [limit, offset];
    if (riskLevel) {
      whereClause = 'WHERE risk_level = $3';
      params.push(riskLevel);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM failure_predictions ${whereClause}`, riskLevel ? [riskLevel] : []);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(`SELECT * FROM failure_predictions ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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

// AI: Predict failure - with input validation and DB persistence
router.post('/ai/predict', auth, aiPredictValidation, async (req, res) => {
  // Validate inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, notes } = req.body;
    const aiModel = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

    const systemPrompt = `You are an expert 3D printing failure prediction AI with deep knowledge of FDM printing physics and common failure modes. Analyze print parameters and predict failures with precision. Rate risk level as: Low, Medium, High, or Critical. Respond ONLY with valid JSON — no markdown, no prose:
{
  "risk_level": "Low|Medium|High|Critical",
  "failure_types": ["string"],
  "risk_assessment": "string",
  "prevention_steps": ["string"],
  "confidence_level": "Low|Medium|High",
  "confidence_score": number,
  "probability_of_failure": number,
  "critical_parameters": [
    {"parameter": "string", "current_value": "string", "recommended_value": "string", "impact": "string"}
  ],
  "environmental_factors": ["string"],
  "summary": "string"
}`;

    const userMessage = `Predict failures for this 3D print setup:
- Print Name: ${print_name || 'Unnamed'}
- Material: ${material_type}
- Layer Height: ${layer_height}mm
- Nozzle Temp: ${nozzle_temp}°C
- Bed Temp: ${bed_temp}°C
- Print Speed: ${print_speed}mm/s
- Geometry Complexity: ${geometry_complexity || 'Medium'}
- Notes: ${notes || 'None'}`;

    const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.15, maxTokens: 3000 });
    const predictionResult = parseAIJson(aiResponse.content) || {
      risk_level: 'Unknown',
      summary: aiResponse.content,
      failure_types: [],
      prevention_steps: [],
      confidence_level: 'Low',
      risk_assessment: aiResponse.content,
    };

    const riskLevel = predictionResult.risk_level || 'Unknown';

    // Save to DB
    const dbResult = await pool.query(
      `INSERT INTO failure_predictions
         (print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, notes,
          prediction_result, risk_level, ai_model_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        print_name || `AI Prediction - ${material_type}`,
        material_type,
        layer_height,
        nozzle_temp,
        bed_temp,
        print_speed,
        geometry_complexity || 'Medium',
        notes || null,
        JSON.stringify(predictionResult),
        riskLevel,
        aiModel,
      ]
    );

    res.json({
      success: true,
      prediction: predictionResult,
      saved_record: dbResult.rows[0],
      model_used: aiModel,
      usage: aiResponse.usage,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
