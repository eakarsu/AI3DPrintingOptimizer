const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// GET /api/analytics/fleet-overview
router.get('/fleet-overview', auth, async (req, res) => {
  try {
    // Printer stats
    const printerStats = await pool.query(`
      SELECT
        COUNT(*) as total_printers,
        COUNT(*) FILTER (WHERE status = 'Printing') as printing_count,
        COUNT(*) FILTER (WHERE status = 'Idle') as idle_count,
        COUNT(*) FILTER (WHERE status = 'Maintenance') as maintenance_count,
        COUNT(*) FILTER (WHERE status = 'Offline') as offline_count,
        ROUND(AVG(total_print_hours)::numeric, 1) as avg_print_hours,
        ROUND(SUM(total_print_hours)::numeric, 1) as total_fleet_hours
      FROM printers
    `);

    // Print job stats
    const jobStats = await pool.query(`
      SELECT
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
        COUNT(*) FILTER (WHERE status = 'printing') as active_jobs,
        COUNT(*) FILTER (WHERE status = 'queued') as queued_jobs,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'completed')::decimal /
          NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed')), 0) * 100),
          1
        ) as success_rate_pct
      FROM print_jobs
    `);

    // Material usage breakdown
    const materialUsage = await pool.query(`
      SELECT
        material_type,
        COUNT(*) as job_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        ROUND(SUM(COALESCE(material_weight_used_g, 0))::numeric, 1) as total_weight_g
      FROM print_jobs
      WHERE material_type IS NOT NULL
      GROUP BY material_type
      ORDER BY job_count DESC
    `);

    // Material inventory stats
    const inventoryStats = await pool.query(`
      SELECT
        COUNT(*) as total_materials,
        COUNT(*) FILTER (WHERE in_stock = true) as in_stock,
        COUNT(*) FILTER (WHERE in_stock = false) as out_of_stock,
        ROUND(AVG(price)::numeric, 2) as avg_price_usd
      FROM materials
    `);

    // Maintenance costs
    const maintenanceCosts = await pool.query(`
      SELECT
        COUNT(*) as total_logs,
        ROUND(SUM(COALESCE(cost, 0))::numeric, 2) as total_cost_usd,
        COUNT(*) FILTER (WHERE status = 'Scheduled') as scheduled,
        COUNT(*) FILTER (WHERE next_maintenance_date < CURRENT_DATE AND status != 'Completed') as overdue
      FROM maintenance_logs
    `);

    // Quality averages
    const qualityAvg = await pool.query(`
      SELECT
        ROUND(AVG(overall_score)::numeric, 2) as avg_quality_score,
        ROUND(AVG(surface_quality)::numeric, 2) as avg_surface,
        ROUND(AVG(dimensional_accuracy)::numeric, 2) as avg_accuracy,
        ROUND(AVG(layer_adhesion)::numeric, 2) as avg_adhesion,
        COUNT(*) as total_quality_assessments
      FROM quality_scores
    `);

    // AI usage stats
    const aiStats = await pool.query(`
      SELECT
        COUNT(*) as total_ai_calls,
        COUNT(*) FILTER (WHERE success = true) as successful_calls,
        COUNT(DISTINCT endpoint) as unique_endpoints,
        ROUND(AVG(tokens_used)::numeric, 0) as avg_tokens_per_call
      FROM ai_results
    `);

    // Recent activity (last 7 days)
    const recentActivity = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as jobs_created
      FROM print_jobs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Jobs by priority
    const jobsByPriority = await pool.query(`
      SELECT priority, COUNT(*) as count
      FROM print_jobs
      GROUP BY priority
      ORDER BY count DESC
    `);

    res.json({
      printers: printerStats.rows[0],
      jobs: jobStats.rows[0],
      material_usage: materialUsage.rows,
      inventory: inventoryStats.rows[0],
      maintenance: maintenanceCosts.rows[0],
      quality: qualityAvg.rows[0],
      ai_usage: aiStats.rows[0],
      recent_activity: recentActivity.rows,
      jobs_by_priority: jobsByPriority.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/material-consumption
router.get('/material-consumption', auth, async (req, res) => {
  try {
    const period = req.query.period || '30'; // days
    const days = Math.min(365, Math.max(1, parseInt(period)));

    const consumption = await pool.query(`
      SELECT
        material_type,
        COUNT(*) as job_count,
        ROUND(SUM(COALESCE(material_weight_used_g, 0))::numeric, 1) as total_grams,
        ROUND(SUM(COALESCE(estimated_time, 0))::numeric, 1) as total_hours,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM print_jobs
      WHERE created_at >= NOW() - INTERVAL '${days} days'
        AND material_type IS NOT NULL
      GROUP BY material_type
      ORDER BY total_grams DESC
    `);

    // Low stock alerts
    const lowStock = await pool.query(`
      SELECT name, type, brand, weight_grams, in_stock
      FROM materials
      WHERE in_stock = false OR weight_grams < 200
      ORDER BY weight_grams ASC
    `);

    res.json({
      period_days: days,
      consumption: consumption.rows,
      low_stock_alerts: lowStock.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/printer-utilization
router.get('/printer-utilization', auth, async (req, res) => {
  try {
    const utilization = await pool.query(`
      SELECT
        p.name,
        p.model,
        p.status,
        p.total_print_hours,
        COUNT(j.id) as total_jobs,
        COUNT(j.id) FILTER (WHERE j.status = 'completed') as completed_jobs,
        COUNT(j.id) FILTER (WHERE j.status = 'failed') as failed_jobs,
        ROUND(
          (COUNT(j.id) FILTER (WHERE j.status = 'completed')::decimal /
          NULLIF(COUNT(j.id) FILTER (WHERE j.status IN ('completed','failed')), 0) * 100),
          1
        ) as success_rate_pct,
        ROUND(SUM(COALESCE(j.estimated_time, 0))::numeric, 1) as total_estimated_hours
      FROM printers p
      LEFT JOIN print_jobs j ON j.printer_name = p.name
      GROUP BY p.id, p.name, p.model, p.status, p.total_print_hours
      ORDER BY total_jobs DESC
    `);

    res.json({ printers: utilization.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/success-rate-matrix
router.get('/success-rate-matrix', auth, async (req, res) => {
  try {
    const matrix = await pool.query(`
      SELECT
        printer_name,
        material_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        ROUND(
          (COUNT(*) FILTER (WHERE status = 'completed')::decimal /
          NULLIF(COUNT(*), 0) * 100),
          1
        ) as success_rate_pct
      FROM print_jobs
      WHERE printer_name IS NOT NULL AND material_type IS NOT NULL
      GROUP BY printer_name, material_type
      HAVING COUNT(*) >= 1
      ORDER BY printer_name, material_type
    `);

    res.json({ matrix: matrix.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
