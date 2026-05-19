const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, DEFAULT_MODEL } = require('../services/openrouter');
const { body, query, validationResult } = require('express-validator');

const AI_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

// GET all with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM print_parameters');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM print_parameters ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_parameters WHERE id = $1', [req.params.id]);
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
    body('material_type').notEmpty().withMessage('material_type is required'),
    body('geometry_type').notEmpty().withMessage('geometry_type is required'),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }).withMessage('layer_height must be 0.01-1.0mm'),
    body('nozzle_temp').optional().isInt({ min: 100, max: 400 }).withMessage('nozzle_temp must be 100-400°C'),
    body('bed_temp').optional().isInt({ min: 0, max: 150 }).withMessage('bed_temp must be 0-150°C'),
    body('print_speed').optional().isInt({ min: 1, max: 500 }).withMessage('print_speed must be 1-500 mm/s'),
    body('infill_density').optional().isInt({ min: 0, max: 100 }).withMessage('infill_density must be 0-100%'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// PUT update
router.put('/:id',
  auth,
  [
    body('material_type').notEmpty().withMessage('material_type is required'),
    body('geometry_type').notEmpty().withMessage('geometry_type is required'),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }),
    body('nozzle_temp').optional().isInt({ min: 100, max: 400 }),
    body('bed_temp').optional().isInt({ min: 0, max: 150 }),
    body('print_speed').optional().isInt({ min: 1, max: 500 }),
    body('infill_density').optional().isInt({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM print_parameters WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/optimize — structured JSON output + DB persistence
router.post('/ai/optimize',
  auth,
  [
    body('material_type').notEmpty().withMessage('material_type is required'),
    body('geometry_type').notEmpty().withMessage('geometry_type is required'),
    body('desired_quality').optional().isIn(['Draft', 'Standard', 'High', 'Ultra']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { material_type, geometry_type, desired_quality, notes } = req.body;

      const systemPrompt = `You are an expert 3D printing parameter optimization AI with knowledge of slicer software (Cura, PrusaSlicer, Bambu Studio) and FDM printer mechanics. Given material and geometry, recommend optimal print parameters. You MUST respond ONLY with valid JSON — no markdown, no prose. Use this exact schema:
{
  "nozzle_temp": number,
  "bed_temp": number,
  "print_speed": number,
  "first_layer_speed": number,
  "layer_height": number,
  "first_layer_height": number,
  "infill_density": number,
  "infill_pattern": "grid|gyroid|honeycomb|lines|triangles",
  "cooling_fan_speed": number,
  "retraction_distance": number,
  "retraction_speed": number,
  "support_enabled": boolean,
  "support_type": "none|normal|tree",
  "brim_enabled": boolean,
  "brim_width_mm": number,
  "reasoning": "string",
  "quality_notes": "string",
  "common_pitfalls": ["string"],
  "estimated_quality_improvement_vs_default": "string",
  "confidence_score": number
}`;

      const userMessage = `Optimize 3D print parameters for:
- Material: ${material_type}
- Geometry Type: ${geometry_type}
- Desired Quality: ${desired_quality || 'Standard'}
- Additional Notes: ${notes || 'None'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.15, maxTokens: 3000 });
      const parameters = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      // Persist to print_parameters
      const dbResult = await pool.query(
        `INSERT INTO print_parameters
           (material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled, ai_result, ai_model_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          material_type,
          geometry_type,
          parameters.layer_height || null,
          parameters.nozzle_temp || null,
          parameters.bed_temp || null,
          parameters.print_speed || null,
          parameters.infill_density || null,
          parameters.support_enabled || false,
          JSON.stringify(parameters),
          aiResponse.model || AI_MODEL,
        ]
      );

      // Audit log
      await pool.query(
        `INSERT INTO ai_results (endpoint, user_id, input_data, raw_response, parsed_result, model_used, tokens_used, success)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        ['/print-parameters/ai/optimize', req.user?.id, JSON.stringify(req.body), aiResponse.content, JSON.stringify(parameters), aiResponse.model || AI_MODEL, aiResponse.usage?.total_tokens || null]
      );

      res.status(201).json({
        success: true,
        suggested_parameters: parameters,
        saved_record: dbResult.rows[0],
        model_used: aiResponse.model || AI_MODEL,
        usage: aiResponse.usage,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
