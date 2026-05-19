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

    const countResult = await pool.query('SELECT COUNT(*) FROM material_selections');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM material_selections ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM material_selections WHERE id = $1', [req.params.id]);
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
    body('project_name').notEmpty().withMessage('project_name is required'),
    body('strength_required').optional().isInt({ min: 1, max: 10 }).withMessage('strength_required must be 1-10'),
    body('flexibility_required').optional().isInt({ min: 1, max: 10 }).withMessage('flexibility_required must be 1-10'),
    body('heat_resistance').optional().isIn(['Low', 'Medium', 'High']),
    body('chemical_resistance').optional().isIn(['Low', 'Medium', 'High']),
    body('budget_level').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// PUT update
router.put('/:id',
  auth,
  [
    body('project_name').notEmpty().withMessage('project_name is required'),
    body('strength_required').optional().isInt({ min: 1, max: 10 }),
    body('flexibility_required').optional().isInt({ min: 1, max: 10 }),
    body('heat_resistance').optional().isIn(['Low', 'Medium', 'High']),
    body('chemical_resistance').optional().isIn(['Low', 'Medium', 'High']),
    body('budget_level').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM material_selections WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/recommend — structured JSON output + DB persistence
router.post('/ai/recommend',
  auth,
  [
    body('application').notEmpty().withMessage('application is required'),
    body('strength_required').isInt({ min: 1, max: 10 }).withMessage('strength_required must be 1-10'),
    body('flexibility_required').isInt({ min: 1, max: 10 }).withMessage('flexibility_required must be 1-10'),
    body('heat_resistance').optional().isIn(['Low', 'Medium', 'High']),
    body('chemical_resistance').optional().isIn(['Low', 'Medium', 'High']),
    body('budget_level').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { application, strength_required, flexibility_required, heat_resistance, chemical_resistance, budget_level, notes } = req.body;

      const systemPrompt = `You are an expert 3D printing material selection AI. Given project requirements, recommend the best FDM filament materials with detailed technical analysis. Respond ONLY with valid JSON — no markdown, no prose:
{
  "top_recommendation": {
    "material": "string",
    "full_name": "string",
    "match_score": number,
    "reasoning": "string",
    "cost_per_kg_usd": number,
    "print_difficulty": "Beginner|Intermediate|Advanced"
  },
  "alternatives": [
    {
      "material": "string",
      "match_score": number,
      "pros": ["string"],
      "cons": ["string"],
      "cost_per_kg_usd": number,
      "best_for": "string"
    }
  ],
  "comparison_table": [
    {
      "property": "string",
      "recommended": "string",
      "alternative_1": "string",
      "alternative_2": "string"
    }
  ],
  "print_settings_overview": {
    "nozzle_temp_range": "string",
    "bed_temp_range": "string",
    "special_requirements": ["string"]
  },
  "post_processing_options": ["string"],
  "confidence_score": number,
  "additional_notes": "string"
}`;

      const userMessage = `Recommend materials for this project:
- Application: ${application}
- Strength Required: ${strength_required}/10
- Flexibility Required: ${flexibility_required}/10
- Heat Resistance: ${heat_resistance || 'Low'}
- Chemical Resistance: ${chemical_resistance || 'Low'}
- Budget: ${budget_level || 'Medium'}
- Notes: ${notes || 'None'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2, maxTokens: 3500 });
      const recommendation = parseAIJson(aiResponse.content) || { summary: aiResponse.content };
      const topMaterial = recommendation.top_recommendation?.material || 'Unknown';

      // Persist to material_selections
      const dbResult = await pool.query(
        `INSERT INTO material_selections
           (project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes, ai_result, ai_model_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          application,
          application,
          strength_required,
          flexibility_required,
          heat_resistance || 'Low',
          chemical_resistance || 'Low',
          topMaterial,
          budget_level || 'Medium',
          notes || null,
          JSON.stringify(recommendation),
          aiResponse.model || AI_MODEL,
        ]
      );

      // Audit log
      await pool.query(
        `INSERT INTO ai_results (endpoint, user_id, input_data, raw_response, parsed_result, model_used, tokens_used, success)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        ['/material-selections/ai/recommend', req.user?.id, JSON.stringify(req.body), aiResponse.content, JSON.stringify(recommendation), aiResponse.model || AI_MODEL, aiResponse.usage?.total_tokens || null]
      );

      res.status(201).json({
        success: true,
        recommendation,
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
