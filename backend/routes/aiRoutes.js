const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { queryOpenRouter, parseAIJson, DEFAULT_MODEL } = require('../services/openrouter');
const { body, validationResult } = require('express-validator');

const AI_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

/**
 * Save AI call to the central ai_results audit table
 */
async function saveAiResult(endpoint, userId, inputData, aiResponse, parsedResult) {
  try {
    await pool.query(
      `INSERT INTO ai_results (endpoint, user_id, input_data, raw_response, parsed_result, model_used, tokens_used, success)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [
        endpoint,
        userId || null,
        JSON.stringify(inputData),
        aiResponse.content,
        JSON.stringify(parsedResult),
        aiResponse.model || AI_MODEL,
        aiResponse.usage?.total_tokens || null,
      ]
    );
  } catch (err) {
    console.error('Failed to save AI result to audit log:', err.message);
  }
}

// POST /api/ai/material-recommendation
router.post('/material-recommendation',
  auth,
  [
    body('use_case').notEmpty().withMessage('use_case is required'),
    body('strength_requirement').optional().isIn(['Low', 'Medium', 'High']),
    body('flexibility_requirement').optional().isIn(['Low', 'Medium', 'High']),
    body('budget').optional().isIn(['Low', 'Medium', 'High']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { use_case, strength_requirement, flexibility_requirement, budget } = req.body;

      const systemPrompt = `You are an expert 3D printing material advisor with deep knowledge of FDM filaments, their properties, and real-world performance. Recommend the best filament material for the given requirements. You must respond ONLY with valid JSON — no markdown, no prose before or after. Use this exact schema:
{
  "recommended_material": "PLA|PETG|ABS|TPU|ASA|Nylon|PC|PVA|HIPS|Carbon Fiber PLA|PLA+|Wood PLA",
  "material_full_name": "string",
  "nozzle_temp_min": number,
  "nozzle_temp_max": number,
  "bed_temp_min": number,
  "bed_temp_max": number,
  "reasoning": "string (2-3 sentences explaining why this material is best)",
  "pros": ["string", "string", "string"],
  "cons": ["string", "string"],
  "alternatives": [
    {"material": "string", "reason": "string"},
    {"material": "string", "reason": "string"}
  ],
  "estimated_cost_per_kg_usd": number,
  "difficulty_level": "Beginner|Intermediate|Advanced",
  "print_tips": ["string", "string", "string"],
  "confidence_score": number
}`;

      const userMessage = `Recommend a filament material for:
- Use Case: ${use_case}
- Strength Requirement: ${strength_requirement || 'Medium'} (Low/Medium/High)
- Flexibility Requirement: ${flexibility_requirement || 'Low'} (Low/Medium/High)
- Budget: ${budget || 'Medium'} (Low/Medium/High)`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const recommendation = parseAIJson(aiResponse.content) || { summary: aiResponse.content, recommended_material: 'Unknown' };

      // Save to material_selections table
      const dbResult = await pool.query(
        `INSERT INTO material_selections
           (project_name, application, strength_required, flexibility_required, recommended_material, budget_level, notes, ai_result, ai_model_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          use_case,
          use_case,
          strength_requirement === 'High' ? 8 : strength_requirement === 'Medium' ? 5 : 3,
          flexibility_requirement === 'High' ? 8 : flexibility_requirement === 'Medium' ? 5 : 3,
          recommendation.recommended_material || 'Unknown',
          budget || 'Medium',
          recommendation.reasoning || null,
          JSON.stringify(recommendation),
          aiResponse.model || AI_MODEL,
        ]
      );

      await saveAiResult('/api/ai/material-recommendation', req.user?.id, req.body, aiResponse, recommendation);

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

// POST /api/ai/tune-parameters
router.post('/tune-parameters',
  auth,
  [
    body('material').notEmpty().withMessage('material is required'),
    body('geometry_type').optional().isString(),
    body('quality_requirement').optional().isIn(['Draft', 'Standard', 'High', 'Ultra']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { material, geometry_type, quality_requirement, printer_model } = req.body;

      const systemPrompt = `You are an expert 3D printing parameter optimization AI with deep knowledge of slicer settings for FDM printers. Given a material, geometry type, and quality requirement, return scientifically optimal print parameters. Consider retraction, cooling, and first-layer adhesion. Respond ONLY with valid JSON using this exact schema:
{
  "nozzle_temp": number,
  "bed_temp": number,
  "print_speed": number,
  "first_layer_speed": number,
  "layer_height": number,
  "first_layer_height": number,
  "infill_density": number,
  "infill_pattern": "grid|gyroid|honeycomb|lines|triangles|cubic",
  "cooling_fan_speed": number,
  "first_layer_fan_speed": number,
  "retraction_distance": number,
  "retraction_speed": number,
  "support_enabled": boolean,
  "support_type": "none|normal|tree",
  "brim_enabled": boolean,
  "brim_width": number,
  "reasoning": "string",
  "quality_notes": "string",
  "common_pitfalls": ["string", "string"],
  "confidence_score": number
}`;

      const userMessage = `Tune 3D print parameters for:
- Material: ${material}
- Geometry Type: ${geometry_type || 'General'}
- Quality Requirement: ${quality_requirement || 'Standard'} (Draft/Standard/High/Ultra)
- Printer Model: ${printer_model || 'Generic FDM'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.15 });
      const parameters = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      // Save to print_parameters table
      const dbResult = await pool.query(
        `INSERT INTO print_parameters
           (material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled, ai_result, ai_model_used)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          material,
          geometry_type || 'General',
          parameters.layer_height || null,
          parameters.nozzle_temp || null,
          parameters.bed_temp || null,
          parameters.print_speed || null,
          parameters.infill_density || null,
          parameters.support_enabled !== undefined ? parameters.support_enabled : false,
          JSON.stringify(parameters),
          aiResponse.model || AI_MODEL,
        ]
      );

      await saveAiResult('/api/ai/tune-parameters', req.user?.id, req.body, aiResponse, parameters);

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

// POST /api/ai/maintenance-forecast
router.post('/maintenance-forecast',
  auth,
  [
    body('printer_name').notEmpty().withMessage('printer_name is required'),
    body('total_print_hours').isFloat({ min: 0 }).withMessage('total_print_hours must be a positive number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { printer_name, printer_model, total_print_hours, last_maintenance_type, last_maintenance_date, maintenance_history } = req.body;

      const systemPrompt = `You are an expert 3D printer maintenance engineer. Based on printer usage and maintenance history, predict upcoming maintenance needs and costs. Respond ONLY with valid JSON:
{
  "urgency": "Low|Medium|High|Critical",
  "predicted_next_maintenance_days": number,
  "predicted_next_maintenance_date": "YYYY-MM-DD",
  "estimated_maintenance_cost_usd": number,
  "maintenance_items": [
    {
      "item": "string",
      "priority": "Low|Medium|High",
      "estimated_cost": number,
      "due_hours": number,
      "description": "string"
    }
  ],
  "current_health_score": number,
  "recommendations": ["string", "string", "string"],
  "risk_assessment": "string",
  "confidence_score": number
}`;

      const userMessage = `Forecast maintenance for:
- Printer: ${printer_name} (${printer_model || 'Unknown Model'})
- Total Print Hours: ${total_print_hours}
- Last Maintenance: ${last_maintenance_type || 'Unknown'} on ${last_maintenance_date || 'Unknown date'}
- Maintenance History: ${maintenance_history ? JSON.stringify(maintenance_history) : 'Not provided'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const forecast = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      // Save to maintenance_forecasts table
      const dbResult = await pool.query(
        `INSERT INTO maintenance_forecasts
           (printer_name, forecast_result, ai_model_used, next_maintenance_predicted, estimated_cost, urgency)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [
          printer_name,
          JSON.stringify(forecast),
          aiResponse.model || AI_MODEL,
          forecast.predicted_next_maintenance_date || null,
          forecast.estimated_maintenance_cost_usd || null,
          forecast.urgency || 'Unknown',
        ]
      );

      await saveAiResult('/api/ai/maintenance-forecast', req.user?.id, req.body, aiResponse, forecast);

      res.status(201).json({
        success: true,
        forecast,
        saved_record: dbResult.rows[0],
        model_used: aiResponse.model || AI_MODEL,
        usage: aiResponse.usage,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/ai/root-cause-analysis
router.post('/root-cause-analysis',
  auth,
  [
    body('print_job_id').optional().isInt(),
    body('material_type').notEmpty().withMessage('material_type is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { print_job_id, job_name, material_type, printer_name, layer_height, nozzle_temp, bed_temp, print_speed, failure_description, notes } = req.body;

      const systemPrompt = `You are an expert 3D printing failure analyst. Given the details of a failed print job, identify the most likely root causes and provide specific corrective actions. Respond ONLY with valid JSON:
{
  "primary_cause": "string",
  "contributing_factors": ["string", "string"],
  "confidence_level": "Low|Medium|High",
  "corrective_actions": [
    {
      "action": "string",
      "priority": "Immediate|Short-term|Long-term",
      "expected_improvement": "string"
    }
  ],
  "parameter_adjustments": {
    "nozzle_temp_adjustment": number,
    "bed_temp_adjustment": number,
    "print_speed_adjustment": number,
    "layer_height_adjustment": number
  },
  "prevention_strategies": ["string", "string"],
  "severity": "Minor|Moderate|Major|Critical",
  "root_cause_summary": "string"
}`;

      const userMessage = `Analyze failed print:
- Job: ${job_name || 'Unknown Job'} (ID: ${print_job_id || 'N/A'})
- Material: ${material_type}
- Printer: ${printer_name || 'Unknown'}
- Layer Height: ${layer_height || 'N/A'}mm
- Nozzle Temp: ${nozzle_temp || 'N/A'}°C
- Bed Temp: ${bed_temp || 'N/A'}°C
- Print Speed: ${print_speed || 'N/A'}mm/s
- Failure Description: ${failure_description || 'Not provided'}
- Additional Notes: ${notes || 'None'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const analysis = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      // Update the print job with AI analysis if job ID provided
      if (print_job_id) {
        await pool.query(
          `UPDATE print_jobs SET ai_analysis = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(analysis), print_job_id]
        );
      }

      await saveAiResult('/api/ai/root-cause-analysis', req.user?.id, req.body, aiResponse, analysis);

      res.status(201).json({
        success: true,
        analysis,
        model_used: aiResponse.model || AI_MODEL,
        usage: aiResponse.usage,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/ai/build-time-estimation
router.post('/build-time-estimation',
  auth,
  [
    body('material').notEmpty().withMessage('material is required'),
    body('volume_cm3').isFloat({ min: 0 }).withMessage('volume_cm3 must be a positive number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { material, volume_cm3, layer_height, infill_density, print_speed, geometry_complexity, support_required } = req.body;

      const systemPrompt = `You are an expert 3D printing time estimator. Predict build time based on material, geometry, slicer parameters, and printer characteristics. Respond ONLY with valid JSON:
{
  "estimated_print_time_minutes": number,
  "estimated_print_time_hours": number,
  "estimated_filament_grams": number,
  "estimated_filament_meters": number,
  "complexity_factor": number,
  "support_overhead_minutes": number,
  "first_layer_overhead_minutes": number,
  "breakdown": {
    "extrusion_minutes": number,
    "travel_minutes": number,
    "heating_minutes": number,
    "post_processing_minutes": number
  },
  "assumptions": ["string", "string"],
  "confidence_score": number,
  "notes": "string"
}`;

      const userMessage = `Estimate build time:
- Material: ${material}
- Volume: ${volume_cm3} cm^3
- Layer Height: ${layer_height || 0.2}mm
- Infill Density: ${infill_density || 20}%
- Print Speed: ${print_speed || 60}mm/s
- Geometry Complexity: ${geometry_complexity || 'Medium'} (Low/Medium/High)
- Support Required: ${support_required ? 'Yes' : 'No'}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.15 });
      const estimate = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      await saveAiResult('/api/ai/build-time-estimation', req.user?.id, req.body, aiResponse, estimate);

      res.status(201).json({
        success: true,
        estimate,
        model_used: aiResponse.model || AI_MODEL,
        usage: aiResponse.usage,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/ai/cost-optimization
router.post('/cost-optimization',
  auth,
  [
    body('material').notEmpty().withMessage('material is required'),
    body('volume_cm3').isFloat({ min: 0 }).withMessage('volume_cm3 must be a positive number'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { material, volume_cm3, infill_density, layer_height, support_type, electricity_rate_kwh_usd, material_cost_per_kg_usd, batch_size } = req.body;

      const systemPrompt = `You are an expert 3D printing cost optimization advisor. Analyze the parameters and recommend ways to minimize material waste, energy consumption, and per-part cost without sacrificing required quality. Respond ONLY with valid JSON:
{
  "estimated_cost_usd": number,
  "material_cost_usd": number,
  "energy_cost_usd": number,
  "labor_cost_usd": number,
  "cost_per_part_usd": number,
  "savings_recommendations": [
    {
      "recommendation": "string",
      "estimated_savings_usd": number,
      "estimated_savings_percent": number,
      "tradeoffs": "string"
    }
  ],
  "infill_optimization": {
    "current_density": number,
    "recommended_density": number,
    "savings_percent": number
  },
  "support_optimization": {
    "current_type": "string",
    "recommended_type": "string",
    "savings_percent": number
  },
  "confidence_score": number,
  "notes": "string"
}`;

      const userMessage = `Optimize cost for:
- Material: ${material} ($${material_cost_per_kg_usd || 25}/kg)
- Volume: ${volume_cm3} cm^3
- Infill Density: ${infill_density || 20}%
- Layer Height: ${layer_height || 0.2}mm
- Support Type: ${support_type || 'normal'}
- Electricity Rate: $${electricity_rate_kwh_usd || 0.13}/kWh
- Batch Size: ${batch_size || 1}`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const analysis = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      await saveAiResult('/api/ai/cost-optimization', req.user?.id, req.body, aiResponse, analysis);

      res.status(201).json({
        success: true,
        analysis,
        model_used: aiResponse.model || AI_MODEL,
        usage: aiResponse.usage,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/ai/quality-prediction
router.post('/quality-prediction',
  auth,
  [
    body('material').notEmpty().withMessage('material is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { material, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, printer_age_hours, ambient_humidity_percent } = req.body;

      const systemPrompt = `You are an expert 3D printing quality prediction model. Given proposed slicer parameters and printer state, predict the likely surface finish, dimensional accuracy, and defect risk for the upcoming print. Respond ONLY with valid JSON:
{
  "predicted_quality_score": number,
  "surface_finish_score": number,
  "dimensional_accuracy_score": number,
  "defect_risk_score": number,
  "likely_defects": [
    {
      "defect": "string",
      "probability": number,
      "mitigation": "string"
    }
  ],
  "parameter_warnings": ["string", "string"],
  "first_layer_adhesion_risk": "Low|Medium|High",
  "warping_risk": "Low|Medium|High",
  "stringing_risk": "Low|Medium|High",
  "recommended_changes": [
    {
      "parameter": "string",
      "current_value": "string",
      "suggested_value": "string",
      "reason": "string"
    }
  ],
  "overall_recommendation": "Proceed|Adjust|Cancel",
  "confidence_score": number
}`;

      const userMessage = `Predict print quality for:
- Material: ${material}
- Geometry Type: ${geometry_type || 'General'}
- Layer Height: ${layer_height || 0.2}mm
- Nozzle Temp: ${nozzle_temp || 'Auto'}°C
- Bed Temp: ${bed_temp || 'Auto'}°C
- Print Speed: ${print_speed || 60}mm/s
- Infill Density: ${infill_density || 20}%
- Printer Age: ${printer_age_hours || 'Unknown'} hours
- Ambient Humidity: ${ambient_humidity_percent || 'Unknown'}%`;

      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const prediction = parseAIJson(aiResponse.content) || { summary: aiResponse.content };

      await saveAiResult('/api/ai/quality-prediction', req.user?.id, req.body, aiResponse, prediction);

      res.status(201).json({
        success: true,
        prediction,
        model_used: aiResponse.model || AI_MODEL,
        usage: aiResponse.usage,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/ai/results - get AI audit log with pagination
router.get('/results', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const endpoint = req.query.endpoint || null;

    let whereClause = '';
    const params = [limit, offset];
    if (endpoint) {
      whereClause = 'WHERE endpoint = $3';
      params.push(endpoint);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_results ${endpoint ? 'WHERE endpoint = $1' : ''}`,
      endpoint ? [endpoint] : []
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT id, endpoint, user_id, parsed_result, model_used, tokens_used, success, error_message, created_at
       FROM ai_results ${whereClause}
       ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Apply pass 5 — remaining backlog
// ============================================================

// 503 helper: returns true (and sends 503) when OPENROUTER_API_KEY is unset
const requireKey = (res) => {
  if (!process.env.OPENROUTER_API_KEY) {
    res.status(503).json({ error: 'AI service not configured', missing: 'OPENROUTER_API_KEY' });
    return true;
  }
  return false;
};

// PRODUCT-DECISION: multi-printer load balancing scheduler.
// Decision: greedy heuristic + LLM optimization (NOT a constraint solver).
// We expose printers, queue jobs and ask the LLM to assign jobs to printers
// optimizing for: estimated print time, material match, printer age, current
// queue depth. A future v2 could swap in OR-Tools or similar; doing so now
// would be TOO-RISKY (heavy dep). The endpoint is additive and does not
// mutate scheduling state.
// POST /api/ai/multi-printer-load-balance
// Body: { jobs:[{id,material,est_minutes,priority?}], printers:[{id,model,capabilities:[],current_queue?}] }
router.post('/multi-printer-load-balance',
  auth,
  [
    body('jobs').isArray({ min: 1 }).withMessage('jobs (non-empty array) is required'),
    body('printers').isArray({ min: 1 }).withMessage('printers (non-empty array) is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (requireKey(res)) return;
    try {
      const { jobs, printers } = req.body;
      const systemPrompt = `You are a 3D-printing fleet scheduler. Assign jobs to printers minimizing total makespan, respecting material capabilities, printer age, and current queue depth. Return ONLY valid JSON:
{
  "assignments": [{"job_id":"","printer_id":"","start_offset_min":0,"end_offset_min":0,"reason":""}],
  "printer_utilization_pct": {"<printer_id>": 0},
  "estimated_makespan_min": 0,
  "warnings": [],
  "summary": ""
}`;
      const userMessage = `Schedule jobs across fleet.\n\nJOBS:\n${JSON.stringify(jobs, null, 2)}\n\nPRINTERS:\n${JSON.stringify(printers, null, 2)}`;
      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const plan = parseAIJson(aiResponse.content) || { summary: aiResponse.content };
      await saveAiResult('/api/ai/multi-printer-load-balance', req.user?.id, req.body, aiResponse, plan);
      res.status(201).json({ success: true, plan, model_used: aiResponse.model || AI_MODEL, usage: aiResponse.usage });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// NEEDS-CREDS: filament inventory auto-reorder.
// Env vars required: FILAMENT_SUPPLIER_API_KEY (Stratasys / Ultimaker / generic).
// Optional: FILAMENT_SUPPLIER_URL (defaults to placeholder).
// Returns 503 + missing if absent. When present, the LLM produces a
// recommended re-order packet ready to POST to the supplier API; no outbound
// HTTP is performed here (additive only).
// POST /api/ai/filament-auto-reorder
// Body: { current_inventory:[{material,color,qty_g,reorder_point_g?}], lead_time_days? }
router.post('/filament-auto-reorder',
  auth,
  [
    body('current_inventory').isArray({ min: 1 }).withMessage('current_inventory (array) is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (!process.env.FILAMENT_SUPPLIER_API_KEY) {
      return res.status(503).json({
        error: 'Filament supplier integration not configured',
        missing: 'FILAMENT_SUPPLIER_API_KEY',
      });
    }
    if (requireKey(res)) return;
    try {
      const { current_inventory, lead_time_days } = req.body;
      const systemPrompt = `You are a filament inventory manager. Identify SKUs below reorder point, account for lead time, and produce a re-order packet. Return ONLY valid JSON:
{
  "reorder_items": [{"material":"","color":"","qty_g":0,"sku":"","priority":"low|medium|high","reason":""}],
  "total_estimated_cost_usd": 0,
  "no_action_items": [{"material":"","color":"","reason":""}],
  "summary": ""
}`;
      const userMessage = `Generate filament re-order packet.\n\nINVENTORY:\n${JSON.stringify(current_inventory, null, 2)}\n\nLEAD TIME DAYS: ${lead_time_days || 7}`;
      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const order = parseAIJson(aiResponse.content) || { summary: aiResponse.content };
      await saveAiResult('/api/ai/filament-auto-reorder', req.user?.id, req.body, aiResponse, order);
      res.status(201).json({ success: true, order, model_used: aiResponse.model || AI_MODEL, usage: aiResponse.usage });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// TOO-RISKY (additive only): printer-health streaming anomaly detection.
// Real implementation would need a sensor ingestion pipeline / WebSocket
// infra not present in this repo. Instead this endpoint accepts a recent
// telemetry window in-memory (caller-provided) and asks the LLM to flag
// anomalies. No DB schema added, no streaming infra introduced.
// POST /api/ai/printer-health-anomaly
// Body: { printer_id, telemetry_window:[{timestamp,nozzle_temp,bed_temp,print_speed,vibration?,extruder_force?}] }
router.post('/printer-health-anomaly',
  auth,
  [
    body('printer_id').notEmpty().withMessage('printer_id is required'),
    body('telemetry_window').isArray({ min: 1 }).withMessage('telemetry_window (array) is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (requireKey(res)) return;
    try {
      const { printer_id, telemetry_window } = req.body;
      const systemPrompt = `You are a 3D printer health-monitoring AI. Analyze a recent telemetry window for thermal instability, vibration anomalies, and extruder issues. Return ONLY valid JSON:
{
  "anomalies": [{"type":"thermal|mechanical|extruder|other","severity":"low|medium|high","detail":"","timestamp":""}],
  "overall_health_score": 0-100,
  "predicted_failure_horizon_hours": 0,
  "recommended_action": "continue|inspect|stop|service",
  "summary": ""
}`;
      const userMessage = `Analyze printer health.\n\nPRINTER ID: ${printer_id}\n\nTELEMETRY WINDOW (last ${telemetry_window.length} samples):\n${JSON.stringify(telemetry_window.slice(-200), null, 2)}`;
      const aiResponse = await queryOpenRouter(systemPrompt, userMessage, { temperature: 0.2 });
      const analysis = parseAIJson(aiResponse.content) || { summary: aiResponse.content };
      await saveAiResult('/api/ai/printer-health-anomaly', req.user?.id, req.body, aiResponse, analysis);
      res.status(201).json({ success: true, analysis, model_used: aiResponse.model || AI_MODEL, usage: aiResponse.usage });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
