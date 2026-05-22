const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    data: [
      { id: 1, lot_id: 'PA12-778', material: 'PA12', reuse_cycle: 4, virgin_blend_pct: 32, moisture_ppm: 410, tensile_risk: 'low', status: 'approved' },
      { id: 2, lot_id: 'TPU-241', material: 'TPU', reuse_cycle: 6, virgin_blend_pct: 45, moisture_ppm: 760, tensile_risk: 'medium', status: 'drying required' },
      { id: 3, lot_id: 'ALSI10-092', material: 'AlSi10Mg', reuse_cycle: 3, virgin_blend_pct: 25, moisture_ppm: 180, tensile_risk: 'low', status: 'approved' }
    ],
    pagination: { page: 1, limit: 20, total: 3, totalPages: 1 }
  });
});

module.exports = router;
