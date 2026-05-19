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

    const countResult = await pool.query('SELECT COUNT(*) FROM quality_scores');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM quality_scores ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM quality_scores WHERE id = $1', [req.params.id]);
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
    body('print_name').notEmpty().withMessage('print_name is required'),
    body('surface_quality').optional().isInt({ min: 1, max: 10 }).withMessage('surface_quality must be 1-10'),
    body('dimensional_accuracy').optional().isInt({ min: 1, max: 10 }).withMessage('dimensional_accuracy must be 1-10'),
    body('layer_adhesion').optional().isInt({ min: 1, max: 10 }).withMessage('layer_adhesion must be 1-10'),
    body('detail_resolution').optional().isInt({ min: 1, max: 10 }).withMessage('detail_resolution must be 1-10'),
    body('warping_level').optional().isInt({ min: 1, max: 10 }).withMessage('warping_level must be 1-10'),
    body('stringing_level').optional().isInt({ min: 1, max: 10 }).withMessage('stringing_level must be 1-10'),
    body('overall_score').optional().isFloat({ min: 0, max: 10 }).withMessage('overall_score must be 0-10'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// PUT update
router.put('/:id',
  auth,
  [
    body('print_name').notEmpty().withMessage('print_name is required'),
    body('surface_quality').optional().isInt({ min: 1, max: 10 }),
    body('dimensional_accuracy').optional().isInt({ min: 1, max: 10 }),
    body('layer_adhesion').optional().isInt({ min: 1, max: 10 }),
    body('detail_resolution').optional().isInt({ min: 1, max: 10 }),
    body('warping_level').optional().isInt({ min: 1, max: 10 }),
    body('stringing_level').optional().isInt({ min: 1, max: 10 }),
    body('overall_score').optional().isFloat({ min: 0, max: 10 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
  }
);

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM quality_scores WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/analyze — structured JSON + DB persistence + quality grade
router.post('/ai/analyze',
  auth,
  [
    body('print_name').notEmpty().withMessage('print_name is required'),
    body('surface_quality').isInt({ min: 1, max: 10 }).withMessage('surface_quality must be 1-10'),
    body('dimensional_accuracy').isInt({ min: 1, max: 10 }).withMessage('dimensional_accuracy must be 1-10'),
    body('layer_adhesion').isInt({ min: 1, max: 10 }).withMessage('layer_adhesion must be 1-10'),
    body('detail_resolution').isInt({ min: 1, max: 10 }).withMessage('detail_resolution must be 1-10'),
    body('warping_level').isInt({ min: 1, max: 10 }).withMessage('warping_level must be 1-10 (10=no warping)'),
    body('stringing_level').isInt({ min: 1, max: 10 }).withMessage('stringing_level must be 1-10 (10=no stringing)'),
    body('material_type').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, material_type, notes } = req.body;

      const systemPrompt = `You are an expert 3D print quality analyst with experience in FDM printing defect identification and correction. Given quality metrics (scored 1-10), provide a comprehensive assessment with actionable parameter adjustments. For warping_level and stringing_level, 10 means none detected (good), 1 means severe. Respond ONLY with valid JSON — no markdown:
{
  "quality_grade": "A+|A|B+|B|C+|C|D|F",
  "overall_score_calculated": number,
  "primary_issues": [
    {
      "issue": "string",
      "severity": "Minor|Moderate|Major",
      "affected_metric": "string",
      "score": number
    }
  ],
  "strengths": ["string", "string"],
  "improvement_recommendations": [
    {
      "recommendation": "string",
      "priority": "High|Medium|Low",
      "expected_improvement": "string",
      "parameter_to_adjust": "string",
      "adjustment_direction": "Increase|Decrease|Enable|Disable",
      "adjustment_amount": "string"
    }
  ],
  "parameter_adjustments": {
    "nozzle_temp_change": number,
    "bed_temp_change": number,
    "print_speed_change": number,
    "retraction_distance_change": number,
    "fan_speed_change": number,
    "layer_height_change": number
  },
  "root_cause_summary": "string",
  "estimated_improvement_potential": "string",
  "confidence_score": number
}`;

      const userMessage = `Analyze print quality for "${print_name}":
- Surface Quality: ${surface_quality}/10
- Dimensional Accuracy: ${dimensional_accuracy}/10
- Layer Adhesion: ${layer_adhesion}/10
- Detail Resolution: ${detail_resolution}/10
- Warping Level: ${warping_level}/10 (10=none, 1=severe)
- Stringing Level: ${stringing_level}/10 (10=none, 1=severe)
- Material: ${material_type || 'Unknown'}
- Notes: ${notes || 'None'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2, maxTokens: 3000 });
      const analysis = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      const computedScore = (
        (surface_quality + dimensional_accuracy + layer_adhesion + detail_resolution + warping_level + stringing_level) / 6
      ).toFixed(2);

      // Persist to quality_scores
      const dbResult = await pool.query(
        `INSERT INTO quality_scores
           (print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes, ai_result, ai_model_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          print_name,
          surface_quality,
          dimensional_accuracy,
          layer_adhesion,
          detail_resolution,
          warping_level,
          stringing_level,
          parseFloat(computedScore),
          material_type || null,
          notes || null,
          JSON.stringify(analysis),
          aiResponse.model || AI_MODEL,
        ]
      );

      // Audit log
      await pool.query(
        `INSERT INTO ai_results (endpoint, user_id, input_data, raw_response, parsed_result, model_used, tokens_used, success)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
        ['/quality-scores/ai/analyze', req.user?.id, JSON.stringify(req.body), aiResponse.content, JSON.stringify(analysis), aiResponse.model || AI_MODEL, aiResponse.usage?.total_tokens || null]
      );

      res.status(201).json({
        success: true,
        analysis,
        computed_overall_score: parseFloat(computedScore),
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
