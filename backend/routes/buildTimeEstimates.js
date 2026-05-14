const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, DEFAULT_MODEL } = require('../services/openrouter');
const { body, validationResult } = require('express-validator');

const AI_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

// GET all with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM build_time_estimates');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM build_time_estimates ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM build_time_estimates WHERE id = $1', [req.params.id]);
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
    body('model_name').notEmpty().withMessage('model_name is required'),
    body('dimensions_x').optional().isFloat({ min: 0.1 }).withMessage('dimensions_x must be positive'),
    body('dimensions_y').optional().isFloat({ min: 0.1 }).withMessage('dimensions_y must be positive'),
    body('dimensions_z').optional().isFloat({ min: 0.1 }).withMessage('dimensions_z must be positive'),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }),
    body('infill_density').optional().isInt({ min: 0, max: 100 }),
    body('print_speed').optional().isInt({ min: 1, max: 500 }),
    body('estimated_hours').optional().isFloat({ min: 0 }),
    body('complexity').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// PUT update
router.put('/:id',
  auth,
  [
    body('model_name').notEmpty().withMessage('model_name is required'),
    body('dimensions_x').optional().isFloat({ min: 0.1 }),
    body('dimensions_y').optional().isFloat({ min: 0.1 }),
    body('dimensions_z').optional().isFloat({ min: 0.1 }),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }),
    body('infill_density').optional().isInt({ min: 0, max: 100 }),
    body('print_speed').optional().isInt({ min: 1, max: 500 }),
    body('estimated_hours').optional().isFloat({ min: 0 }),
    body('complexity').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM build_time_estimates WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/estimate — structured JSON + DB persistence
router.post('/ai/estimate',
  auth,
  [
    body('model_name').notEmpty().withMessage('model_name is required'),
    body('dimensions_x').isFloat({ min: 0.1 }).withMessage('dimensions_x is required and must be positive'),
    body('dimensions_y').isFloat({ min: 0.1 }).withMessage('dimensions_y is required and must be positive'),
    body('dimensions_z').isFloat({ min: 0.1 }).withMessage('dimensions_z is required and must be positive'),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }),
    body('infill_density').optional().isInt({ min: 0, max: 100 }),
    body('print_speed').optional().isInt({ min: 1, max: 500 }),
    body('material_type').optional().isString(),
    body('complexity').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, complexity } = req.body;

      const systemPrompt = `You are an expert 3D printing build time estimation AI with knowledge of slicing algorithms, motion planning, and printer mechanics. Estimate realistic print time with detailed phase breakdowns. Account for acceleration, travel moves, and layer transitions. Respond ONLY with valid JSON — no markdown, no prose:
{
  "total_estimated_hours": number,
  "total_estimated_minutes": number,
  "confidence_range": {
    "min_hours": number,
    "max_hours": number
  },
  "time_breakdown": {
    "heating_minutes": number,
    "first_layer_minutes": number,
    "infill_minutes": number,
    "perimeter_minutes": number,
    "support_minutes": number,
    "travel_minutes": number,
    "cooling_minutes": number
  },
  "filament_usage_estimate": {
    "total_grams": number,
    "total_meters": number
  },
  "cost_estimate": {
    "filament_cost_usd": number,
    "machine_time_cost_usd": number,
    "total_cost_usd": number,
    "assumptions": "string"
  },
  "optimization_suggestions": ["string", "string", "string"],
  "risk_factors": ["string"],
  "confidence_score": number
}`;

      const userMessage = `Estimate build time for:
- Model: ${model_name}
- Dimensions: ${dimensions_x}x${dimensions_y}x${dimensions_z}mm (X×Y×Z)
- Layer Height: ${layer_height || 0.2}mm
- Infill: ${infill_density || 20}%
- Speed: ${print_speed || 50}mm/s
- Material: ${material_type || 'PLA'}
- Complexity: ${complexity || 'Medium'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.15, maxTokens: 3000 });
      const estimate = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      // Persist to build_time_estimates
      const dbResult = await pool.query(
        `INSERT INTO build_time_estimates
           (model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity, ai_result, ai_model_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          model_name,
          dimensions_x,
          dimensions_y,
          dimensions_z,
          layer_height || 0.2,
          infill_density || 20,
          print_speed || 50,
          material_type || 'PLA',
          estimate.total_estimated_hours || null,
          complexity || 'Medium',
          JSON.stringify(estimate),
          aiResponse.model || AI_MODEL,
        ]
      );

      // Audit log
      await pool.query(
        `INSERT INTO ai_results (endpoint, user_id, input_data, raw_response, parsed_result, model_used, tokens_used, success)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        ['/build-time-estimates/ai/estimate', req.user?.id, JSON.stringify(req.body), aiResponse.content, JSON.stringify(estimate), aiResponse.model || AI_MODEL, aiResponse.usage?.total_tokens || null]
      );

      res.status(201).json({
        success: true,
        estimate,
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
