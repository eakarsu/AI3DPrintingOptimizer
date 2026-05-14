const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// GET all with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const materialType = req.query.material_type || null;

    let whereClause = '';
    const params = [limit, offset];
    if (materialType) {
      whereClause = 'WHERE material_type = $3';
      params.push(materialType);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM print_profiles ${whereClause}`, materialType ? [materialType] : []);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(`SELECT * FROM print_profiles ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`, params);

    res.json({ data: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM print_profiles WHERE id = $1', [req.params.id]);
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
    body('profile_name').notEmpty().withMessage('profile_name is required'),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }).withMessage('layer_height must be 0.01-1.0mm'),
    body('nozzle_temp').optional().isInt({ min: 100, max: 400 }).withMessage('nozzle_temp must be 100-400°C'),
    body('bed_temp').optional().isInt({ min: 0, max: 150 }).withMessage('bed_temp must be 0-150°C'),
    body('print_speed').optional().isInt({ min: 1, max: 500 }).withMessage('print_speed must be 1-500 mm/s'),
    body('infill_density').optional().isInt({ min: 0, max: 100 }).withMessage('infill_density must be 0-100%'),
    body('retraction_distance').optional().isFloat({ min: 0, max: 20 }).withMessage('retraction_distance must be 0-20mm'),
    body('fan_speed').optional().isInt({ min: 0, max: 100 }).withMessage('fan_speed must be 0-100%'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes } = req.body;
      const result = await pool.query(
        `INSERT INTO print_profiles (profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes]
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
    body('profile_name').notEmpty().withMessage('profile_name is required'),
    body('layer_height').optional().isFloat({ min: 0.01, max: 1.0 }),
    body('nozzle_temp').optional().isInt({ min: 100, max: 400 }),
    body('bed_temp').optional().isInt({ min: 0, max: 150 }),
    body('print_speed').optional().isInt({ min: 1, max: 500 }),
    body('infill_density').optional().isInt({ min: 0, max: 100 }),
    body('retraction_distance').optional().isFloat({ min: 0, max: 20 }),
    body('fan_speed').optional().isInt({ min: 0, max: 100 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes } = req.body;
      const result = await pool.query(
        `UPDATE print_profiles SET profile_name=$1, material_type=$2, layer_height=$3, nozzle_temp=$4, bed_temp=$5, print_speed=$6, infill_density=$7, retraction_enabled=$8, retraction_distance=$9, fan_speed=$10, notes=$11, updated_at=NOW()
         WHERE id=$12 RETURNING *`,
        [profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes, req.params.id]
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
    const result = await pool.query('DELETE FROM print_profiles WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/apply-to-job — apply a profile to a print job
router.post('/:id/apply-to-job',
  auth,
  [
    body('job_id').isInt({ min: 1 }).withMessage('job_id must be a valid integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const profileResult = await pool.query('SELECT * FROM print_profiles WHERE id = $1', [req.params.id]);
      if (profileResult.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });

      const jobResult = await pool.query('SELECT * FROM print_jobs WHERE id = $1', [req.body.job_id]);
      if (jobResult.rows.length === 0) return res.status(404).json({ error: 'Print job not found' });

      const profile = profileResult.rows[0];

      // Update the print job's notes with the applied profile info
      await pool.query(
        `UPDATE print_jobs SET notes = CONCAT(COALESCE(notes, ''), $1), updated_at = NOW() WHERE id = $2`,
        [`\n[Profile Applied: ${profile.profile_name}]`, req.body.job_id]
      );

      res.json({
        success: true,
        message: `Profile "${profile.profile_name}" applied to job`,
        profile_settings: {
          layer_height: profile.layer_height,
          nozzle_temp: profile.nozzle_temp,
          bed_temp: profile.bed_temp,
          print_speed: profile.print_speed,
          infill_density: profile.infill_density,
          retraction_enabled: profile.retraction_enabled,
          retraction_distance: profile.retraction_distance,
          fan_speed: profile.fan_speed,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
